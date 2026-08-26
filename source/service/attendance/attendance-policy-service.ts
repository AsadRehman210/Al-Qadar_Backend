import moment from "moment";
import { AttendancePolicyModel, IAttendancePolicyRules } from "../../model/attendance/attendance-policy-model";
import { attendancePolicyDto } from "../../utility/dtos/attendance/attendance-policy-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/attendance/attendance-policy-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";

interface CreateAttendancePolicyInput {
  name: string;
  implementedDate: string;
  salaryCalculationDays?: number;
  notes?: string;
  rules?: IAttendancePolicyRules;
}

type AttendancePolicyErrorCode = "success" | "not_found" | "is_historical" | "invalid_implemented_date";

interface AttendancePolicyResult {
  errorCode: AttendancePolicyErrorCode;
  result: attendancePolicyDto | null;
}

// Auto-closes the tenant's existing current policy (endDate: null) the same
// way salary-service.ts closes an employee's prior salary record — the
// client never has to remember to do this itself.
const create = async (
  data: CreateAttendancePolicyInput,
  scope: TenantScope,
  createdBy: string
): Promise<AttendancePolicyResult> => {
  const current = await AttendancePolicyModel.findOne({
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    endDate: null,
  });
  if (current) {
    // New implementedDate must be strictly after the current policy's own
    // start, or `dayBefore` lands before it — an inverted endDate <
    // implementedDate window on the record being closed (same bug class as
    // salary-service.ts's identical auto-close, fixed in the same pass).
    if (!moment(data.implementedDate).isAfter(moment(current.implementedDate), "day")) {
      return { errorCode: "invalid_implemented_date", result: null };
    }
    const dayBefore = moment(data.implementedDate).subtract(1, "day").toDate();
    current.endDate = dayBefore;
    await current.save();
  }

  const policy = await AttendancePolicyModel.create({
    name: data.name,
    implementedDate: new Date(data.implementedDate),
    endDate: null,
    salaryCalculationDays: data.salaryCalculationDays ?? 30,
    notes: data.notes || null,
    rules: data.rules || {},
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapDbToDto(policy) };
};

const getAll = async (filter: Record<string, unknown>): Promise<attendancePolicyDto[]> => {
  const data = await AttendancePolicyModel.find(filter).sort({ implementedDate: -1 }).lean();
  return mapDbListToDtoList(data);
};

const getById = async (id: string, filter: Record<string, unknown>): Promise<attendancePolicyDto | null> => {
  const data = await AttendancePolicyModel.findOne({ _id: id, ...filter }).lean();
  return data ? mapDbToDto(data) : null;
};

const getCurrentPolicy = async (filter: Record<string, unknown>): Promise<attendancePolicyDto | null> => {
  const data = await AttendancePolicyModel.findOne({ ...filter, endDate: null }).lean();
  return data ? mapDbToDto(data) : null;
};

// Only usable while a policy is still current — editing closed history would
// silently rewrite the past, so it's rejected outright.
const update = async (
  id: string,
  data: Partial<CreateAttendancePolicyInput>,
  filter: Record<string, unknown>
): Promise<AttendancePolicyResult> => {
  const existing = await AttendancePolicyModel.findOne({ _id: id, ...filter }).select("endDate").lean();
  if (!existing) {
    return { errorCode: "not_found", result: null };
  }
  if (existing.endDate !== null) {
    return { errorCode: "is_historical", result: null };
  }

  const updated = await AttendancePolicyModel.findOneAndUpdate(
    { _id: id, ...filter },
    { $set: data },
    { new: true }
  ).lean();

  if (!updated) {
    return { errorCode: "not_found", result: null };
  }
  return { errorCode: "success", result: mapDbToDto(updated) };
};

export { create, getAll, getById, getCurrentPolicy, update };
