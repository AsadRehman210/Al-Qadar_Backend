import { Request, Response } from "express";
import * as assetAuditService from "../../service/asset/asset-audit-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const ERROR_MESSAGE: Record<string, string> = {
  not_found: Messages.MSG_ASSET_AUDIT_NOT_EXIST,
  already_active: Messages.MSG_ASSET_AUDIT_ALREADY_ACTIVE,
  already_completed: Messages.MSG_ASSET_AUDIT_ALREADY_COMPLETED,
  result_not_found: Messages.MSG_ASSET_AUDIT_RESULT_NOT_FOUND,
};

const start = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await assetAuditService.start(scope, user.id);

    if (result.errorCode !== "success") {
      return res.json(error(ERROR_MESSAGE[result.errorCode] || Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    return res.json(success(Messages.MSG_SAVED, Enums.ErrorCode.success, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getAll = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { page?: string; limit?: string; adminId?: string; merchantId?: string };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await assetAuditService.getAll(filter, page, limit);

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
    const result = await assetAuditService.get(req.params.id, filter);

    if (!result) {
      return res.json(error(Messages.MSG_ASSET_AUDIT_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getActive = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await assetAuditService.getActive(filter);

    if (!result) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const recordResult = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.status) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await assetAuditService.recordResult(req.params.id, req.params.assetId, req.body, filter);

    if (result.errorCode !== "success") {
      return res.json(error(ERROR_MESSAGE[result.errorCode] || Messages.MSG_ASSET_AUDIT_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const complete = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await assetAuditService.complete(req.params.id, filter);

    if (result.errorCode !== "success") {
      return res.json(error(ERROR_MESSAGE[result.errorCode] || Messages.MSG_ASSET_AUDIT_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { start, getAll, get, getActive, recordResult, complete };
