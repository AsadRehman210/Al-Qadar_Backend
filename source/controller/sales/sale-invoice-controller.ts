import { Request, Response } from "express";
import * as saleInvoiceService from "../../service/sales/sale-invoice-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

// Every existing frontend thunk in this codebase surfaces `response.message`
// (never `error_message`) as the toast text — so the actual per-variant
// shortfall has to be the primary message itself, not a detail field nothing
// reads.
const describeShortages = (shortages: saleInvoiceService.StockShortage[] | undefined): string => {
  const detail = (shortages || [])
    .map((s) => `${s.variantName || s.sku || s.variantId}: ${s.available} available, requested ${s.requested}`)
    .join("; ");
  return detail ? `${Messages.MSG_INSUFFICIENT_STOCK} ${detail}` : Messages.MSG_INSUFFICIENT_STOCK;
};

const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.customerId || !req.body.warehouseId || !req.body.products?.length) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await saleInvoiceService.create(req.body, scope, user.id);
    if (result.errorCode === "insufficient_stock") {
      return res.json(error(describeShortages(result.shortages), Enums.ErrorCode.failed));
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
      customerId?: string;
      deliveryStatus?: string;
      paymentStatus?: string;
      fromDate?: string;
      toDate?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await saleInvoiceService.getAll(filter, page, limit, {
      search: query.search,
      customerId: query.customerId,
      deliveryStatus: query.deliveryStatus,
      paymentStatus: query.paymentStatus,
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

// Accounts Receivable — every Sale Invoice still owed on or owing a refund
// back, sourced live from real invoices (see getReceivables' own comment).
const getReceivables = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { page?: string; limit?: string; adminId?: string; merchantId?: string; search?: string; customerId?: string };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 20 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await saleInvoiceService.getReceivables(filter, page, limit, {
      search: query.search,
      customerId: query.customerId,
    });

    return res.json(
      success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, {
        result: result.result,
        total_records: result.totalCount,
        total_pages: Math.ceil(result.totalCount / limit) || 1,
        page_number: page,
        totalBalanceDue: result.totalBalanceDue,
        totalRefundDue: result.totalRefundDue,
      })
    );
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

// "Collected Tax" module — every Sale Invoice's output VAT, plus the true
// total across every matching invoice.
const getCollectedTaxReport = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as {
      page?: string;
      limit?: string;
      adminId?: string;
      merchantId?: string;
      search?: string;
      customerId?: string;
      fromDate?: string;
      toDate?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await saleInvoiceService.getCollectedTaxReport(filter, page, limit, {
      search: query.search,
      customerId: query.customerId,
      fromDate: query.fromDate,
      toDate: query.toDate,
    });

    return res.json(
      success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, {
        result: result.result,
        total_records: result.totalCount,
        total_pages: Math.ceil(result.totalCount / limit) || 1,
        page_number: page,
        totalTaxAmount: result.totalTaxAmount,
      })
    );
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const get = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await saleInvoiceService.get(req.params.id, filter);

    if (!result) {
      return res.json(error(Messages.MSG_SALE_INVOICE_NOT_EXIST, Enums.ErrorCode.not_exist));
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
    const result = await saleInvoiceService.update(req.params.id, req.body, filter, user.id);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_SALE_INVOICE_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === "invalid_status") {
      return res.json(error(Messages.MSG_INVALID_DELIVERY_STATUS, Enums.ErrorCode.failed));
    }
    if (result.errorCode === "insufficient_stock") {
      return res.json(error(describeShortages(result.shortages), Enums.ErrorCode.failed));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const updateDeliveryStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.status) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await saleInvoiceService.updateDeliveryStatus(req.params.id, req.body.status, filter, user.id);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_SALE_INVOICE_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const addPayment = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.date || !req.body.amount) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await saleInvoiceService.addPayment(req.params.id, req.body, filter, user.id);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_SALE_INVOICE_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === "exceeds_balance") {
      return res.json(error(Messages.MSG_PAYMENT_EXCEEDS_BALANCE, Enums.ErrorCode.failed));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const addRefund = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.date || !req.body.amount) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await saleInvoiceService.addRefund(req.params.id, req.body, filter, user.id);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_SALE_INVOICE_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === "exceeds_refund") {
      return res.json(error(Messages.MSG_REFUND_EXCEEDS_DUE, Enums.ErrorCode.failed));
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
    const result = await saleInvoiceService.deleteByID(req.params.id, filter, user.id);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_SALE_INVOICE_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === "invalid_status") {
      return res.json(error(Messages.MSG_INVALID_DELIVERY_STATUS, Enums.ErrorCode.failed));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.success));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { create, getAll, get, getReceivables, getCollectedTaxReport, update, updateDeliveryStatus, addPayment, addRefund, deleteByID };
