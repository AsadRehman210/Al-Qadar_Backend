import { merchantPaymentDto } from "../../dtos/merchant/merchant-payment-dto";
import { IMerchantPaymentModel } from "../../../model/merchant/merchant-payment-model";

const mapDbToDto = (dbModel: IMerchantPaymentModel): merchantPaymentDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    amount: dbModel.amount ?? null,
    method: dbModel.method || null,
    periodStart: dbModel.periodStart || null,
    periodEnd: dbModel.periodEnd || null,
    reference: dbModel.reference || null,
    notes: dbModel.notes || null,
    recordedBy: dbModel.recordedBy ? String(dbModel.recordedBy) : null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IMerchantPaymentModel[]): merchantPaymentDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
