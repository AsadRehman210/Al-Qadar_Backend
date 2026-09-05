import mongoose from "mongoose";
import { roleModel } from "../../model/role/role-model";
import { userModel } from "../../model/user/user-model";
import { roleDto } from "../../utility/dtos/role/role-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/role/role-mapper";
import * as Enums from "../../utility/helper/constants/enum";
import { isValidPermission } from "../../utility/helper/constants/permissions";
import { toAggregateFilter } from "../../utility/helper/tenant-scope";

interface RoleScope {
  adminId: string | null;
  merchantId: string | null;
}

interface RoleInput {
  role_name?: string;
  permissions?: string[];
  status?: "active" | "inactive";
}

interface RoleResult {
  errorCode: "success" | "updated" | "duplicate_entry" | "not_found" | "invalid";
  result: roleDto | null;
}

const NOT_DELETED = { action_type: { $ne: Enums.ActivityFlag.delete } };

const sanitizePermissions = (permissions?: string[]): string[] =>
  Array.from(new Set((permissions || []).filter((p) => typeof p === "string" && isValidPermission(p))));

const withUserCounts = async (
  roles: any[],
  scope: Record<string, unknown>
): Promise<any[]> => {
  if (!roles.length) return roles;
  // aggregate $match does not cast string ids → ObjectId (unlike find()).
  const counts = await userModel.aggregate([
    {
      $match: {
        ...toAggregateFilter(scope),
        ...NOT_DELETED,
        roleId: { $in: roles.map((r) => r._id) },
      },
    },
    { $group: { _id: "$roleId", count: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.count]));
  return roles.map((r) => ({ ...r, userCount: byId.get(String(r._id)) || 0 }));
};

const create = async (data: RoleInput, scope: RoleScope, createdBy: string): Promise<RoleResult> => {
  if (!data.role_name || !data.role_name.trim()) {
    return { errorCode: "invalid", result: null };
  }

  const existing = await roleModel
    .findOne({
      adminId: scope.adminId,
      merchantId: scope.merchantId,
      role_name: new RegExp(`^${data.role_name.trim()}$`, "i"),
      ...NOT_DELETED,
    })
    .select("_id")
    .lean();
  if (existing) {
    return { errorCode: "duplicate_entry", result: null };
  }

  const role = await roleModel.create({
    role_name: data.role_name.trim(),
    permissions: sanitizePermissions(data.permissions),
    status: data.status || "active",
    action_type: Enums.ActivityFlag.add,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapDbToDto(role.toObject() as any) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: { search?: string; status?: string } = {}
): Promise<{ totalCount: number; result: roleDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query: Record<string, unknown> = { ...filter, ...NOT_DELETED };
  if (options.search) {
    query.role_name = new RegExp(options.search.trim(), "i");
  }
  if (options.status === "active" || options.status === "inactive") {
    query.status = options.status;
  }

  const data = await roleModel.find(query).skip(startIndex).limit(limit).sort({ _id: -1 }).lean();
  const count = await roleModel.countDocuments(query);
  const withCounts = await withUserCounts(data, filter);

  return { totalCount: count, result: mapDbListToDtoList(withCounts) };
};

const getActive = async (filter: Record<string, unknown>): Promise<roleDto[]> => {
  const data = await roleModel
    .find({ ...filter, ...NOT_DELETED, status: "active" })
    .sort({ role_name: 1 })
    .lean();
  return mapDbListToDtoList(data);
};

const get = async (id: string, filter: Record<string, unknown>): Promise<roleDto | null> => {
  if (!mongoose.isValidObjectId(id)) return null;
  const data = await roleModel.findOne({ _id: id, ...filter, ...NOT_DELETED }).lean();
  if (!data) return null;
  const [withCount] = await withUserCounts([data], filter);
  return mapDbToDto(withCount);
};

const update = async (
  id: string,
  data: RoleInput,
  filter: Record<string, unknown>
): Promise<RoleResult> => {
  if (!mongoose.isValidObjectId(id)) return { errorCode: "not_found", result: null };

  if (data.role_name && data.role_name.trim()) {
    const clash = await roleModel
      .findOne({
        ...filter,
        _id: { $ne: id },
        role_name: new RegExp(`^${data.role_name.trim()}$`, "i"),
        ...NOT_DELETED,
      })
      .select("_id")
      .lean();
    if (clash) {
      return { errorCode: "duplicate_entry", result: null };
    }
  }

  const payload: Record<string, unknown> = { action_type: Enums.ActivityFlag.edit };
  if (data.role_name !== undefined) payload.role_name = data.role_name.trim();
  if (data.permissions !== undefined) payload.permissions = sanitizePermissions(data.permissions);
  if (data.status !== undefined) payload.status = data.status;

  const updated = await roleModel
    .findOneAndUpdate({ _id: id, ...filter, ...NOT_DELETED }, { $set: payload }, { new: true })
    .lean();
  if (!updated) return { errorCode: "not_found", result: null };

  const [withCount] = await withUserCounts([updated], filter);
  return { errorCode: "updated", result: mapDbToDto(withCount) };
};

const deleteByID = async (
  id: string,
  filter: Record<string, unknown>
): Promise<{ errorCode: "success" | "not_found" | "in_use" }> => {
  if (!mongoose.isValidObjectId(id)) return { errorCode: "not_found" };

  const role = await roleModel.findOne({ _id: id, ...filter, ...NOT_DELETED }).select("_id").lean();
  if (!role) return { errorCode: "not_found" };

  const assigned = await userModel.countDocuments({ ...filter, ...NOT_DELETED, roleId: id });
  if (assigned > 0) return { errorCode: "in_use" };

  await roleModel.findOneAndUpdate({ _id: id, ...filter }, { $set: { action_type: Enums.ActivityFlag.delete } });
  return { errorCode: "success" };
};

export { create, getAll, getActive, get, update, deleteByID };
