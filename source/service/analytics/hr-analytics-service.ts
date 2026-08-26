import moment from "moment";
import { EmployeeModel } from "../../model/employee/employee-model";
import { AttendanceModel } from "../../model/attendance/attendance-model";
import { DepartmentModel } from "../../model/department/department-model";
import { toAggregateFilter } from "../../utility/helper/tenant-scope";
import { toDateOnly } from "../../utility/helper/date-only";
import { employeeDto } from "../../utility/dtos/employee/employee-dto";
import { mapDbListToDtoList } from "../../utility/mapper/employee/employee-mapper";
import { getOrSet, buildCacheKey } from "../../utility/helper/cache";

// Dashboard/Reports hit these with the same tenant+params repeatedly —
// short TTL so it's a staleness/perf tradeoff, never a source-of-truth
// change (a stale KPI for at most this long, never wrong-tenant data).
const CACHE_TTL_SECONDS = 30;

// attendance-service.ts stores Attendance.date as `moment(date).startOf("day").toDate()`
// — local-server-midnight, NOT toDateOnly()'s UTC-midnight. An exact-match
// query has to use the same convention or it silently matches nothing.
const attendanceDayBounds = (date?: string): { $gte: Date; $lte: Date } => {
  const m = date ? moment(date) : moment();
  return { $gte: m.clone().startOf("day").toDate(), $lte: m.clone().endOf("day").toDate() };
};

export interface HrOverview {
  totalEmployees: number;
  activeEmployees: number;
  onProbation: number;
  attendanceDate: string;
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
  halfDayToday: number;
  notMarkedToday: number;
  byStatus: { status: string; count: number }[];
  byGender: { gender: string; count: number }[];
  byEmploymentType: { type: string; count: number }[];
  byDepartment: { departmentId: string; departmentName: string; count: number }[];
}

// Every count here is a live read off Employee/Attendance — no cached
// snapshot, no cron. "Today" is resolved server-side by default so a
// dashboard load and a Reports load agree, but callers (e.g. Reports'
// history view) can pass a specific date instead.
const getOverview = async (
  filter: Record<string, unknown>,
  options: { date?: string } = {}
): Promise<HrOverview> =>
  getOrSet(buildCacheKey("hr-analytics:getOverview", filter, options), CACHE_TTL_SECONDS, () =>
    getOverviewImpl(filter, options)
  );

const getOverviewImpl = async (
  filter: Record<string, unknown>,
  options: { date?: string } = {}
): Promise<HrOverview> => {
  const activeFilter = { ...filter, isDeleted: { $ne: true } };
  const attendanceDate = toDateOnly(options.date || new Date());

  const totalEmployees = await EmployeeModel.countDocuments(activeFilter);
  const activeEmployees = await EmployeeModel.countDocuments({ ...activeFilter, status: "active" });
  const onProbation = await EmployeeModel.countDocuments({ ...activeFilter, status: "probation" });

  const currentlyEmployedIds = (
    await EmployeeModel.find({ ...activeFilter, status: { $in: ["active", "probation"] } }, { _id: 1 }).lean()
  ).map((e) => String(e._id));

  const attendanceMatch = { ...toAggregateFilter(filter), isDeleted: { $ne: true }, date: attendanceDayBounds(options.date) };
  const attendanceGrouped = await AttendanceModel.aggregate([
    { $match: attendanceMatch },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const attendanceByStatus = new Map<string, number>(attendanceGrouped.map((g) => [g._id, g.count]));

  const presentToday = attendanceByStatus.get("Present") || 0;
  const absentToday = attendanceByStatus.get("Absent") || 0;
  const onLeaveToday = attendanceByStatus.get("Leave") || 0;
  const halfDayToday = attendanceByStatus.get("Half-day") || 0;
  const holidayToday = attendanceByStatus.get("Holiday") || 0;
  const markedToday = presentToday + absentToday + onLeaveToday + halfDayToday + holidayToday;
  const notMarkedToday = Math.max(0, currentlyEmployedIds.length - markedToday);

  const statusGrouped = await EmployeeModel.aggregate([
    { $match: toAggregateFilter(activeFilter) },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const byStatus = statusGrouped.map((g) => ({ status: g._id || "unknown", count: g.count }));

  const genderGrouped = await EmployeeModel.aggregate([
    { $match: toAggregateFilter(activeFilter) },
    { $group: { _id: "$gender", count: { $sum: 1 } } },
  ]);
  const byGender = genderGrouped.map((g) => ({ gender: g._id || "unspecified", count: g.count }));

  const employmentTypeGrouped = await EmployeeModel.aggregate([
    { $match: toAggregateFilter(activeFilter) },
    { $group: { _id: "$employment_type", count: { $sum: 1 } } },
  ]);
  const byEmploymentType = employmentTypeGrouped.map((g) => ({ type: g._id || "unspecified", count: g.count }));

  const departmentGrouped = await EmployeeModel.aggregate([
    { $match: toAggregateFilter(activeFilter) },
    { $group: { _id: "$departmentId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const departmentIds = departmentGrouped.map((g) => g._id).filter(Boolean);
  const departments = await DepartmentModel.find({ _id: { $in: departmentIds } }, { name: 1 }).lean();
  const departmentNameById = new Map(departments.map((d) => [String(d._id), d.name || "—"]));
  const byDepartment = departmentGrouped
    .filter((g) => g._id)
    .map((g) => ({
      departmentId: String(g._id),
      departmentName: departmentNameById.get(String(g._id)) || "—",
      count: g.count,
    }));

  return {
    totalEmployees,
    activeEmployees,
    onProbation,
    attendanceDate: attendanceDate.toISOString().slice(0, 10),
    presentToday,
    absentToday,
    onLeaveToday,
    halfDayToday,
    notMarkedToday,
    byStatus,
    byGender,
    byEmploymentType,
    byDepartment,
  };
};

export interface AttendanceTrendPoint {
  date: string;
  present: number;
  absent: number;
  leave: number;
}

// Last N days of attendance, one point per calendar day — the graph behind
// "attendance trend" on the Dashboard/Reports; a single aggregate query
// grouped by day+status rather than N separate day-by-day queries.
const getAttendanceTrend = async (
  filter: Record<string, unknown>,
  days = 14
): Promise<AttendanceTrendPoint[]> => {
  const end = toDateOnly(new Date());
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const grouped = await AttendanceModel.aggregate([
    { $match: { ...toAggregateFilter(filter), isDeleted: { $ne: true }, date: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, status: "$status" },
        count: { $sum: 1 },
      },
    },
  ]);

  const byDate = new Map<string, { present: number; absent: number; leave: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    byDate.set(d.toISOString().slice(0, 10), { present: 0, absent: 0, leave: 0 });
  }
  for (const g of grouped) {
    const bucket = byDate.get(g._id.date);
    if (!bucket) continue;
    if (g._id.status === "Present") bucket.present += g.count;
    else if (g._id.status === "Absent") bucket.absent += g.count;
    else if (g._id.status === "Leave") bucket.leave += g.count;
  }

  return Array.from(byDate.entries()).map(([date, v]) => ({ date, ...v }));
};

// Backs the "Not Marked Today" drill-down — currently-employed staff with
// no attendance row at all for the given date, paginated. Mirrors the same
// eligible-status set (active/probation) getOverview uses to compute the
// notMarkedToday count, so the modal's total always matches the KPI card.
const getUnmarkedToday = async (
  filter: Record<string, unknown>,
  date: string | undefined,
  page: number,
  limit: number
): Promise<{ totalCount: number; result: employeeDto[] }> => {
  const activeFilter = { ...filter, isDeleted: { $ne: true }, status: { $in: ["active", "probation"] } };

  const markedEmployeeIds = (
    await AttendanceModel.find(
      { ...toAggregateFilter(filter), isDeleted: { $ne: true }, date: attendanceDayBounds(date) },
      { employeeId: 1 }
    ).lean()
  ).map((a) => a.employeeId);

  const query = { ...activeFilter, _id: { $nin: markedEmployeeIds } };
  const startIndex = (page - 1) * limit;
  const data = await EmployeeModel.find(query).skip(startIndex).limit(limit).sort({ first_name: 1 }).lean();
  const totalCount = await EmployeeModel.countDocuments(query);

  return { totalCount, result: mapDbListToDtoList(data) };
};

export { getOverview, getAttendanceTrend, getUnmarkedToday };
