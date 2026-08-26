import { Request, Response } from "express";
import * as debitNoteService from "../../service/purchase/debit-note-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.supplierId || !req.body.originalInvoiceId || !req.body.warehouseId || !req.body.products?.length) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await debitNoteService.create(req.body, scope, user.id);
    if (result.errorCode === "invoice_not_found") {
      return res.json(error(Messages.MSG_DEBIT_NOTE_INVOICE_NOT_FOUND, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === "supplier_mismatch") {
      return res.json(error(Messages.MSG_DEBIT_NOTE_SUPPLIER_MISMATCH, Enums.ErrorCode.failed));
    }
    if (result.errorCode === "exceeds_line_qty") {
      return res.json(error(Messages.MSG_DEBIT_NOTE_EXCEEDS_INVOICE, Enums.ErrorCode.failed, result.overReturns));
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
      supplierId?: string;
      status?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await debitNoteService.getAll(filter, page, limit, {
      search: query.search,
      supplierId: query.supplierId,
      status: query.status,
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
    const result = await debitNoteService.get(req.params.id, filter);

    if (!result) {
      return res.json(error(Messages.MSG_DEBIT_NOTE_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getReturnableLines = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await debitNoteService.getReturnableLines(req.params.invoiceId, filter);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_PURCHASE_INVOICE_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, { invoice: result.invoice, lines: result.lines }));
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
    const result = await debitNoteService.updateStatus(req.params.id, req.body.status, filter, user.id);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_DEBIT_NOTE_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === "invalid_status") {
      return res.json(error(Messages.MSG_INVALID_DEBIT_NOTE_STATUS, Enums.ErrorCode.failed));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { create, getAll, get, getReturnableLines, updateStatus };
