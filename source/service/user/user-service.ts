import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { ActivityFlag } from "../../utility/helper/constants/enum";
import { userModel } from "../../model/user/user-model";
import { roleModel } from "../../model/role/role-model";
import { AccountModel } from "../../model/account/account-model";
import { userDto } from "../../utility/dtos/user/user-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/user/user-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { BCRYPT_SALT_ROUNDS } from "../../utility/helper/constants/security";

const NOT_DELETED = { action_type: { $ne: ActivityFlag.delete } };
const ROLE_POPULATE = { path: "roleId", select: "role_name permissions status" };

interface UserInput {
  first_name?: string;
  last_name?: string;
  user_name?: string;
  email?: string;
  phone?: string;
  cnic?: string;
  password?: string;
  roleId?: string;
  status?: "active" | "inactive";
}

interface UserResult {
  errorCode: "success" | "updated" | "duplicate_entry" | "not_found" | "invalid" | "invalid_role";
  result: userDto | null;
}

const normalizeEmail = (email?: string) => (email || "").toLowerCase().trim();

// An email is unusable for a User if it belongs to ANY Account (owner login)
// or to any other non-deleted User — login resolves an email to exactly one
// principal, so global uniqueness is required, not per-tenant.
const emailTaken = async (email: string, exceptUserId?: string): Promise<boolean> => {
  const accountClash = await AccountModel.findOne({ email }).select("_id").lean();
  if (accountClash) return true;
  const userClash = await userModel
    .findOne({
      email,
      ...NOT_DELETED,
      ...(exceptUserId ? { _id: { $ne: exceptUserId } } : {}),
    })
    .select("_id")
    .lean();
  return Boolean(userClash);
};

// The Role must exist, be active, and belong to the same tenant as the user.
const roleIsUsable = async (roleId: string, scope: Record<string, unknown>): Promise<boolean> => {
  if (!mongoose.isValidObjectId(roleId)) return false;
  const role = await roleModel
    .findOne({ _id: roleId, ...scope, ...NOT_DELETED, status: "active" })
    .select("_id")
    .lean();
  return Boolean(role);
};

const create = async (data: UserInput, scope: TenantScope, createdBy: string): Promise<UserResult> => {
  const email = normalizeEmail(data.email);
  if (!email || !data.password || !data.first_name) {
    return { errorCode: "invalid", result: null };
  }
  if (await emailTaken(email)) {
    return { errorCode: "duplicate_entry", result: null };
  }

  const tenantFilter = { adminId: scope.adminId, merchantId: scope.merchantId };
  if (!data.roleId || !(await roleIsUsable(data.roleId, tenantFilter))) {
    return { errorCode: "invalid_role", result: null };
  }

  const created = await userModel.create({
    _id: new mongoose.Types.ObjectId(),
    first_name: data.first_name,
    last_name: data.last_name || null,
    user_name: data.user_name || `${data.first_name} ${data.last_name || ""}`.trim(),
    email,
    phone: data.phone || null,
    cnic: data.cnic || null,
    password: await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS),
    roleId: data.roleId,
    status: data.status || "active",
    is_default_user: false,
    is_verified: 1,
    action_type: ActivityFlag.add,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  const populated = await userModel.findById(created._id).populate(ROLE_POPULATE).lean();
  return { errorCode: "success", result: mapDbToDto(populated as any) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: { search?: string; status?: string; excludeId?: string | null } = {}
): Promise<{ totalCount: number; result: userDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query: Record<string, unknown> = { ...filter, ...NOT_DELETED };
  if (options.search) {
    const rx = new RegExp(options.search.trim(), "i");
    query.$or = [{ first_name: rx }, { last_name: rx }, { user_name: rx }, { email: rx }, { phone: rx }];
  }
  if (options.status === "active" || options.status === "inactive") {
    query.status = options.status;
  }
  if (options.excludeId && mongoose.isValidObjectId(options.excludeId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(options.excludeId) };
  }

  const data = await userModel
    .find(query)
    .populate(ROLE_POPULATE)
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await userModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data as any) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<userDto | null> => {
  if (!mongoose.isValidObjectId(id)) return null;
  const data = await userModel
    .findOne({ _id: id, ...filter, ...NOT_DELETED })
    .populate(ROLE_POPULATE)
    .lean();
  return data ? mapDbToDto(data as any) : null;
};

const update = async (
  id: string,
  data: UserInput,
  filter: Record<string, unknown>
): Promise<UserResult> => {
  if (!mongoose.isValidObjectId(id)) return { errorCode: "not_found", result: null };

  const current = await userModel.findOne({ _id: id, ...filter, ...NOT_DELETED }).lean();
  if (!current) return { errorCode: "not_found", result: null };

  const payload: Record<string, unknown> = { action_type: ActivityFlag.edit };

  if (data.email !== undefined) {
    const email = normalizeEmail(data.email);
    if (!email) return { errorCode: "invalid", result: null };
    if (email !== current.email && (await emailTaken(email, id))) {
      return { errorCode: "duplicate_entry", result: null };
    }
    payload.email = email;
  }
  if (data.first_name !== undefined) payload.first_name = data.first_name;
  if (data.last_name !== undefined) payload.last_name = data.last_name || null;
  if (data.phone !== undefined) payload.phone = data.phone || null;
  if (data.cnic !== undefined) payload.cnic = data.cnic || null;
  if (data.status !== undefined) payload.status = data.status;
  if (data.password) payload.password = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

  if (data.roleId !== undefined) {
    if (!(await roleIsUsable(data.roleId, filter))) {
      return { errorCode: "invalid_role", result: null };
    }
    payload.roleId = data.roleId;
  }

  const updated = await userModel
    .findOneAndUpdate({ _id: id, ...filter, ...NOT_DELETED }, { $set: payload }, { new: true })
    .populate(ROLE_POPULATE)
    .lean();
  if (!updated) return { errorCode: "not_found", result: null };

  return { errorCode: "updated", result: mapDbToDto(updated as any) };
};

const setStatus = async (
  id: string,
  filter: Record<string, unknown>,
  status: "active" | "inactive"
): Promise<UserResult> => {
  if (!mongoose.isValidObjectId(id)) return { errorCode: "not_found", result: null };
  const updated = await userModel
    .findOneAndUpdate(
      { _id: id, ...filter, ...NOT_DELETED },
      { $set: { status, action_type: ActivityFlag.edit, ...(status === "active" ? { lock_until: null, failed_attempts: 0 } : {}) } },
      { new: true }
    )
    .populate(ROLE_POPULATE)
    .lean();
  if (!updated) return { errorCode: "not_found", result: null };
  return { errorCode: "updated", result: mapDbToDto(updated as any) };
};

const deleteByID = async (
  id: string,
  filter: Record<string, unknown>
): Promise<{ errorCode: "success" | "not_found" }> => {
  if (!mongoose.isValidObjectId(id)) return { errorCode: "not_found" };
  const deleted = await userModel.findOneAndUpdate(
    { _id: id, ...filter, ...NOT_DELETED },
    { $set: { action_type: ActivityFlag.delete } },
    { new: true, select: "_id" }
  ).lean();
  return { errorCode: deleted ? "success" : "not_found" };
};

export { create, getAll, get, update, setStatus, deleteByID };
