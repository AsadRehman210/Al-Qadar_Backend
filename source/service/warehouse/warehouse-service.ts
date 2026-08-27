import { WarehouseModel } from "../../model/warehouse/warehouse-model";
import { StockLevelModel } from "../../model/warehouse/stock-level-model";
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

// Tenant-scoped, gap-safe: based on the highest existing numeric suffix for
// this adminId/merchantId, not a plain count — a warehouse can be deleted
// (see deleteByID below), so a count-based scheme could regenerate a code
// that collides with one still in use.
const generateWarehouseCode = async (scope: TenantScope): Promise<string> => {
  const last = await WarehouseModel.findOne({ adminId: scope.adminId, merchantId: scope.merchantId })
    .sort({ code: -1 })
    .select("code")
    .lean();
  const lastNum = last?.code ? parseInt(last.code.replace(/\D/g, ""), 10) || 0 : 0;
  return `WH-${String(lastNum + 1).padStart(4, "0")}`;
};

const create = async (
  data: CreateWarehouseInput,
  scope: TenantScope,
  createdBy: string
): Promise<WarehouseResult> => {
  const code = await generateWarehouseCode(scope);

  const warehouse = await WarehouseModel.create({
    code,
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

export interface WarehouseSummary {
  totalWarehouses: number;
  activeWarehouses: number;
  totalCapacity: number;
  totalStockItems: number;
}

// Filter-aware, not tenant-wide: computed over the exact same `query` as the
// paginated list (search + status included) so the stat cards track whatever
// the user is currently filtered to, not the whole tenant regardless of it.
// Pulled from an unpaginated fetch of every matching warehouse rather than a
// separate Mongo aggregation — one query, and capacity/active are then just
// a JS reduce over a result set already small enough to hold in memory.
const computeSummary = async (query: Record<string, unknown>): Promise<WarehouseSummary> => {
  const matching = await WarehouseModel.find(query).select("_id status capacity").lean();

  const totalWarehouses = matching.length;
  const activeWarehouses = matching.filter((w) => w.status === "Active").length;
  const totalCapacity = matching.reduce((sum, w) => sum + (w.capacity || 0), 0);

  const warehouseIds = matching.map((w) => w._id);
  const totalStockItems = warehouseIds.length
    ? await StockLevelModel.countDocuments({ warehouseId: { $in: warehouseIds }, qty: { $gt: 0 } })
    : 0;

  return { totalWarehouses, activeWarehouses, totalCapacity, totalStockItems };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: WarehouseListOptions = {}
): Promise<{ totalCount: number; result: warehouseDto[]; summary: WarehouseSummary }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["name", "code"]),
    ...buildExactFilters(options as Record<string, unknown>, { status: "status" }),
  };

  const [data, count, summary] = await Promise.all([
    WarehouseModel.find(query).skip(startIndex).limit(limit).sort({ name: 1 }).lean(),
    WarehouseModel.countDocuments(query),
    computeSummary(query),
  ]);

  return { totalCount: count, result: mapDbListToDtoList(data), summary };
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
