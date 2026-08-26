import { supplierDto } from "../../dtos/purchase/supplier-dto";
import { ISupplierModel } from "../../../model/purchase/supplier-model";
import { formatDateOnly } from "../../helper/date-only";

const mapDbToDto = (dbModel: ISupplierModel, currentBalance: number | null = null): supplierDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    name: dbModel.name || null,
    email: dbModel.email || null,
    phone: dbModel.phone || null,
    emergencyPhone: dbModel.emergencyPhone || null,
    address: dbModel.address || null,
    country: dbModel.country || null,
    city: dbModel.city || null,
    supplierType: dbModel.supplierType || null,
    taxNumber: dbModel.taxNumber || null,
    registrationNumber: dbModel.registrationNumber || null,
    licenseNumber: dbModel.licenseNumber || null,
    licenseExpiryDate: formatDateOnly(dbModel.licenseExpiryDate),
    contactPersonName: dbModel.contactPersonName || null,
    contactPersonPhone: dbModel.contactPersonPhone || null,
    contactPersonEmail: dbModel.contactPersonEmail || null,
    contactPersonDesignation: dbModel.contactPersonDesignation || null,
    bankName: dbModel.bankName || null,
    accountTitle: dbModel.accountTitle || null,
    accountNumber: dbModel.accountNumber || null,
    iban: dbModel.iban || null,
    branchCode: dbModel.branchCode || null,
    swift: dbModel.swift || null,
    openingBalance: dbModel.openingBalance ?? 0,
    status: dbModel.status || null,
    currentBalance,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: ISupplierModel[]): supplierDto[] => {
  return dbModels.map((m) => mapDbToDto(m));
};

export { mapDbToDto, mapDbListToDtoList };
