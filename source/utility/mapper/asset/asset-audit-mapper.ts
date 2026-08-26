import { assetAuditDto, assetAuditResultDto } from "../../dtos/asset/asset-audit-dto";
import { IAssetAuditModel } from "../../../model/asset/asset-audit-model";

const populatedField = <T extends Record<string, unknown>>(value: unknown): T | null => {
  return value && typeof value === "object" && "_id" in (value as Record<string, unknown>) ? (value as T) : null;
};

const mapDbToDto = (dbModel: IAssetAuditModel): assetAuditDto => {
  const results: assetAuditResultDto[] = (dbModel.results || []).map((r: any) => {
    const asset = populatedField<{ _id: unknown; name?: string; assetTag?: string }>(r.assetId);
    return {
      assetId: asset ? String(asset._id) : r.assetId ? String(r.assetId) : "",
      assetName: asset?.name || null,
      assetTag: asset?.assetTag || null,
      status: r.status || null,
      notes: r.notes || null,
      checkedAt: r.checkedAt || null,
    };
  });

  return {
    id: dbModel._id ? String(dbModel._id) : "",
    startedAt: dbModel.startedAt || null,
    startedBy: dbModel.startedBy ? String(dbModel.startedBy) : null,
    status: dbModel.status || null,
    completedAt: dbModel.completedAt || null,
    results,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IAssetAuditModel[]): assetAuditDto[] => dbModels.map(mapDbToDto);

export { mapDbToDto, mapDbListToDtoList };
