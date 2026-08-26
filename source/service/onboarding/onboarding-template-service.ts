import { OnboardingTemplateModel } from "../../model/onboarding/onboarding-template-model";
import { onboardingTemplateDto } from "../../utility/dtos/onboarding/onboarding-template-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/onboarding/onboarding-template-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";

interface CreateTemplateInput {
  label: string;
  category?: string;
  required?: boolean;
}

const create = async (
  data: CreateTemplateInput,
  scope: TenantScope,
  createdBy: string
): Promise<onboardingTemplateDto> => {
  const count = await OnboardingTemplateModel.countDocuments({
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    isDeleted: { $ne: true },
  });

  const template = await OnboardingTemplateModel.create({
    label: data.label,
    category: data.category || "documentation",
    required: data.required ?? false,
    active: true,
    order: count + 1,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return mapDbToDto(template);
};

const getAll = async (filter: Record<string, unknown>): Promise<onboardingTemplateDto[]> => {
  const query = { ...filter, isDeleted: { $ne: true } };
  const data = await OnboardingTemplateModel.find(query).sort({ order: 1 }).lean();
  return mapDbListToDtoList(data);
};

interface TemplateResult {
  errorCode: "success" | "not_found";
  result: onboardingTemplateDto | null;
}

const update = async (
  id: string,
  data: Partial<CreateTemplateInput> & { active?: boolean },
  filter: Record<string, unknown>
): Promise<TemplateResult> => {
  const updated = await OnboardingTemplateModel.findOneAndUpdate(
    { _id: id, ...filter, isDeleted: { $ne: true } },
    { $set: data },
    { new: true }
  ).lean();
  if (!updated) return { errorCode: "not_found", result: null };
  return { errorCode: "success", result: mapDbToDto(updated) };
};

const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<boolean> => {
  const result = await OnboardingTemplateModel.findOneAndUpdate(
    { _id: id, ...filter, isDeleted: { $ne: true } },
    { $set: { isDeleted: true } },
    { new: true }
  ).select("_id").lean();
  return Boolean(result);
};

/** Persists a full reorder — `orderedIds` is the template id list in its new display order. */
const reorder = async (orderedIds: string[], filter: Record<string, unknown>): Promise<onboardingTemplateDto[]> => {
  await Promise.all(
    orderedIds.map((id, index) =>
      OnboardingTemplateModel.updateOne({ _id: id, ...filter }, { $set: { order: index + 1 } })
    )
  );
  return getAll(filter);
};

export { create, getAll, update, deleteByID, reorder };
