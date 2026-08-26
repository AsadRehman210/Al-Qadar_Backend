import { Request, Response } from "express";
import * as salesAnalyticsService from "../../service/analytics/sales-analytics-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const getOverview = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string; fromDate?: string; toDate?: string };
    const filter = buildScopeFilter(user, query);
    const result = await salesAnalyticsService.getOverview(filter, { fromDate: query.fromDate, toDate: query.toDate });
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getProfitTrend = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string; months?: string };
    const filter = buildScopeFilter(user, query);
    const months = !query.months || isNaN(Number(query.months)) ? 12 : Number(query.months);
    const result = await salesAnalyticsService.getProfitTrend(filter, months);
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getTopProducts = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string; fromDate?: string; toDate?: string; limit?: string };
    const filter = buildScopeFilter(user, query);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);
    const result = await salesAnalyticsService.getTopProducts(filter, { fromDate: query.fromDate, toDate: query.toDate, limit });
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getTopProductsPaginated = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string; fromDate?: string; toDate?: string; page?: string; limit?: string };
    const filter = buildScopeFilter(user, query);
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);
    const result = await salesAnalyticsService.getTopProductsPaginated(filter, page, limit, { fromDate: query.fromDate, toDate: query.toDate });
    if (!result.result.length) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(pagination(result.result, result.totalCount, page, limit));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { getOverview, getProfitTrend, getTopProducts, getTopProductsPaginated };
