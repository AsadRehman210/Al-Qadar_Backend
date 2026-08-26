import { Request, Response } from "express";
import * as stockLevelService from "../../service/warehouse/stock-level-service";
import { StockStatus } from "../../service/warehouse/stock-level-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

// GET /inventory/stock — variant x total qty x per-warehouse breakdown.
const getAll = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as {
      page?: string;
      limit?: string;
      adminId?: string;
      merchantId?: string;
      search?: string;
      warehouseId?: string;
      variantId?: string;
      status?: StockStatus | string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);
    const filter = buildScopeFilter(user, query);

    const result = await stockLevelService.getStockView(filter, {
      search: query.search,
      warehouseId: query.warehouseId,
      variantId: query.variantId,
      status: query.status,
      page,
      limit,
    });

    if (!result.result.length) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(pagination(result.result, result.totalCount, page, limit));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

// POST /inventory/stock/adjust — manual adjustment, delegates to adjustStock.
const adjust = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { variantId, warehouseId, type, qty, reason } = req.body;
    if (!variantId || !warehouseId || !type || qty === undefined) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);

    const newQty = await stockLevelService.adjustStock(
      scope,
      variantId,
      warehouseId,
      type,
      qty,
      reason || "Manual Adjustment",
      user.id
    );

    if (req.body.minQty !== undefined) {
      await stockLevelService.setMinStock(scope, variantId, warehouseId, req.body.minQty);
    }

    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.success, { qty: newQty }));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

// GET /inventory/stock/adjustment-history
const adjustmentHistory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as {
      page?: string;
      limit?: string;
      adminId?: string;
      merchantId?: string;
      variantId?: string;
      warehouseId?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);
    const filter = buildScopeFilter(user, query);

    const result = await stockLevelService.getAdjustmentHistory(filter, page, limit, {
      variantId: query.variantId,
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

// GET /inventory/stock/summary — total SKUs/units/low-stock/out-of-stock cards.
const summary = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await stockLevelService.getStockSummary(filter);
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { getAll, adjust, adjustmentHistory, summary };
