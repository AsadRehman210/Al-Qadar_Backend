import { Request, Response } from "express";
import * as budgetService from "../../service/finance/budget-service";
import { success, error } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const upsert = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { accountId, period, budgetAmount } = req.body;
    if (!accountId || !period || budgetAmount === undefined || budgetAmount === null) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }

    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await budgetService.upsert(req.body, scope, user.id);

    if (result.errorCode === "account_not_found") {
      return res.json(error(Messages.MSG_ACCOUNT_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === "invalid_account_type") {
      return res.json(error(Messages.MSG_BUDGET_INVALID_ACCOUNT_TYPE, Enums.ErrorCode.failed));
    }
    return res.json(success(Messages.MSG_SAVED, Enums.ErrorCode.success, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getAll = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string; year?: string };
    const filter = buildScopeFilter(user, query);
    const result = await budgetService.getAll(filter, { year: query.year });

    if (!result.length) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const deleteByID = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await budgetService.deleteByID(req.params.id, filter);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_BUDGET_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_SAVED, Enums.ErrorCode.success, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getBudgetVsActual = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string; year?: string };
    const filter = buildScopeFilter(user, query);
    const year = query.year || String(new Date().getFullYear());
    const result = await budgetService.getBudgetVsActual(filter, year);
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { upsert, getAll, deleteByID, getBudgetVsActual };
