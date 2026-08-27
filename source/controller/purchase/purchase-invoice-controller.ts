import { Request, Response } from "express";
import * as purchaseInvoiceService from "../../service/purchase/purchase-invoice-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.supplierId || !req.body.warehouseId || !req.body.products?.length) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await purchaseInvoiceService.create(req.body, scope, user.id);
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
      supplierId?: string;
      status?: string;
      fromDate?: string;
      toDate?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await purchaseInvoiceService.getAll(filter, page, limit, {
      search: query.search,
      supplierId: query.supplierId,
      status: query.status,
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

// Accounts Payable — every Purchase Invoice still owed to the supplier or
// owing a refund back, sourced live from real invoices (see getPayables'
// own comment).
const getPayables = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { page?: string; limit?: string; adminId?: string; merchantId?: string; search?: string; supplierId?: string };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 20 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await purchaseInvoiceService.getPayables(filter, page, limit, {
      search: query.search,
      supplierId: query.supplierId,
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

// "Recoverable Tax" module — every Received invoice whose tax is a real
// input-VAT credit, plus the true total across every matching invoice.
const getRecoverableTaxReport = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as {
      page?: string;
      limit?: string;
      adminId?: string;
      merchantId?: string;
      search?: string;
      supplierId?: string;
      fromDate?: string;
      toDate?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await purchaseInvoiceService.getRecoverableTaxReport(filter, page, limit, {
      search: query.search,
      supplierId: query.supplierId,
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
    const result = await purchaseInvoiceService.get(req.params.id, filter);

    if (!result) {
      return res.json(error(Messages.MSG_PURCHASE_INVOICE_NOT_EXIST, Enums.ErrorCode.not_exist));
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
    const result = await purchaseInvoiceService.update(req.params.id, req.body, filter);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_PURCHASE_INVOICE_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === "invalid_status") {
      return res.json(error(Messages.MSG_INVALID_PURCHASE_STATUS, Enums.ErrorCode.failed));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const updateStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.status) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await purchaseInvoiceService.updateStatus(req.params.id, req.body.status, filter, user.id);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_PURCHASE_INVOICE_NOT_EXIST, Enums.ErrorCode.not_exist));
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
    const result = await purchaseInvoiceService.addPayment(req.params.id, req.body, filter, user.id);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_PURCHASE_INVOICE_NOT_EXIST, Enums.ErrorCode.not_exist));
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
    const result = await purchaseInvoiceService.addRefund(req.params.id, req.body, filter, user.id);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_PURCHASE_INVOICE_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === "exceeds_refund") {
      return res.json(error(Messages.MSG_SUPPLIER_REFUND_EXCEEDS_DUE, Enums.ErrorCode.failed));
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
    const result = await purchaseInvoiceService.deleteByID(req.params.id, filter);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_PURCHASE_INVOICE_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === "invalid_status") {
      return res.json(error(Messages.MSG_INVALID_PURCHASE_STATUS, Enums.ErrorCode.failed));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.success));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { create, getAll, get, getPayables, getRecoverableTaxReport, update, updateStatus, addPayment, addRefund, deleteByID };
