import { Request, Response } from "express";
import * as ledgerService from "../../service/finance/ledger-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const getAll = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as {
      page?: string;
      limit?: string;
      adminId?: string;
      merchantId?: string;
      accountId?: string;
      source?: string;
      fromDate?: string;
      toDate?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await ledgerService.getAll(filter, page, limit, {
      accountId: query.accountId,
      source: query.source,
      fromDate: query.fromDate,
      toDate: query.toDate,
    });

    if (!result.result.length) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(pagination(result.result, result.totalCount, page, limit));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getByAccount = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const { fromDate, toDate } = req.query as { fromDate?: string; toDate?: string };
    const result = await ledgerService.getByAccount(req.params.accountId, filter, { fromDate, toDate });

    if (!result.account) {
      return res.json(error(Messages.MSG_ACCOUNT_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getTrialBalance = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string; fromDate?: string; toDate?: string };
    const filter = buildScopeFilter(user, query);
    const result = await ledgerService.getTrialBalance(filter, { fromDate: query.fromDate, toDate: query.toDate });
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { getAll, getByAccount, getTrialBalance };
