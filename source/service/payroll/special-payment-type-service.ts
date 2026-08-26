import { SpecialPaymentTypeModel } from "../../model/payroll/special-payment-type-model";
import { specialPaymentTypeDto } from "../../utility/dtos/payroll/special-payment-type-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/payroll/special-payment-type-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";

interface CreateTypeInput {
  name: string;
  description?: string;
  icon?: string;
  amountMode?: string;
  amountValue: number;
}

interface TypeResult {
  errorCode: "success" | "not_found";
  result: specialPaymentTypeDto | null;
}

const create = async (data: CreateTypeInput, scope: TenantScope, createdBy: string): Promise<TypeResult> => {
  const type = await SpecialPaymentTypeModel.create({
    name: data.name,
    description: data.description || null,
    icon: data.icon || null,
    amountMode: data.amountMode || "fixed",
    amountValue: data.amountValue,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  return { errorCode: "success", result: mapDbToDto(type) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number
): Promise<{ totalCount: number; result: specialPaymentTypeDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = { ...filter, isDeleted: { $ne: true } };
  const data = await SpecialPaymentTypeModel.find(query).skip(startIndex).limit(limit).sort({ _id: -1 }).lean();
  const count = await SpecialPaymentTypeModel.countDocuments(query);
  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<specialPaymentTypeDto | null> => {
  const data = await SpecialPaymentTypeModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } }).lean();
  return data ? mapDbToDto(data) : null;
};

const update = async (
  id: string,
  data: Partial<CreateTypeInput>,
  filter: Record<string, unknown>
): Promise<TypeResult> => {
  const updated = await SpecialPaymentTypeModel.findOneAndUpdate(
    { _id: id, ...filter, isDeleted: { $ne: true } },
    { $set: data },
    { new: true }
  ).lean();
  if (!updated) return { errorCode: "not_found", result: null };
  return { errorCode: "success", result: mapDbToDto(updated) };
};

const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<boolean> => {
  const result = await SpecialPaymentTypeModel.findOneAndUpdate(
    { _id: id, ...filter, isDeleted: { $ne: true } },
    { $set: { isDeleted: true } },
    { new: true }
  ).select("_id").lean();
  return Boolean(result);
};

export { create, getAll, get, update, deleteByID };
