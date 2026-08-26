import { LeaveTypeModel } from "../../model/leave/leave-type-model";
import { leaveTypeDto } from "../../utility/dtos/leave/leave-type-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/leave/leave-type-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";

interface CreateLeaveTypeInput {
  name: string;
  daysPerYear: number;
  carryForward?: number;
  paid?: boolean;
  requiresDocument?: boolean;
  minNoticeDays?: number;
  maxDaysAtOnce?: number;
  applicableGender?: string;
  status?: string;
}

interface LeaveTypeResult {
  errorCode: "success" | "not_found";
  result: leaveTypeDto | null;
}

const create = async (
  data: CreateLeaveTypeInput,
  scope: TenantScope,
  createdBy: string
): Promise<LeaveTypeResult> => {
  const leaveType = await LeaveTypeModel.create({
    name: data.name,
    daysPerYear: data.daysPerYear,
    carryForward: data.carryForward || 0,
    paid: data.paid ?? true,
    requiresDocument: data.requiresDocument ?? false,
    minNoticeDays: data.minNoticeDays || 0,
    maxDaysAtOnce: data.maxDaysAtOnce || 0,
    applicableGender: data.applicableGender || "all",
    status: data.status || "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  return { errorCode: "success", result: mapDbToDto(leaveType) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number
): Promise<{ totalCount: number; result: leaveTypeDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = { ...filter, isDeleted: { $ne: true } };
  const data = await LeaveTypeModel.find(query).skip(startIndex).limit(limit).sort({ _id: -1 }).lean();
  const count = await LeaveTypeModel.countDocuments(query);
  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<leaveTypeDto | null> => {
  const data = await LeaveTypeModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } }).lean();
  return data ? mapDbToDto(data) : null;
};

const update = async (
  id: string,
  data: Partial<CreateLeaveTypeInput>,
  filter: Record<string, unknown>
): Promise<LeaveTypeResult> => {
  const updated = await LeaveTypeModel.findOneAndUpdate(
    { _id: id, ...filter, isDeleted: { $ne: true } },
    { $set: data },
    { new: true }
  ).lean();
  if (!updated) return { errorCode: "not_found", result: null };
  return { errorCode: "success", result: mapDbToDto(updated) };
};

const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<boolean> => {
  const result = await LeaveTypeModel.findOneAndUpdate(
    { _id: id, ...filter, isDeleted: { $ne: true } },
    { $set: { isDeleted: true } },
    { new: true }
  ).select("_id").lean();
  return Boolean(result);
};

export { create, getAll, get, update, deleteByID };
