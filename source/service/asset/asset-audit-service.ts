import { AssetAuditModel } from "../../model/asset/asset-audit-model";
import { AssetModel } from "../../model/asset/asset-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { assetAuditDto } from "../../utility/dtos/asset/asset-audit-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/asset/asset-audit-mapper";

const POPULATE: [string, string] = ["results.assetId", "name assetTag"];

const populateAll = async (doc: any) => doc.populate(...POPULATE);

type AssetAuditErrorCode = "success" | "not_found" | "already_active" | "already_completed" | "result_not_found";

interface AssetAuditResult {
  errorCode: AssetAuditErrorCode;
  result: assetAuditDto | null;
}

// One session snapshots every non-Disposed asset at the moment it starts —
// mirrors the frontend's own startAssetAudit exactly (assetFakeData.js),
// now a real, persisted checklist instead of an in-memory mock.
const start = async (scope: TenantScope, startedBy: string): Promise<AssetAuditResult> => {
  const active = await AssetAuditModel.findOne({ adminId: scope.adminId, merchantId: scope.merchantId, status: "In Progress" }).lean();
  if (active) {
    return { errorCode: "already_active", result: null };
  }

  const assets = await AssetModel.find({ adminId: scope.adminId, merchantId: scope.merchantId, status: { $ne: "Disposed" } }).lean();
  const audit = await AssetAuditModel.create({
    startedAt: new Date(),
    startedBy,
    status: "In Progress",
    results: assets.map((a) => ({ assetId: a._id, status: "Pending", notes: null, checkedAt: null })),
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy: startedBy,
  });
  await populateAll(audit);
  return { errorCode: "success", result: mapDbToDto(audit) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number
): Promise<{ totalCount: number; result: assetAuditDto[] }> => {
  const startIndex = (page - 1) * limit;
  let cursor = AssetAuditModel.find(filter).skip(startIndex).limit(limit).sort({ createdAt: -1 });
  cursor = cursor.populate(...POPULATE) as any;
  const data = await cursor.lean();
  const count = await AssetAuditModel.countDocuments(filter);
  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<assetAuditDto | null> => {
  const data = await AssetAuditModel.findOne({ _id: id, ...filter }).populate(...POPULATE).lean();
  return data ? mapDbToDto(data) : null;
};

const getActive = async (filter: Record<string, unknown>): Promise<assetAuditDto | null> => {
  const data = await AssetAuditModel.findOne({ ...filter, status: "In Progress" }).populate(...POPULATE).lean();
  return data ? mapDbToDto(data) : null;
};

interface RecordResultInput {
  status: "Verified" | "Missing" | "Damaged" | "Pending";
  notes?: string;
}

const recordResult = async (
  id: string,
  assetId: string,
  data: RecordResultInput,
  filter: Record<string, unknown>
): Promise<AssetAuditResult> => {
  const audit = await AssetAuditModel.findOne({ _id: id, ...filter });
  if (!audit) {
    return { errorCode: "not_found", result: null };
  }
  if (audit.status !== "In Progress") {
    return { errorCode: "already_completed", result: null };
  }
  const entry = audit.results.find((r) => String(r.assetId) === assetId);
  if (!entry) {
    return { errorCode: "result_not_found", result: null };
  }
  entry.status = data.status;
  entry.notes = data.notes || null;
  entry.checkedAt = new Date();
  await audit.save();
  await populateAll(audit);
  return { errorCode: "success", result: mapDbToDto(audit) };
};

const complete = async (id: string, filter: Record<string, unknown>): Promise<AssetAuditResult> => {
  const audit = await AssetAuditModel.findOne({ _id: id, ...filter });
  if (!audit) {
    return { errorCode: "not_found", result: null };
  }
  if (audit.status !== "In Progress") {
    return { errorCode: "already_completed", result: null };
  }
  audit.status = "Completed";
  audit.completedAt = new Date();
  await audit.save();
  await populateAll(audit);
  return { errorCode: "success", result: mapDbToDto(audit) };
};

export { start, getAll, get, getActive, recordResult, complete };
