import { Request, Response } from "express";
import * as reportsService from "../../service/finance/reports-service";
import { success, error } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const getTrialBalance = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string; fromDate?: string; toDate?: string };
    const filter = buildScopeFilter(user, query);
    const result = await reportsService.getTrialBalance(filter, { fromDate: query.fromDate, toDate: query.toDate });
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getProfitAndLoss = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string; fromDate?: string; toDate?: string };
    const filter = buildScopeFilter(user, query);
    const result = await reportsService.getProfitAndLoss(filter, { fromDate: query.fromDate, toDate: query.toDate });
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getBalanceSheet = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string; asOfDate?: string };
    const filter = buildScopeFilter(user, query);
    const result = await reportsService.getBalanceSheet(filter, { asOfDate: query.asOfDate });
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getVatSummary = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string; fromDate?: string; toDate?: string };
    const filter = buildScopeFilter(user, query);
    const result = await reportsService.getVatSummary(filter, { fromDate: query.fromDate, toDate: query.toDate });
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getCashFlow = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string; fromDate?: string; toDate?: string };
    const filter = buildScopeFilter(user, query);
    const result = await reportsService.getCashFlow(filter, { fromDate: query.fromDate, toDate: query.toDate });
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { getTrialBalance, getProfitAndLoss, getBalanceSheet, getVatSummary, getCashFlow };
