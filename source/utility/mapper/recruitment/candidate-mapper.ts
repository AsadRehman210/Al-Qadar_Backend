import { candidateDto } from "../../dtos/recruitment/candidate-dto";
import { ICandidateModel } from "../../../model/recruitment/candidate-model";

const mapDbToDto = (dbModel: ICandidateModel): candidateDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    jobId: dbModel.jobId ? String(dbModel.jobId) : null,
    name: dbModel.name || null,
    email: dbModel.email || null,
    phone: dbModel.phone || null,
    experience: dbModel.experience || null,
    currentCompany: dbModel.currentCompany || null,
    stage: dbModel.stage || null,
    notes: dbModel.notes || null,
    interviewDate: dbModel.interviewDate || null,
    rating: dbModel.rating ?? null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: ICandidateModel[]): candidateDto[] => dbModels.map(mapDbToDto);

export { mapDbToDto, mapDbListToDtoList };
