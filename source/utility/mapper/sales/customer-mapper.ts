import { customerDto } from "../../dtos/sales/customer-dto";
import { ICustomerModel } from "../../../model/sales/customer-model";

const mapDbToDto = (
  dbModel: ICustomerModel,
  currentBalance: number | null = null,
  openingBalanceLocked = false
): customerDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    name: dbModel.name || null,
    email: dbModel.email || null,
    phone: dbModel.phone || null,
    emergencyPhone: dbModel.emergencyPhone || null,
    address: dbModel.address || null,
    city: dbModel.city || null,
    country: dbModel.country || null,
    customerType: dbModel.customerType || null,
    companyName: dbModel.companyName || null,
    customerSegment: dbModel.customerSegment || null,
    taxNumber: dbModel.taxNumber || null,
    registrationNumber: dbModel.registrationNumber || null,
    openingBalance: dbModel.openingBalance ?? 0,
    creditLimit: dbModel.creditLimit ?? 0,
    creditDays: dbModel.creditDays ?? 30,
    status: dbModel.status || null,
    currentBalance,
    openingBalanceLocked,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: ICustomerModel[]): customerDto[] => {
  return dbModels.map((m) => mapDbToDto(m));
};

export { mapDbToDto, mapDbListToDtoList };
