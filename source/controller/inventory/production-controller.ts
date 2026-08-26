import { Request, Response } from "express";
import * as productionService from "../../service/inventory/production-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.outputVariantId || !req.body.outputQuantity || !req.body.warehouseId || !req.body.rawLines?.length) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }

    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await productionService.create(req.body, scope, user.id);
    if (result.errorCode === "warehouse_not_found") {
      return res.json(error(Messages.MSG_PRODUCTION_WAREHOUSE_NOT_FOUND, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === "variant_not_found") {
      return res.json(error(Messages.MSG_PRODUCTION_VARIANT_NOT_FOUND, Enums.ErrorCode.not_exist));
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
      warehouseId?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await productionService.getAll(filter, page, limit, {
      search: query.search,
      status: query.status,
      warehouseId: query.warehouseId,
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
    const result = await productionService.get(req.params.id, filter);

    if (!result) {
      return res.json(error(Messages.MSG_PRODUCTION_ORDER_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const update = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await productionService.update(req.params.id, req.body, filter);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_PRODUCTION_ORDER_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === "invalid_status") {
      return res.json(error(Messages.MSG_INVALID_PRODUCTION_STATUS, Enums.ErrorCode.failed));
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
    const result = await productionService.complete(req.params.id, filter, user.id);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_PRODUCTION_ORDER_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === "invalid_status") {
      return res.json(error(Messages.MSG_INVALID_PRODUCTION_STATUS, Enums.ErrorCode.failed));
    }
    if (result.errorCode === "insufficient_stock") {
      return res.json(error(Messages.MSG_INSUFFICIENT_STOCK, Enums.ErrorCode.failed, result.shortages));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const deleteByID = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await productionService.deleteByID(req.params.id, filter);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_PRODUCTION_ORDER_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === "invalid_status") {
      return res.json(error(Messages.MSG_INVALID_PRODUCTION_STATUS, Enums.ErrorCode.failed));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.success));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { create, getAll, get, update, complete, deleteByID };
