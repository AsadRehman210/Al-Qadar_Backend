import { stockIssueDto } from "../../dtos/warehouse/stock-issue-dto";
import { IStockIssueModel } from "../../../model/warehouse/stock-issue-model";

const populated = (value: unknown, nameField: string): { id: string | null; name: string | null } => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return { id: value ? String(value) : null, name: null };
  if (!(nameField in doc)) return { id: String(value), name: null };
  return { id: doc._id ? String(doc._id) : null, name: (doc[nameField] as string) || null };
};

const mapDbToDto = (dbModel: IStockIssueModel): stockIssueDto => {
  const warehouse = populated(dbModel.warehouseId, "name");
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    issueNo: dbModel.issueNo || null,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    date: dbModel.date || null,
    issueType: dbModel.issueType || null,
    issuedTo: dbModel.issuedTo || null,
    reference: dbModel.reference || null,
    notes: dbModel.notes || null,
    issuedBy: dbModel.issuedBy ? String(dbModel.issuedBy) : null,
    items: (dbModel.items || []).map((item: any) => {
      const v = populated(item.variantId, "variantName");
      return { variantId: v.id || "", variantName: v.name, sku: item.variantId?.sku || null, qty: item.qty };
    }),
    createdAt: dbModel.createdAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IStockIssueModel[]): stockIssueDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
