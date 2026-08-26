import { Request, Response } from "express";
import * as bankStatementLineService from "../../service/finance/bank-statement-line-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { bankAccountId, date, amount } = req.body;
    if (!bankAccountId || !date || amount === undefined || amount === null) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }

    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await bankStatementLineService.create(req.body, scope, user.id);

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
      matched?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 50 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await bankStatementLineService.getAll(filter, page, limit, {
      bankAccountId: query.bankAccountId,
      matched: query.matched,
    });

    if (!result.result.length) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(pagination(result.result, result.totalCount, page, limit));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const match = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { ledgerLineId } = req.body;
    if (!ledgerLineId) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await bankStatementLineService.match(req.params.id, ledgerLineId, filter);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const unmatch = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await bankStatementLineService.unmatch(req.params.id, filter);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { create, getAll, match, unmatch };
