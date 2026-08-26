import { adminPaymentDto } from "../../dtos/admin/admin-payment-dto";
import { IAdminPaymentModel } from "../../../model/admin/admin-payment-model";

const mapDbToDto = (dbModel: IAdminPaymentModel): adminPaymentDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    amount: dbModel.amount ?? null,
    method: dbModel.method || null,
    periodStart: dbModel.periodStart || null,
    periodEnd: dbModel.periodEnd || null,
    reference: dbModel.reference || null,
    notes: dbModel.notes || null,
    recordedBy: dbModel.recordedBy ? String(dbModel.recordedBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IAdminPaymentModel[]): adminPaymentDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
