import { Request, Response } from "express";
import * as stockTransferService from "../../service/warehouse/stock-transfer-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.fromWarehouseId || !req.body.toWarehouseId || !req.body.items?.length) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await stockTransferService.create(req.body, scope, user.id);
    if (result.errorCode === "same_warehouse") {
      return res.json(error(Messages.MSG_TRANSFER_SAME_WAREHOUSE, Enums.ErrorCode.failed));
    }
    if (result.errorCode === "warehouse_not_found") {
      return res.json(error(Messages.MSG_TRANSFER_WAREHOUSE_NOT_FOUND, Enums.ErrorCode.not_exist));
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
      search?: string;
      status?: string;
      fromWarehouseId?: string;
      toWarehouseId?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await stockTransferService.getAll(filter, page, limit, {
      search: query.search,
      status: query.status,
      fromWarehouseId: query.fromWarehouseId,
      toWarehouseId: query.toWarehouseId,
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
    const result = await stockTransferService.get(req.params.id, filter);

    if (!result) {
      return res.json(error(Messages.MSG_STOCK_TRANSFER_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const approve = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await stockTransferService.approve(req.params.id, filter, user.id);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_STOCK_TRANSFER_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === "invalid_status") {
      return res.json(error(Messages.MSG_INVALID_TRANSFER_STATUS, Enums.ErrorCode.failed));
    }
    if (result.errorCode === "insufficient_stock") {
      return res.json(error(Messages.MSG_INSUFFICIENT_STOCK, Enums.ErrorCode.failed, result.shortages));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { create, getAll, get, approve };
