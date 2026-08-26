import { Request, Response } from "express";
import * as hrAnalyticsService from "../../service/analytics/hr-analytics-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const getOverview = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string; date?: string };
    const filter = buildScopeFilter(user, query);
    const result = await hrAnalyticsService.getOverview(filter, { date: query.date });
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getAttendanceTrend = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string; days?: string };
    const filter = buildScopeFilter(user, query);
    const days = !query.days || isNaN(Number(query.days)) ? 14 : Number(query.days);
    const result = await hrAnalyticsService.getAttendanceTrend(filter, days);
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getUnmarkedToday = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string; date?: string; page?: string; limit?: string };
    const filter = buildScopeFilter(user, query);
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);
    const result = await hrAnalyticsService.getUnmarkedToday(filter, query.date, page, limit);
    if (!result.result.length) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(pagination(result.result, result.totalCount, page, limit));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { getOverview, getAttendanceTrend, getUnmarkedToday };
