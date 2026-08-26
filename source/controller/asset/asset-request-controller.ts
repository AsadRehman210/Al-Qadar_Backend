import { Request, Response } from "express";
import * as assetRequestService from "../../service/asset/asset-request-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const ERROR_MESSAGE: Record<string, string> = {
  not_found: Messages.MSG_ASSET_REQUEST_NOT_EXIST,
  employee_not_found: Messages.MSG_EMPLOYEE_NOT_EXIST,
  category_not_found: Messages.MSG_ASSET_CATEGORY_NOT_EXIST,
  already_decided: Messages.MSG_ASSET_REQUEST_ALREADY_DECIDED,
  invalid_status: Messages.MSG_INVALID_ASSET_REQUEST_STATUS,
  asset_not_found: Messages.MSG_ASSET_NOT_EXIST,
  already_assigned: Messages.MSG_ASSET_ALREADY_ASSIGNED,
  already_disposed: Messages.MSG_ASSET_ALREADY_DISPOSED,
};

const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.employeeId) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await assetRequestService.create(req.body, scope, user.id);

    if (result.errorCode !== "success") {
      return res.json(error(ERROR_MESSAGE[result.errorCode] || Messages.MSG_INVALID_DATA, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_SAVED, Enums.ErrorCode.success, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getAll = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as {
      page?: string; limit?: string; adminId?: string; merchantId?: string;
      search?: string; status?: string; priority?: string; employeeId?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await assetRequestService.getAll(filter, page, limit, {
      search: query.search,
      status: query.status,
      priority: query.priority,
      employeeId: query.employeeId,
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
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await assetRequestService.get(req.params.id, filter);

    if (!result) {
      return res.json(error(Messages.MSG_ASSET_REQUEST_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const decide = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.status || !["Approved", "Rejected"].includes(req.body.status)) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await assetRequestService.decide(req.params.id, req.body, filter, user.id);

    if (result.errorCode !== "success") {
      return res.json(error(ERROR_MESSAGE[result.errorCode] || Messages.MSG_ASSET_REQUEST_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const fulfill = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.assetId) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await assetRequestService.fulfill(req.params.id, req.body.assetId, filter, user.id);

    if (result.errorCode !== "success") {
      return res.json(error(ERROR_MESSAGE[result.errorCode] || Messages.MSG_ASSET_REQUEST_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { create, getAll, get, decide, fulfill };
