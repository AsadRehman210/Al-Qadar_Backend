import { specialPaymentTypeDto } from "../../dtos/payroll/special-payment-type-dto";
import { ISpecialPaymentTypeModel } from "../../../model/payroll/special-payment-type-model";

const mapDbToDto = (dbModel: ISpecialPaymentTypeModel): specialPaymentTypeDto => ({
  id: dbModel._id ? String(dbModel._id) : "",
  name: dbModel.name || null,
  description: dbModel.description || null,
  icon: dbModel.icon || null,
  amountMode: dbModel.amountMode || null,
  amountValue: dbModel.amountValue ?? null,
  adminId: dbModel.adminId ? String(dbModel.adminId) : null,
  merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
  createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
  createdAt: dbModel.createdAt || null,
  updatedAt: dbModel.updatedAt || null,
});

const mapDbListToDtoList = (dbModels: ISpecialPaymentTypeModel[]): specialPaymentTypeDto[] => dbModels.map(mapDbToDto);

export { mapDbToDto, mapDbListToDtoList };
