import { Request, Response } from "express";
import * as inventoryAnalyticsService from "../../service/analytics/inventory-analytics-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const getOverview = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string };
    const filter = buildScopeFilter(user, query);
    const result = await inventoryAnalyticsService.getOverview(filter);
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getExpiryBuckets = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string };
    const filter = buildScopeFilter(user, query);
    const result = await inventoryAnalyticsService.getExpiryBuckets(filter);
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const EXPIRY_BUCKET_KEYS = ["expired", "within_1_month", "within_6_months", "within_1_year"];

const getExpiryBucketDetail = async (req: Request, res: Response): Promise<Response> => {
  try {
    const bucket = req.params.bucket;
    if (!EXPIRY_BUCKET_KEYS.includes(bucket)) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string; page?: string; limit?: string };
    const filter = buildScopeFilter(user, query);
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);
    const result = await inventoryAnalyticsService.getExpiryBucketDetail(filter, bucket as any, page, limit);
    if (!result.result.length) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(pagination(result.result, result.totalCount, page, limit));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { getOverview, getExpiryBuckets, getExpiryBucketDetail };
