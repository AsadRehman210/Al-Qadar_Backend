import { CategoryModel } from "../../model/inventory/category-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { categoryDto } from "../../utility/dtos/inventory/category-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/inventory/category-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";

export interface CategoryListOptions {
  search?: string;
  status?: string;
}

interface CreateCategoryInput {
  name: string;
  description?: string;
  status?: string;
}

interface CategoryResult {
  errorCode: "success" | "not_found";
  result: categoryDto | null;
}

const create = async (
  data: CreateCategoryInput,
  scope: TenantScope,
  createdBy: string
): Promise<CategoryResult> => {
  const category = await CategoryModel.create({
    name: data.name,
    description: data.description || null,
    status: data.status || "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  return { errorCode: "success", result: mapDbToDto(category) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: CategoryListOptions = {}
): Promise<{ totalCount: number; result: categoryDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["name"]),
    ...buildExactFilters(options as Record<string, unknown>, { status: "status" }),
  };

  const data = await CategoryModel.find(query).skip(startIndex).limit(limit).sort({ name: 1 }).lean();
  const count = await CategoryModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<categoryDto | null> => {
  const data = await CategoryModel.findOne({ _id: id, ...filter }).lean();
  return data ? mapDbToDto(data) : null;
};

const update = async (
  id: string,
  data: Partial<CreateCategoryInput>,
  filter: Record<string, unknown>
): Promise<CategoryResult> => {
  const updatePayload: Record<string, unknown> = {};
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.description !== undefined) updatePayload.description = data.description;
  if (data.status !== undefined) updatePayload.status = data.status;

  const updated = await CategoryModel.findOneAndUpdate(
    { _id: id, ...filter },
    { $set: updatePayload },
    { new: true }
  ).lean();

  if (!updated) {
    return { errorCode: "not_found", result: null };
  }
  return { errorCode: "success", result: mapDbToDto(updated) };
};

const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<CategoryResult> => {
  const deleted = await CategoryModel.findOne({ _id: id, ...filter }).lean();
  if (!deleted) {
    return { errorCode: "not_found", result: null };
  }
  await CategoryModel.deleteOne({ _id: id });
  return { errorCode: "success", result: mapDbToDto(deleted) };
};

export { create, getAll, get, update, deleteByID };
