import {
  assetDto,
  assignmentHistoryDto,
  maintenanceRecordDto,
  insuranceDto,
  disposalDto,
  locationHistoryDto,
  assetDocumentDto,
} from "../../dtos/asset/asset-dto";
import { IAssetModel } from "../../../model/asset/asset-model";

const populatedField = <T extends Record<string, unknown>>(value: unknown): T | null => {
  return value && typeof value === "object" && "_id" in (value as Record<string, unknown>) ? (value as T) : null;
};

const employeeFullName = (emp: { first_name?: string; last_name?: string } | null): string | null => {
  if (!emp) return null;
  return [emp.first_name, emp.last_name].filter(Boolean).join(" ") || null;
};

const mapDbToDto = (dbModel: IAssetModel): assetDto => {
  const category = populatedField<{ _id: unknown; code?: string; name?: string }>(dbModel.categoryId);
  const assignedTo = populatedField<{ _id: unknown; first_name?: string; last_name?: string }>(dbModel.assignedToId);

  const assignmentHistory: assignmentHistoryDto[] = (dbModel.assignmentHistory || []).map((h: any) => {
    const emp = populatedField<{ _id: unknown; first_name?: string; last_name?: string }>(h.employeeId);
    return {
      id: h._id ? String(h._id) : "",
      employeeId: emp ? String(emp._id) : h.employeeId ? String(h.employeeId) : null,
      employeeName: employeeFullName(emp),
      assignedDate: h.assignedDate || null,
      returnDate: h.returnDate || null,
      notes: h.notes || null,
      assignedBy: h.assignedBy ? String(h.assignedBy) : null,
    };
  });

  const maintenanceHistory: maintenanceRecordDto[] = (dbModel.maintenanceHistory || []).map((m: any) => ({
    id: m._id ? String(m._id) : "",
    date: m.date || null,
    type: m.type || null,
    description: m.description || null,
    cost: m.cost || 0,
    vendor: m.vendor || null,
    status: m.status || null,
    nextMaintenanceDate: m.nextMaintenanceDate || null,
  }));

  const insurance: insuranceDto | null = dbModel.insurance
    ? {
        policyNo: dbModel.insurance.policyNo || null,
        provider: dbModel.insurance.provider || null,
        startDate: dbModel.insurance.startDate || null,
        expiryDate: dbModel.insurance.expiryDate || null,
        premiumAmount: dbModel.insurance.premiumAmount || 0,
        coverageAmount: dbModel.insurance.coverageAmount || 0,
        notes: dbModel.insurance.notes || null,
      }
    : null;

  const disposal: disposalDto | null = dbModel.disposal
    ? {
        date: dbModel.disposal.date || null,
        method: dbModel.disposal.method || null,
        salePrice: dbModel.disposal.salePrice || 0,
        reason: dbModel.disposal.reason || null,
        approvedBy: dbModel.disposal.approvedBy ? String(dbModel.disposal.approvedBy) : null,
        journalEntryId: dbModel.disposal.journalEntryId ? String(dbModel.disposal.journalEntryId) : null,
      }
    : null;

  const locationHistory: locationHistoryDto[] = (dbModel.locationHistory || []).map((l: any) => ({
    id: l._id ? String(l._id) : "",
    location: l.location || null,
    date: l.date || null,
    notes: l.notes || null,
    movedBy: l.movedBy ? String(l.movedBy) : null,
  }));

  const documents: assetDocumentDto[] = (dbModel.documents || []).map((d: any) => ({
    id: d._id ? String(d._id) : "",
    name: d.name || null,
    docType: d.docType || null,
    uploadedAt: d.uploadedAt || null,
    uploadedBy: d.uploadedBy ? String(d.uploadedBy) : null,
    url: d.url || null,
  }));

  return {
    id: dbModel._id ? String(dbModel._id) : "",
    assetTag: dbModel.assetTag || null,
    name: dbModel.name || null,
    categoryId: category ? String(category._id) : dbModel.categoryId ? String(dbModel.categoryId) : null,
    categoryName: category?.name || null,
    serialNumber: dbModel.serialNumber || null,
    location: dbModel.location || null,
    purchaseDate: dbModel.purchaseDate || null,
    purchaseCost: dbModel.purchaseCost || 0,
    warrantyUntil: dbModel.warrantyUntil || null,
    currentValue: dbModel.currentValue || 0,
    currency: dbModel.currency || null,
    status: dbModel.status || null,
    notes: dbModel.notes || null,
    depreciationMethod: dbModel.depreciationMethod || null,
    usefulLifeYears: dbModel.usefulLifeYears || 0,
    salvageValue: dbModel.salvageValue || 0,
    assignedToId: assignedTo ? String(assignedTo._id) : dbModel.assignedToId ? String(dbModel.assignedToId) : null,
    assignedToName: employeeFullName(assignedTo),
    assignedDate: dbModel.assignedDate || null,
    assignmentHistory,
    maintenanceHistory,
    insurance,
    disposal,
    locationHistory,
    documents,
    acquisitionJournalEntryId: dbModel.acquisitionJournalEntryId ? String(dbModel.acquisitionJournalEntryId) : null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IAssetModel[]): assetDto[] => dbModels.map(mapDbToDto);

export { mapDbToDto, mapDbListToDtoList };
