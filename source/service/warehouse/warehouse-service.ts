import { WarehouseModel } from "../../model/warehouse/warehouse-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { warehouseDto } from "../../utility/dtos/warehouse/warehouse-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/warehouse/warehouse-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { hasWarehouseStock } from "./stock-level-service";

export interface WarehouseListOptions {
  search?: string;
  status?: string;
}

interface CreateWarehouseInput {
  code: string;
  name: string;
  location?: string;
  manager?: string;
  capacity?: number;
  unit?: string;
  description?: string;
  status?: string;
}

interface WarehouseResult {
  errorCode: "success" | "not_found" | "duplicate_code" | "has_stock";
  result: warehouseDto | null;
}

const create = async (
  data: CreateWarehouseInput,
  scope: TenantScope,
  createdBy: string
): Promise<WarehouseResult> => {
  const existing = await WarehouseModel.findOne({
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    code: data.code,
  }).select("_id").lean();
  if (existing) {
    return { errorCode: "duplicate_code", result: null };
  }

  const warehouse = await WarehouseModel.create({
    code: data.code,
    name: data.name,
    location: data.location || null,
    manager: data.manager || null,
    capacity: data.capacity ?? null,
    unit: data.unit || "sqm",
    description: data.description || null,
    status: data.status || "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  return { errorCode: "success", result: mapDbToDto(warehouse) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: WarehouseListOptions = {}
): Promise<{ totalCount: number; result: warehouseDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["name", "code"]),
    ...buildExactFilters(options as Record<string, unknown>, { status: "status" }),
  };

  const data = await WarehouseModel.find(query).skip(startIndex).limit(limit).sort({ name: 1 }).lean();
  const count = await WarehouseModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<warehouseDto | null> => {
  const data = await WarehouseModel.findOne({ _id: id, ...filter }).lean();
  return data ? mapDbToDto(data) : null;
};

// Only these fields are ever writable through this endpoint — data was
// previously spread wholesale into $set, meaning a body carrying adminId/
// merchantId/createdBy (or any other schema field) could silently reassign
// tenant ownership of the warehouse. Allowlisted instead of blocklisted so
// a future schema field is safe-by-default (excluded) until explicitly added here.
const UPDATABLE_FIELDS: (keyof CreateWarehouseInput)[] = [
  "code",
  "name",
  "location",
  "manager",
  "capacity",
  "unit",
  "description",
  "status",
];

const update = async (
  id: string,
  data: Partial<CreateWarehouseInput>,
  filter: Record<string, unknown>
): Promise<WarehouseResult> => {
  const updatePayload: Record<string, unknown> = {};
  UPDATABLE_FIELDS.forEach((key) => {
    if (data[key] !== undefined) updatePayload[key] = data[key];
  });

  const updated = await WarehouseModel.findOneAndUpdate(
    { _id: id, ...filter },
    { $set: updatePayload },
    { new: true }
  ).lean();

  if (!updated) {
    return { errorCode: "not_found", result: null };
  }
  return { errorCode: "success", result: mapDbToDto(updated) };
};

// Blocked (409) while any StockLevel.qty > 0 remains for this warehouse.
// Scope for the stock check is derived from the found document itself
// (its own adminId/merchantId), not re-derived from the request — safe
// regardless of which role (admin/merchant/super_admin) issued the delete.
const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<WarehouseResult> => {
  const warehouse = await WarehouseModel.findOne({ _id: id, ...filter }).lean();
  if (!warehouse) {
    return { errorCode: "not_found", result: null };
  }
  const scope: TenantScope = {
    adminId: warehouse.adminId ? String(warehouse.adminId) : null,
    merchantId: warehouse.merchantId ? String(warehouse.merchantId) : null,
  };
  const hasStock = await hasWarehouseStock(scope, id);
  if (hasStock) {
    return { errorCode: "has_stock", result: null };
  }
  await WarehouseModel.deleteOne({ _id: id });
  return { errorCode: "success", result: mapDbToDto(warehouse) };
};

export { create, getAll, get, update, deleteByID };
