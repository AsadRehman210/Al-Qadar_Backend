import { Request, Response } from "express";
import {
  createMerchant,
  updateMerchant,
  linkToAdmin,
  unlinkFromAdmin,
  activateMerchant,
  deactivateMerchant,
  unlockMerchant,
  recordPayment,
  getPaymentHistory,
  getAll,
  get,
  getSummary,
} from "../../service/merchant/merchant-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";

const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }

    const creator = {
      id: req.user?.id as string,
      role: req.user?.role as Enums.AccountRole,
    };
    const result = await createMerchant(req.body, creator);

    if (result.errorCode === Enums.ErrorCode.duplicate_entry) {
      return res.json(error(Messages.MSG_DUPLICATE_ENTRY, Enums.ErrorCode.duplicate_entry));
    }
    if (result.errorCode === Enums.ErrorCode.invalid_id) {
      return res.json(error(Messages.MSG_ADMIN_NOT_EXIST, Enums.ErrorCode.invalid_id));
    }
    if (result.errorCode === Enums.ErrorCode.success) {
      return res.json(success(Messages.MSG_SAVED, Enums.ErrorCode.success, result.result));
    }
    return res.json(error(Messages.MSG_SOME_ERROR_OCCURED, Enums.ErrorCode.failed));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const update = async (req: Request, res: Response): Promise<Response> => {
  try {
    const requester = {
      id: req.user?.id as string,
      role: req.user?.role as Enums.AccountRole,
    };
    const result = await updateMerchant(req.params.id, req.body, requester);
    if (result.errorCode === Enums.ErrorCode.not_exist) {
      return res.json(error(Messages.MSG_MERCHANT_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === Enums.ErrorCode.no_access) {
      return res.json(error(Messages.MSG_USER_IS_NOT_AUTHORIZED, Enums.ErrorCode.no_access));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const linkAdmin = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.adminId) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const result = await linkToAdmin(req.params.id, req.body.adminId);
    if (result.errorCode === Enums.ErrorCode.not_exist) {
      return res.json(error(Messages.MSG_MERCHANT_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === Enums.ErrorCode.invalid_id) {
      return res.json(error(Messages.MSG_ADMIN_NOT_EXIST, Enums.ErrorCode.invalid_id));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const unlinkAdmin = async (req: Request, res: Response): Promise<Response> => {
  try {
    const result = await unlinkFromAdmin(req.params.id);
    if (result.errorCode === Enums.ErrorCode.not_exist) {
      return res.json(error(Messages.MSG_MERCHANT_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const activate = async (req: Request, res: Response): Promise<Response> => {
  try {
    const result = await activateMerchant(req.params.id);
    if (result.errorCode === Enums.ErrorCode.not_exist) {
      return res.json(error(Messages.MSG_MERCHANT_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const deactivate = async (req: Request, res: Response): Promise<Response> => {
  try {
    const result = await deactivateMerchant(req.params.id);
    if (result.errorCode === Enums.ErrorCode.not_exist) {
      return res.json(error(Messages.MSG_MERCHANT_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const unlock = async (req: Request, res: Response): Promise<Response> => {
  try {
    const unlocker = {
      id: req.user?.id as string,
      role: req.user?.role as Enums.AccountRole,
    };
    const result = await unlockMerchant(req.params.id, unlocker);
    if (result.errorCode === Enums.ErrorCode.not_exist) {
      return res.json(error(Messages.MSG_MERCHANT_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === Enums.ErrorCode.no_access) {
      return res.json(error(Messages.MSG_USER_IS_NOT_AUTHORIZED, Enums.ErrorCode.no_access));
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
    const recorder = {
      id: req.user?.id as string,
      role: req.user?.role as Enums.AccountRole,
    };
    const result = await recordPayment(req.params.id, req.body, recorder);
    if (result.errorCode === Enums.ErrorCode.not_exist) {
      return res.json(error(Messages.MSG_MERCHANT_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === Enums.ErrorCode.no_access) {
      return res.json(error(Messages.MSG_USER_IS_NOT_AUTHORIZED, Enums.ErrorCode.no_access));
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

const getAllMerchants = async (req: Request, res: Response): Promise<Response> => {
  try {
    const requester = {
      id: req.user?.id as string,
      role: req.user?.role as Enums.AccountRole,
    };
    const query = req.query as {
      page?: string;
      limit?: string;
      adminId?: string;
      search?: string;
      status?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const result = await getAll(requester, query, page, limit, {
      search: query.search,
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

const getMerchantSummary = async (req: Request, res: Response): Promise<Response> => {
  try {
    const requester = {
      id: req.user?.id as string,
      role: req.user?.role as Enums.AccountRole,
    };
    const result = await getSummary(requester, req.query as { adminId?: string });
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getMerchant = async (req: Request, res: Response): Promise<Response> => {
  try {
    const requester = {
      id: req.user?.id as string,
      role: req.user?.role as Enums.AccountRole,
    };
    const result = await get(req.params.id, requester, req.query as { adminId?: string });
    if (!result) {
      return res.json(error(Messages.MSG_MERCHANT_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export {
  create,
  update,
  linkAdmin,
  unlinkAdmin,
  activate,
  deactivate,
  unlock,
  addPayment,
  getPayments,
  getAllMerchants,
  getMerchantSummary,
  getMerchant,
};
