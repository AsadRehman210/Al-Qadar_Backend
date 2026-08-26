import { Request, Response } from "express";
import * as reconciliationSessionService from "../../service/finance/reconciliation-session-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { bankAccountId, periodStart, periodEnd, statementEndingBalance } = req.body;
    if (!bankAccountId || !periodStart || !periodEnd || statementEndingBalance === undefined || statementEndingBalance === null) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }

    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await reconciliationSessionService.create(req.body, scope, user.id);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_BANK_ACCOUNT_NOT_EXIST, Enums.ErrorCode.not_exist));
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
      page?: string;
      limit?: string;
      adminId?: string;
      merchantId?: string;
      bankAccountId?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 20 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await reconciliationSessionService.getAll(filter, page, limit, {
      bankAccountId: query.bankAccountId,
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
    const result = await reconciliationSessionService.get(req.params.id, filter);

    if (!result) {
      return res.json(error(Messages.MSG_RECONCILIATION_SESSION_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const close = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await reconciliationSessionService.close(req.params.id, filter);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_RECONCILIATION_SESSION_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === "invalid_status") {
      return res.json(error(Messages.MSG_INVALID_RECONCILIATION_STATUS, Enums.ErrorCode.failed));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { create, getAll, get, close };
