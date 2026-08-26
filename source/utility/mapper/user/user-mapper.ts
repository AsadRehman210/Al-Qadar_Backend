import { userDto } from "../../dtos/user/user-dto";
import { IUserModel } from "../../../model/user/user-model";

const mapDbToDto = (dbModel: IUserModel): userDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    user_name: dbModel.user_name || null,
    email: dbModel.email || null,
    phone: dbModel.phone|| null,
    // password is intentionally NOT mapped — it must never be sent to the client.
    cnic: dbModel.cnic || null,
    code: dbModel.code?.toString() || null,
    code_generation_time: dbModel.code_generation_time || null,
    is_verified: dbModel.is_verified || null,
    token: dbModel.token || null,
    last_email_sent_at: dbModel.last_email_sent_at || null,
    failed_attempts: dbModel.failed_attempts || null,
    lock_until: dbModel.lock_until || null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
    action_type: dbModel.action_type || null,
  };
};

const mapDbListToDtoList = (dbModels: IUserModel[]): userDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
