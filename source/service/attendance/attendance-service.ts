import moment from "moment";
import { AttendanceModel, AttendanceStatus, AttendanceShiftType } from "../../model/attendance/attendance-model";
import { EmployeeModel, WeekDay } from "../../model/employee/employee-model";
import { AttendancePolicyModel } from "../../model/attendance/attendance-policy-model";
import { attendanceDto } from "../../utility/dtos/attendance/attendance-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/attendance/attendance-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { buildSearchCondition } from "../../utility/helper/list-query";

interface MarkAttendanceInput {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: string | null;
  checkOut?: string | null;
  shiftType?: AttendanceShiftType | null;
  notes?: string | null;
}

interface BulkMarkInput {
  employeeIds: string[];
  startDate: string;
  endDate: string;
  status: AttendanceStatus;
  shiftType?: AttendanceShiftType | null;
  checkIn?: string | null;
  checkOut?: string | null;
  employeeTimes?: Record<string, { checkIn?: string; checkOut?: string }>;
}

type AttendanceErrorCode = "success" | "not_found" | "invalid_employee";

interface AttendanceResult {
  errorCode: AttendanceErrorCode;
  result: attendanceDto | null;
}

const employeeExists = async (employeeId: string, scope: TenantScope): Promise<boolean> => {
  const employee = await EmployeeModel.findOne({
    _id: employeeId,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    isDeleted: { $ne: true },
  }).select("_id").lean();
  return Boolean(employee);
};

const parseHHMM = (value: string): number => {
  const [h, m] = value.split(":").map((v) => Number(v));
  return (h || 0) * 60 + (m || 0);
};

// For a span that may cross midnight (e.g. a 22:00-06:00 night shift) —
// only valid for computing a duration FROM a known start TO a known end,
// never for "how far past X is Y" comparisons (that needs plain subtraction,
// see late/early below, since an early arrival must come out negative-then-
// floored-to-zero rather than wrapping around to ~24h).
const durationMinutesWrapping = (startHHMM: string, endHHMM: string): number => {
  const start = parseHHMM(startHHMM);
  const end = parseHHMM(endHHMM);
  return end >= start ? end - start : 24 * 60 - start + end;
};

interface ComputedFields {
  overtimeHours: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
}

const ZERO_COMPUTED: ComputedFields = { overtimeHours: 0, lateMinutes: 0, earlyLeaveMinutes: 0 };

// Sun=0..Sat=6, matching both JS Date.getDay() and moment's .day().
const DAY_KEYS: WeekDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Attendance marking must never hard-fail just because an employee's
// schedule/Policy setup is incomplete — falls back to all-zero computed
// fields in that case. Late/overtime/early-leave are now computed against
// THIS employee's own hours for THIS specific day of the week (weekly_schedule),
// not one shared company Shift — different employees, or the same employee on
// different days, can have completely different hours.
const computeFields = async (
  employeeId: string,
  date: string | Date | undefined,
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
  scope: TenantScope
): Promise<ComputedFields> => {
  if (!checkIn || !checkOut || !date) return ZERO_COMPUTED;

  const employee = await EmployeeModel.findOne({
    _id: employeeId,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    isDeleted: { $ne: true },
  }).lean();
  if (!employee || !employee.weekly_schedule?.length) return ZERO_COMPUTED;

  const dayKey = DAY_KEYS[moment(date).day()];
  const daySchedule = employee.weekly_schedule.find((d) => d.day === dayKey);
  if (!daySchedule || !daySchedule.isWorking || !daySchedule.start || !daySchedule.end) {
    return ZERO_COMPUTED;
  }

  const policy = await AttendancePolicyModel.findOne({
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    endDate: null,
  }).lean();

  const scheduledMinutes = durationMinutesWrapping(daySchedule.start, daySchedule.end);
  const workedMinutes = durationMinutesWrapping(checkIn, checkOut);
  const overtimeHours = Math.round((Math.max(0, workedMinutes - scheduledMinutes) / 60) * 100) / 100;

  if (policy?.rules?.alwaysPresent) {
    return { overtimeHours, lateMinutes: 0, earlyLeaveMinutes: 0 };
  }

  const lateGrace = policy?.rules?.lateGraceMinutes || 0;
  const earlyGrace = policy?.rules?.earlyGraceMinutes || 0;
  const lateMinutes = Math.max(0, parseHHMM(checkIn) - parseHHMM(daySchedule.start) - lateGrace);
  const earlyLeaveMinutes = Math.max(0, parseHHMM(daySchedule.end) - parseHHMM(checkOut) - earlyGrace);

  return { overtimeHours, lateMinutes, earlyLeaveMinutes };
};

// Upserts on {employeeId, date} — marking the same employee+date again
// corrects the existing record instead of creating a duplicate.
const markAttendance = async (
  data: MarkAttendanceInput,
  scope: TenantScope,
  createdBy: string
): Promise<AttendanceResult> => {
  if (!(await employeeExists(data.employeeId, scope))) {
    return { errorCode: "invalid_employee", result: null };
  }

  const computed = await computeFields(data.employeeId, data.date, data.checkIn, data.checkOut, scope);
  const dateOnly = moment(data.date).startOf("day").toDate();

  const updated = await AttendanceModel.findOneAndUpdate(
    { employeeId: data.employeeId, date: dateOnly, adminId: scope.adminId, merchantId: scope.merchantId },
    {
      $set: {
        status: data.status,
        checkIn: data.checkIn || null,
        checkOut: data.checkOut || null,
        shiftType: data.shiftType || null,
        notes: data.notes || null,
        overtimeHours: computed.overtimeHours,
        lateMinutes: computed.lateMinutes,
        earlyLeaveMinutes: computed.earlyLeaveMinutes,
        isDeleted: false,
        adminId: scope.adminId,
        merchantId: scope.merchantId,
        createdBy,
      },
    },
    { new: true, upsert: true }
  ).lean();

  if (!updated) {
    return { errorCode: "not_found", result: null };
  }
  return { errorCode: "success", result: mapDbToDto(updated) };
};

const markAttendanceBulk = async (
  data: BulkMarkInput,
  scope: TenantScope,
  createdBy: string
): Promise<attendanceDto[]> => {
  const dates: string[] = [];
  let cursor = moment(data.startDate).startOf("day");
  const last = moment(data.endDate).startOf("day");
  while (cursor.isSameOrBefore(last)) {
    dates.push(cursor.format("YYYY-MM-DD"));
    cursor = cursor.add(1, "day");
  }

  const results: attendanceDto[] = [];
  for (const employeeId of data.employeeIds) {
    const times = data.employeeTimes?.[employeeId];
    const checkIn = times?.checkIn ?? data.checkIn ?? null;
    const checkOut = times?.checkOut ?? data.checkOut ?? null;

    for (const date of dates) {
      const outcome = await markAttendance(
        { employeeId, date, status: data.status, checkIn, checkOut, shiftType: data.shiftType || null },
        scope,
        createdBy
      );
      if (outcome.result) {
        results.push(outcome.result);
      }
    }
  }

  return results;
};

interface ListFilters {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  month?: string;
  year?: string;
  status?: string;
  search?: string;
}

const buildDateRangeQuery = (listFilters: ListFilters): Record<string, unknown> => {
  if (listFilters.startDate && listFilters.endDate) {
    return {
      date: {
        $gte: moment(listFilters.startDate).startOf("day").toDate(),
        $lte: moment(listFilters.endDate).endOf("day").toDate(),
      },
    };
  }
  if (listFilters.month && listFilters.year) {
    const monthStart = moment(`${listFilters.year}-${listFilters.month}-01`, "YYYY-MM-DD").startOf("month").toDate();
    const monthEnd = moment(`${listFilters.year}-${listFilters.month}-01`, "YYYY-MM-DD").endOf("month").toDate();
    return { date: { $gte: monthStart, $lte: monthEnd } };
  }
  return {};
};

const getAll = async (
  filter: Record<string, unknown>,
  listFilters: ListFilters,
  page: number,
  limit: number
): Promise<{ totalCount: number; result: attendanceDto[] }> => {
  const query: Record<string, unknown> = {
    ...filter,
    ...buildDateRangeQuery(listFilters),
    isDeleted: { $ne: true },
  };
  if (listFilters.employeeId) {
    query.employeeId = listFilters.employeeId;
  }
  if (listFilters.status) {
    query.status = listFilters.status;
  }
  if (listFilters.search) {
    const matches = await EmployeeModel.find(
      { ...filter, ...buildSearchCondition(listFilters.search, ["first_name", "last_name", "employeeCode"]) },
      "_id"
    ).lean();
    query.employeeId = { $in: matches.map((e) => e._id) };
  }

  const startIndex = (page - 1) * limit;
  const data = await AttendanceModel.find(query)
    .populate("employeeId", "first_name last_name employeeCode")
    .skip(startIndex)
    .limit(limit)
    .sort({ date: -1 })
    .lean();
  const count = await AttendanceModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

interface TodayStats {
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
}

// Tenant-wide "today" counts, independent of pagination/search — used for
// the list page's stat cards.
const getTodayStats = async (filter: Record<string, unknown>): Promise<TodayStats> => {
  const todayStart = moment().startOf("day").toDate();
  const todayEnd = moment().endOf("day").toDate();
  const base = { ...filter, isDeleted: { $ne: true }, date: { $gte: todayStart, $lte: todayEnd } };

  const [presentToday, absentToday, onLeaveToday] = await Promise.all([
    AttendanceModel.countDocuments({ ...base, status: { $in: ["Present", "Half-day"] } }),
    AttendanceModel.countDocuments({ ...base, status: "Absent" }),
    AttendanceModel.countDocuments({ ...base, status: "Leave" }),
  ]);

  return { presentToday, absentToday, onLeaveToday };
};

const getSummary = async (
  employeeId: string,
  month: string,
  year: string,
  filter: Record<string, unknown>
): Promise<Record<string, number>> => {
  const monthStart = moment(`${year}-${month}-01`, "YYYY-MM-DD").startOf("month").toDate();
  const monthEnd = moment(`${year}-${month}-01`, "YYYY-MM-DD").endOf("month").toDate();

  const records = await AttendanceModel.find({
    ...filter,
    employeeId,
    date: { $gte: monthStart, $lte: monthEnd },
    isDeleted: { $ne: true },
  }).lean();

  const summary: Record<string, number> = { Present: 0, Absent: 0, Leave: 0, Holiday: 0, "Half-day": 0 };
  records.forEach((record) => {
    if (record.status && summary[record.status] !== undefined) {
      summary[record.status] += 1;
    }
  });

  return summary;
};

const get = async (id: string, filter: Record<string, unknown>): Promise<attendanceDto | null> => {
  const data = await AttendanceModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } }).lean();
  return data ? mapDbToDto(data) : null;
};

const update = async (
  id: string,
  data: Partial<MarkAttendanceInput>,
  filter: Record<string, unknown>,
  scope: TenantScope
): Promise<AttendanceResult> => {
  const existing = await AttendanceModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } })
    .select("employeeId checkIn checkOut date")
    .lean();
  if (!existing) {
    return { errorCode: "not_found", result: null };
  }

  const employeeId = existing.employeeId ? String(existing.employeeId) : "";
  const checkIn = data.checkIn ?? existing.checkIn;
  const checkOut = data.checkOut ?? existing.checkOut;
  const date = data.date ?? existing.date ?? undefined;
  const computed = await computeFields(employeeId, date, checkIn, checkOut, scope);

  const updated = await AttendanceModel.findOneAndUpdate(
    { _id: id, ...filter, isDeleted: { $ne: true } },
    {
      $set: {
        ...data,
        overtimeHours: computed.overtimeHours,
        lateMinutes: computed.lateMinutes,
        earlyLeaveMinutes: computed.earlyLeaveMinutes,
      },
    },
    { new: true }
  ).lean();

  if (!updated) {
    return { errorCode: "not_found", result: null };
  }
  return { errorCode: "success", result: mapDbToDto(updated) };
};

const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<boolean> => {
  const result = await AttendanceModel.findOneAndUpdate(
    { _id: id, ...filter, isDeleted: { $ne: true } },
    { $set: { isDeleted: true } },
    { new: true }
  ).select("_id").lean();
  return Boolean(result);
};

export { markAttendance, markAttendanceBulk, getAll, getSummary, getTodayStats, get, update, deleteByID };
