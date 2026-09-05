import { userDto } from "../../dtos/user/user-dto";
import { IUserModel } from "../../../model/user/user-model";

// When `roleId` is populated the Role's name + permissions ride along on the
// DTO so the frontend never needs a second request to render a user's access.
const populatedRole = (
  value: unknown
): { id: string | null; name: string | null; permissions: string[] } => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") {
    return { id: value ? String(value) : null, name: null, permissions: [] };
  }
  return {
    id: doc._id ? String(doc._id) : null,
    name: (doc.role_name as string) || null,
    permissions: Array.isArray(doc.permissions) ? (doc.permissions as string[]) : [],
  };
};

const mapDbToDto = (dbModel: IUserModel): userDto => {
  const role = populatedRole(dbModel.roleId);
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    user_name: dbModel.user_name || null,
    first_name: dbModel.first_name || null,
    last_name: dbModel.last_name || null,
    email: dbModel.email || null,
    phone: dbModel.phone || null,
    // password is intentionally NOT mapped — it must never be sent to the client.
    cnic: dbModel.cnic || null,
    roleId: role.id,
    roleName: role.name,
    permissions: role.permissions,
    status: dbModel.status || null,
    is_default_user: Boolean(dbModel.is_default_user),
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    adminId: (dbModel as any).adminId ? String((dbModel as any).adminId) : null,
    merchantId: (dbModel as any).merchantId ? String((dbModel as any).merchantId) : null,
    code: dbModel.code?.toString() || null,
    code_generation_time: dbModel.code_generation_time || null,
    is_verified: dbModel.is_verified || null,
    token: dbModel.token || null,
    last_email_sent_at: dbModel.last_email_sent_at || null,
    failed_attempts: dbModel.failed_attempts || null,
    lock_until: dbModel.lock_until || null,
    isLocked: Boolean(dbModel.lock_until && dbModel.lock_until.getTime() > Date.now()),
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
    action_type: dbModel.action_type || null,
  };
};

const mapDbListToDtoList = (dbModels: IUserModel[]): userDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
