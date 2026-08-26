import { onboardingTemplateDto } from "../../dtos/onboarding/onboarding-template-dto";
import { IOnboardingTemplateModel } from "../../../model/onboarding/onboarding-template-model";

const mapDbToDto = (dbModel: IOnboardingTemplateModel): onboardingTemplateDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    label: dbModel.label || null,
    category: dbModel.category || null,
    required: dbModel.required ?? null,
    active: dbModel.active ?? null,
    order: dbModel.order ?? null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IOnboardingTemplateModel[]): onboardingTemplateDto[] => dbModels.map(mapDbToDto);

export { mapDbToDto, mapDbListToDtoList };
