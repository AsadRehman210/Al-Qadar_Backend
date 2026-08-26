import { Request, Response } from "express";
import {
  createAdmin,
  getAll,
  get,
  getSummary,
  update,
  activateAdmin,
  deactivateAdmin,
  unlockAdmin,
  recordPayment,
  getPaymentHistory,
} from "../../service/admin/admin-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";

const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, email, password, themeColor } = req.body;
    if (!name || !email || !password) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    if (themeColor && !/^#[0-9a-fA-F]{6}$/.test(themeColor)) {
      return res.json(error(Messages.MSG_INVALID_THEME_COLOR, Enums.ErrorCode.failed));
    }

    const createdById = req.user?.id as string;
    const result = await createAdmin(req.body, createdById);

    if (result.errorCode === Enums.ErrorCode.duplicate_entry) {
      return res.json(error(Messages.MSG_DUPLICATE_ENTRY, Enums.ErrorCode.duplicate_entry));
    }
    if (result.errorCode === Enums.ErrorCode.success) {
      return res.json(success(Messages.MSG_SAVED, Enums.ErrorCode.success, result.result));
    }
    return res.json(error(Messages.MSG_SOME_ERROR_OCCURED, Enums.ErrorCode.failed));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getAllAdmins = async (req: Request, res: Response): Promise<Response> => {
  try {
    const query = req.query as { page?: string; limit?: string; search?: string; status?: string };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const result = await getAll(page, limit, { search: query.search, status: query.status });

    if (!result.result.length) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(pagination(result.result, result.totalCount, page, limit));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getAdminSummary = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const result = await getSummary();
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getAdmin = async (req: Request, res: Response): Promise<Response> => {
  try {
    const result = await get(req.params.id);
    if (!result) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const updateAdmin = async (req: Request, res: Response): Promise<Response> => {
  try {
    const result = await update(req.params.id, req.body);
    if (result.errorCode === Enums.ErrorCode.not_exist) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const activate = async (req: Request, res: Response): Promise<Response> => {
  try {
    const result = await activateAdmin(req.params.id);
    if (result.errorCode === Enums.ErrorCode.not_exist) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const deactivate = async (req: Request, res: Response): Promise<Response> => {
  try {
    const result = await deactivateAdmin(req.params.id);
    if (result.errorCode === Enums.ErrorCode.not_exist) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const unlock = async (req: Request, res: Response): Promise<Response> => {
  try {
    const result = await unlockAdmin(req.params.id);
    if (result.errorCode === Enums.ErrorCode.not_exist) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === Enums.ErrorCode.failed) {
      return res.json(error(Messages.MSG_ACCOUNT_NOT_LOCKED, Enums.ErrorCode.failed));
    }
    return res.json(success(Messages.MSG_ACCOUNT_UNLOCKED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const addPayment = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.amount || !req.body.date || !req.body.expiryDate) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const recorder = { id: req.user?.id as string };
    const result = await recordPayment(req.params.id, req.body, recorder);
    if (result.errorCode === Enums.ErrorCode.not_exist) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_SAVED, Enums.ErrorCode.success, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getPayments = async (req: Request, res: Response): Promise<Response> => {
  try {
    const result = await getPaymentHistory(req.params.id);
    if (!result.length) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_LIST, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { create, getAllAdmins, getAdminSummary, getAdmin, updateAdmin, activate, deactivate, unlock, addPayment, getPayments };
