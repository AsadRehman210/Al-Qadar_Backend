import { accountDto } from "../../dtos/account/account-dto";
import { IAccountModel } from "../../../model/account/account-model";

// password is deliberately excluded — never map it into the client-facing DTO.
const mapDbToDto = (dbModel: IAccountModel): accountDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    name: dbModel.name || null,
    email: dbModel.email || null,
    phone: dbModel.phone || null,
    role: dbModel.role || null,
    status: dbModel.status || null,
    code: dbModel.code || null,
    companyName: dbModel.companyName || null,
    businessCategory: dbModel.businessCategory || null,
    country: dbModel.country || null,
    city: dbModel.city || null,
    address: dbModel.address || null,
    taxNumber: dbModel.taxNumber || null,
    website: dbModel.website || null,
    currency: dbModel.currency || null,
    themeColor: dbModel.themeColor || null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    isLocked: Boolean(dbModel.lock_until && dbModel.lock_until.getTime() > Date.now()),
    last_login: dbModel.last_login || null,
    portalExpiryDate: dbModel.portalExpiryDate || null,
    lastPaymentDate: dbModel.lastPaymentDate || null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IAccountModel[]): accountDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
