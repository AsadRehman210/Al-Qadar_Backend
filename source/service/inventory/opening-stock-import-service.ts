import { AccountModel } from "../../model/account/account-model";
import { CategoryModel } from "../../model/inventory/category-model";
import { ProductModel } from "../../model/inventory/product-model";
import { VariantModel } from "../../model/inventory/variant-model";
import { WarehouseModel } from "../../model/warehouse/warehouse-model";
import { SupplierModel } from "../../model/purchase/supplier-model";
import { TenantScope, RequestUser } from "../../utility/helper/tenant-scope";
import { AccountRole } from "../../utility/helper/constants/enum";
import * as categoryService from "./category-service";
import * as productService from "./product-service";
import * as variantService from "./variant-service";
import * as supplierService from "../purchase/supplier-service";
import * as purchaseInvoiceService from "../purchase/purchase-invoice-service";

export interface OpeningStockRowInput {
  sku?: unknown;
  productName?: unknown;
  productType?: unknown;
  category?: unknown;
  variantName?: unknown;
  unit?: unknown;
  warehouseCode?: unknown;
  qty?: unknown;
  unitCost?: unknown;
  expiryDate?: unknown;
  supplierName?: unknown;
}

export interface OpeningStockRowError {
  row: number;
  message: string;
}

export interface OpeningStockStatus {
  imported: boolean;
  importedAt: Date | null;
}

type ProductTypeValue = "Finished Product" | "Raw Material";

interface NormalizedRow {
  excelRow: number;
  sku: string;
  productName: string;
  productType: ProductTypeValue;
  category: string;
  variantName: string;
  unit: string;
  warehouseCode: string;
  qty: number;
  unitCost: number;
  expiryDate?: string;
  supplierName: string;
}

const DEFAULT_SUPPLIER_NAME = "Opening stock";
const OPENING_NOTES = "Opening stock import";

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const trimStr = (value: unknown): string => (value === null || value === undefined ? "" : String(value).trim());

const nameEquals = (name: string) => ({ $regex: new RegExp(`^${escapeRegex(name)}$`, "i") });

const tenantQuery = (scope: TenantScope) => ({
  adminId: scope.adminId || null,
  merchantId: scope.merchantId || null,
});

const normalizeProductType = (raw: string): ProductTypeValue | null => {
  const s = raw.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (["raw material", "raw", "rawmaterial"].includes(s)) return "Raw Material";
  if (["finished product", "finished", "final product", "finalproduct", "finished good", "finished goods"].includes(s)) {
    return "Finished Product";
  }
  return null;
};

const toInvoiceProductType = (type: ProductTypeValue): "raw_material" | "final_product" =>
  type === "Raw Material" ? "raw_material" : "final_product";

const toIsoDate = (value: unknown): string | null => {
  if (value === "" || value === null || value === undefined) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const epoch = Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000;
    return new Date(epoch).toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return n;
};

const resolveImportScope = async (
  user: RequestUser,
  body: { adminId?: string | null; merchantId?: string | null }
): Promise<TenantScope | null> => {
  if (user.role === AccountRole.merchant) {
    return { adminId: user.adminId || null, merchantId: user.id };
  }
  if (user.role === AccountRole.admin) {
    return { adminId: user.id, merchantId: null };
  }

  if (body.merchantId) {
    const merchant = await AccountModel.findOne({
      _id: body.merchantId,
      role: AccountRole.merchant,
    }).select("_id adminId").lean();
    if (!merchant) return null;
    return {
      adminId: merchant.adminId ? String(merchant.adminId) : null,
      merchantId: String(merchant._id),
    };
  }
  if (body.adminId) {
    const admin = await AccountModel.findOne({
      _id: body.adminId,
      role: AccountRole.admin,
    }).select("_id").lean();
    if (!admin) return null;
    return { adminId: String(admin._id), merchantId: null };
  }
  return null;
};

const getTenantAccount = async (scope: TenantScope) => {
  const id = scope.merchantId || scope.adminId;
  if (!id) return null;
  return AccountModel.findById(id);
};

const normalizeRows = (rows: OpeningStockRowInput[]): { normalized: NormalizedRow[]; errors: OpeningStockRowError[] } => {
  const errors: OpeningStockRowError[] = [];
  const normalized: NormalizedRow[] = [];
  const skuOwners = new Map<string, string>();

  rows.forEach((raw, index) => {
    const excelRow = index + 2;
    const sku = trimStr(raw.sku);
    const productName = trimStr(raw.productName);
    const productType = normalizeProductType(trimStr(raw.productType));
    const category = trimStr(raw.category);
    const warehouseCode = trimStr(raw.warehouseCode);
    const qty = toNumber(raw.qty);
    const unitCost = toNumber(raw.unitCost);
    const expiryRaw = raw.expiryDate;
    const expiryDate = toIsoDate(expiryRaw);

    const rowErrors: string[] = [];
    if (!sku) rowErrors.push("sku is required.");
    if (!productName) rowErrors.push("productName is required.");
    if (!productType) rowErrors.push("productType must be Raw Material or Finished Product.");
    if (!category) rowErrors.push("category is required.");
    if (!warehouseCode) rowErrors.push("warehouseCode is required.");
    if (!Number.isFinite(qty) || qty <= 0) rowErrors.push("qty must be a number greater than zero.");
    if (!Number.isFinite(unitCost) || unitCost < 0) rowErrors.push("unitCost must be a number zero or greater.");
    if (expiryRaw !== "" && expiryRaw !== null && expiryRaw !== undefined && expiryDate === "") {
      rowErrors.push("expiryDate is not a valid date.");
    }

    const skuKey = sku.toLowerCase();
    if (skuKey && skuOwners.has(skuKey) && skuOwners.get(skuKey) !== productName.toLowerCase()) {
      rowErrors.push("sku is used with a different productName in this file.");
    } else if (skuKey && productName) {
      skuOwners.set(skuKey, productName.toLowerCase());
    }

    if (rowErrors.length) {
      errors.push({ row: excelRow, message: rowErrors.join(" ") });
      return;
    }

    normalized.push({
      excelRow,
      sku,
      productName,
      productType: productType as ProductTypeValue,
      category,
      variantName: trimStr(raw.variantName) || productName,
      unit: trimStr(raw.unit) || "pcs",
      warehouseCode,
      qty,
      unitCost,
      expiryDate: expiryDate || undefined,
      supplierName: trimStr(raw.supplierName) || DEFAULT_SUPPLIER_NAME,
    });
  });

  return { normalized, errors };
};

const uniquePhone = async (scope: TenantScope, name: string): Promise<string> => {
  const slug = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12) || "OPENING";
  let phone = `OS-${slug}`;
  let n = 0;
  while (
    await SupplierModel.findOne({
      ...tenantQuery(scope),
      phone,
    }).select("_id").lean()
  ) {
    n += 1;
    phone = `OS-${slug}-${n}`;
  }
  return phone;
};

const ensureCategory = async (
  cache: Map<string, string>,
  name: string,
  scope: TenantScope,
  actor: string
): Promise<string> => {
  const key = name.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const existing = await CategoryModel.findOne({ ...tenantQuery(scope), name: nameEquals(name) }).select("_id").lean();
  if (existing) {
    const id = String(existing._id);
    cache.set(key, id);
    return id;
  }
  const created = await categoryService.create({ name, status: "Active" }, scope, actor);
  const id = created.result?.id as string;
  cache.set(key, id);
  return id;
};

const ensureProduct = async (
  cache: Map<string, { id: string; productType: ProductTypeValue }>,
  name: string,
  categoryId: string,
  productType: ProductTypeValue,
  scope: TenantScope,
  actor: string
): Promise<{ id: string; productType: ProductTypeValue }> => {
  const key = name.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const existing = await ProductModel.findOne({
    ...tenantQuery(scope),
    productName: nameEquals(name),
  }).select("_id productType").lean();
  if (existing) {
    const value = {
      id: String(existing._id),
      productType: (existing.productType as ProductTypeValue) || "Finished Product",
    };
    cache.set(key, value);
    return value;
  }
  const created = await productService.create(
    { productName: name, categoryId, productType, status: "Active" },
    scope,
    actor
  );
  const value = { id: created.result?.id as string, productType };
  cache.set(key, value);
  return value;
};

const ensureVariant = async (
  bySku: Map<string, string>,
  data: { sku: string; productId: string; variantName: string; unit: string; unitCost: number },
  scope: TenantScope,
  actor: string
): Promise<string> => {
  const key = data.sku.toLowerCase();
  const cached = bySku.get(key);
  if (cached) return cached;
  const existing = await VariantModel.findOne({
    ...tenantQuery(scope),
    sku: nameEquals(data.sku),
  }).select("_id").lean();
  if (existing) {
    const id = String(existing._id);
    bySku.set(key, id);
    return id;
  }
  const created = await variantService.create(
    {
      productId: data.productId,
      variantName: data.variantName,
      sku: data.sku,
      unit: data.unit,
      costPrice: data.unitCost,
      salePrice: 0,
    },
    scope,
    actor
  );
  if (created.errorCode === "duplicate_sku") {
    const again = await VariantModel.findOne({ ...tenantQuery(scope), sku: nameEquals(data.sku) }).select("_id").lean();
    const id = String(again?._id);
    bySku.set(key, id);
    return id;
  }
  const id = created.result?.id as string;
  bySku.set(key, id);
  return id;
};

const ensureSupplier = async (
  cache: Map<string, string>,
  name: string,
  scope: TenantScope,
  actor: string
): Promise<string> => {
  const key = name.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const existing = await SupplierModel.findOne({ ...tenantQuery(scope), name: nameEquals(name) }).select("_id").lean();
  if (existing) {
    const id = String(existing._id);
    cache.set(key, id);
    return id;
  }
  const created = await supplierService.create(
    { name, phone: await uniquePhone(scope, name), status: "Active" },
    scope,
    actor
  );
  if (created.errorCode === "duplicate_phone") {
    const retry = await supplierService.create(
      { name, phone: await uniquePhone(scope, `${name}-X`), status: "Active" },
      scope,
      actor
    );
    const id = retry.result?.id as string;
    cache.set(key, id);
    return id;
  }
  const id = created.result?.id as string;
  cache.set(key, id);
  return id;
};

const getStatus = async (
  user: RequestUser,
  query: { adminId?: string; merchantId?: string }
): Promise<{ errorCode: string; result: OpeningStockStatus | null }> => {
  const scope = await resolveImportScope(user, query);
  if (!scope) {
    return { errorCode: "tenant_required", result: null };
  }
  const account = await getTenantAccount(scope);
  if (!account) {
    return { errorCode: "not_found", result: null };
  }
  return {
    errorCode: "success",
    result: {
      imported: Boolean(account.openingStockImported),
      importedAt: account.openingStockImportedAt || null,
    },
  };
};

const importRows = async (
  user: RequestUser,
  body: { rows?: OpeningStockRowInput[]; date?: string; adminId?: string; merchantId?: string },
  actor: string
): Promise<{
  errorCode: string;
  result: { imported: boolean; importedAt: Date | null; invoiceCount: number; rowCount: number } | null;
  errors: OpeningStockRowError[];
}> => {
  const empty = { imported: false, importedAt: null, invoiceCount: 0, rowCount: 0 };
  const scope = await resolveImportScope(user, body);
  if (!scope) {
    return { errorCode: "tenant_required", result: null, errors: [] };
  }

  const account = await getTenantAccount(scope);
  if (!account) {
    return { errorCode: "not_found", result: null, errors: [] };
  }
  if (account.openingStockImported) {
    return { errorCode: "already_imported", result: null, errors: [] };
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) {
    return { errorCode: "invalid", result: empty, errors: [{ row: 0, message: "No rows to import." }] };
  }

  const { normalized, errors } = normalizeRows(rows);
  if (errors.length) {
    return { errorCode: "invalid", result: empty, errors };
  }

  const warehouses = await WarehouseModel.find(tenantQuery(scope)).select("_id code").lean();
  const warehouseByCode = new Map(warehouses.map((w) => [String(w.code || "").toLowerCase(), String(w._id)]));
  const missingWarehouse: OpeningStockRowError[] = [];
  for (const row of normalized) {
    if (!warehouseByCode.has(row.warehouseCode.toLowerCase())) {
      missingWarehouse.push({
        row: row.excelRow,
        message: `Warehouse code "${row.warehouseCode}" was not found. Create the warehouse first.`,
      });
    }
  }
  if (missingWarehouse.length) {
    return { errorCode: "invalid", result: empty, errors: missingWarehouse };
  }

  const invoiceDate = body.date && /^\d{4}-\d{2}-\d{2}/.test(body.date)
    ? body.date.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const currency = account.currency || "SAR";

  const categoryCache = new Map<string, string>();
  const productCache = new Map<string, { id: string; productType: ProductTypeValue }>();
  const variantBySku = new Map<string, string>();
  const supplierCache = new Map<string, string>();

  type PreparedLine = NormalizedRow & {
    warehouseId: string;
    supplierId: string;
    variantId: string;
  };
  const prepared: PreparedLine[] = [];

  for (const row of normalized) {
    const categoryId = await ensureCategory(categoryCache, row.category, scope, actor);
    const product = await ensureProduct(productCache, row.productName, categoryId, row.productType, scope, actor);
    const variantId = await ensureVariant(
      variantBySku,
      {
        sku: row.sku,
        productId: product.id,
        variantName: row.variantName,
        unit: row.unit,
        unitCost: row.unitCost,
      },
      scope,
      actor
    );
    const supplierId = await ensureSupplier(supplierCache, row.supplierName, scope, actor);
    prepared.push({
      ...row,
      warehouseId: warehouseByCode.get(row.warehouseCode.toLowerCase()) as string,
      supplierId,
      variantId,
    });
  }

  const groups = new Map<string, PreparedLine[]>();
  for (const line of prepared) {
    const key = `${line.supplierId}|${line.warehouseId}|${line.productType}`;
    const list = groups.get(key) || [];
    list.push(line);
    groups.set(key, list);
  }

  const filter = tenantQuery(scope);
  let invoiceCount = 0;
  for (const [, lines] of groups) {
    const first = lines[0];
    const created = await purchaseInvoiceService.create(
      {
        supplierId: first.supplierId,
        date: invoiceDate,
        warehouseId: first.warehouseId,
        receiverName: OPENING_NOTES,
        productType: toInvoiceProductType(first.productType),
        products: lines.map((line) => ({
          variantId: line.variantId,
          qty: line.qty,
          price: line.unitCost,
          unit: line.unit,
          expiryDate: line.expiryDate,
        })),
        taxPercent: 0,
        taxRecoverable: false,
        notes: OPENING_NOTES,
        currency,
        status: "Draft",
      },
      scope,
      actor
    );
    const invoiceId = created.result?.id;
    if (!invoiceId) {
      return {
        errorCode: "failed",
        result: null,
        errors: [{ row: first.excelRow, message: "Could not create the opening purchase invoice." }],
      };
    }
    const received = await purchaseInvoiceService.updateStatus(invoiceId, "Received", filter, actor);
    if (received.errorCode !== "success") {
      return {
        errorCode: "failed",
        result: null,
        errors: [{ row: first.excelRow, message: "Could not receive the opening purchase invoice." }],
      };
    }
    invoiceCount += 1;
  }

  const importedAt = new Date();
  account.openingStockImported = true;
  account.openingStockImportedAt = importedAt;
  await account.save();

  return {
    errorCode: "success",
    result: {
      imported: true,
      importedAt,
      invoiceCount,
      rowCount: prepared.length,
    },
    errors: [],
  };
};

export { getStatus, importRows, resolveImportScope };
