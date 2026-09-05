import { QuarantineLotModel } from "../../model/inventory/quarantine-lot-model";
import { CreditNoteModel } from "../../model/sales/credit-note-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { quarantineLotDto } from "../../utility/dtos/inventory/quarantine-lot-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/inventory/quarantine-lot-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";

const POPULATE: [string, string][] = [
  ["variantId", "variantName sku"],
  ["warehouseId", "name"],
  ["originalInvoiceId", "invoiceNumber"],
  ["customerId", "name"],
  ["productionOrderId", "orderNumber"],
];

const populateAll = async (doc: any) => {
  for (const [field, select] of POPULATE) {
    await doc.populate(field, select);
  }
  return doc;
};

export interface QuarantineListOptions {
  search?: string;
  status?: string;
  warehouseId?: string;
}

export interface QuarantineLineInput {
  variantId: string;
  qty: number;
  productName?: string;
  costPrice?: number;
  unit?: string;
  expiryDate?: Date | string | null;
}

export interface QuarantineSourceMeta {
  warehouseId: string;
  reason?: string;
  sourceType: string;
  sourceRef?: string;
  sourceId: string;
  originalInvoiceId?: string;
  customerId?: string;
  currency?: string;
}

export interface QuarantineResult {
  errorCode: "success" | "not_found" | "insufficient";
  result: quarantineLotDto | null;
}

const generateLotNumber = async (tenant: TenantScope): Promise<string> => {
  const count = await QuarantineLotModel.countDocuments({
    adminId: tenant.adminId,
    merchantId: tenant.merchantId,
  });
  return `QL-${String(count + 1).padStart(6, "0")}`;
};

const addLots = async (
  lines: QuarantineLineInput[],
  meta: QuarantineSourceMeta,
  scope: TenantScope
): Promise<quarantineLotDto[]> => {
  const existing = await QuarantineLotModel.countDocuments({
    sourceId: meta.sourceId,
    sourceType: meta.sourceType,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
  });
  if (existing > 0) {
    return [];
  }

  const created = [];
  for (const line of lines) {
    const qty = Number(line.qty) || 0;
    if (qty <= 0 || !line.variantId) continue;
    const lotNumber = await generateLotNumber(scope);
    const lot = await QuarantineLotModel.create({
      lotNumber,
      status: "Open",
      variantId: line.variantId,
      warehouseId: meta.warehouseId,
      qty,
      remainingQty: qty,
      reason: meta.reason || null,
      sourceType: meta.sourceType,
      sourceRef: meta.sourceRef || null,
      sourceId: meta.sourceId,
      originalInvoiceId: meta.originalInvoiceId || null,
      customerId: meta.customerId || null,
      productName: line.productName || null,
      costPrice: line.costPrice || 0,
      unit: line.unit || null,
      expiryDate: line.expiryDate || null,
      currency: meta.currency || "SAR",
      adminId: scope.adminId,
      merchantId: scope.merchantId,
    });
    await populateAll(lot);
    created.push(mapDbToDto(lot));
  }
  return created;
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: QuarantineListOptions = {}
): Promise<{ totalCount: number; result: quarantineLotDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["lotNumber", "productName", "sourceRef", "reason"]),
    ...buildExactFilters(options as Record<string, unknown>, {
      status: "status",
      warehouseId: "warehouseId",
    }),
  };

  let cursor = QuarantineLotModel.find(query).skip(startIndex).limit(limit).sort({ createdAt: -1 });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  const count = await QuarantineLotModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<quarantineLotDto | null> => {
  let cursor = QuarantineLotModel.findOne({ _id: id, ...filter });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  if (!data) return null;
  const dto = mapDbToDto(data);
  if ((!dto.expiryDate || !dto.unit) && data.sourceId && data.sourceType === "Credit Note") {
    const cn = await CreditNoteModel.findById(data.sourceId).select("products").lean();
    const line = (cn?.products || []).find((p) => String(p.variantId) === String((data.variantId as any)?._id || data.variantId));
    if (line) {
      if (!dto.expiryDate) dto.expiryDate = line.expiryDate || null;
      if (!dto.unit) dto.unit = line.unit || null;
      if (!dto.costPrice) dto.costPrice = line.costPrice || 0;
    }
  }
  return dto;
};

const consume = async (
  lotId: string,
  qty: number,
  productionOrderId: string,
  filter: Record<string, unknown>
): Promise<QuarantineResult> => {
  const take = Number(qty) || 0;
  if (take <= 0) {
    return { errorCode: "insufficient", result: null };
  }

  const lot = await QuarantineLotModel.findOne({ _id: lotId, ...filter });
  if (!lot) {
    return { errorCode: "not_found", result: null };
  }
  if ((lot.remainingQty || 0) < take) {
    return { errorCode: "insufficient", result: null };
  }

  lot.remainingQty = Math.round(((lot.remainingQty || 0) - take) * 1000) / 1000;
  lot.productionOrderId = productionOrderId as any;
  lot.status = (lot.remainingQty || 0) <= 0 ? "Consumed" : "Partial";
  await lot.save();
  await populateAll(lot);
  return { errorCode: "success", result: mapDbToDto(lot) };
};

const restore = async (
  lotId: string,
  qty: number,
  filter: Record<string, unknown>
): Promise<QuarantineResult> => {
  const give = Number(qty) || 0;
  if (give <= 0) {
    return { errorCode: "insufficient", result: null };
  }

  const lot = await QuarantineLotModel.findOne({ _id: lotId, ...filter });
  if (!lot) {
    return { errorCode: "not_found", result: null };
  }

  const cap = Number(lot.qty) || 0;
  lot.remainingQty = Math.min(cap, Math.round(((lot.remainingQty || 0) + give) * 1000) / 1000);
  lot.status = (lot.remainingQty || 0) >= cap ? "Open" : (lot.remainingQty || 0) > 0 ? "Partial" : "Consumed";
  if (lot.status === "Open") lot.productionOrderId = null;
  await lot.save();
  await populateAll(lot);
  return { errorCode: "success", result: mapDbToDto(lot) };
};

export { addLots, getAll, get, consume, restore };
