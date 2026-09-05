import { Request, Response } from "express";
import * as userService from "../../service/user/user-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildOwnerScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await userService.create(req.body, scope, user.id);

    if (result.errorCode === "invalid") {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    if (result.errorCode === "invalid_role") {
      return res.json(error(Messages.MSG_ROLE_NOT_EXIST, Enums.ErrorCode.failed));
    }
    if (result.errorCode === "duplicate_entry") {
      return res.json(error(Messages.MSG_DUPLICATE_ENTRY, Enums.ErrorCode.duplicate_entry));
    }
    return res.json(success(Messages.MSG_SUCCESS, Enums.ErrorCode.success, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getAll = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { page?: string; limit?: string; search?: string; status?: string };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildOwnerScopeFilter(user);
    // Sub-user session: never surface the caller's own User row in this module.
    const excludeSelfId = user.isSubUser && user.sub ? String(user.sub) : null;
    const result = await userService.getAll(filter, page, limit, {
      search: query.search,
      status: query.status,
      excludeId: excludeSelfId,
    });

    if (!result.result.length) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(pagination(result.result, result.totalCount, page, limit));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const get = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    // Sub-user (is_default_user false) must not fetch their own detail via Users API.
    if (user.isSubUser && user.sub && String(user.sub) === String(req.params.id)) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    const result = await userService.get(req.params.id, buildOwnerScopeFilter(user));
    if (!result) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const update = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    if (user.isSubUser && user.sub && String(user.sub) === String(req.params.id)) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    const result = await userService.update(req.params.id, req.body, buildOwnerScopeFilter(user));

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === "invalid") {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    if (result.errorCode === "invalid_role") {
      return res.json(error(Messages.MSG_ROLE_NOT_EXIST, Enums.ErrorCode.failed));
    }
    if (result.errorCode === "duplicate_entry") {
      return res.json(error(Messages.MSG_DUPLICATE_ENTRY, Enums.ErrorCode.duplicate_entry));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const changeStatus = (status: "active" | "inactive") => async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    if (user.isSubUser && user.sub && String(user.sub) === String(req.params.id)) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    const result = await userService.setStatus(req.params.id, buildOwnerScopeFilter(user), status);
    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const deleteByID = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    if (user.isSubUser && user.sub && String(user.sub) === String(req.params.id)) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    const result = await userService.deleteByID(req.params.id, buildOwnerScopeFilter(user));
    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DELETE_SUCCESS, Enums.ErrorCode.success));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const activate = changeStatus("active");
const deactivate = changeStatus("inactive");

export { create, getAll, get, update, activate, deactivate, deleteByID };
