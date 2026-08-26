import { Request, Response } from "express";
import * as spService from "../../service/payroll/special-payment-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const errorMessageFor = (errorCode: string): { message: string; code: Enums.ErrorCode } => {
  switch (errorCode) {
    case "invalid_type":
      return { message: Messages.MSG_INVALID_SPECIAL_PAYMENT_TYPE, code: Enums.ErrorCode.invalid_id };
    case "no_employees":
      return { message: Messages.MSG_NO_ELIGIBLE_EMPLOYEES, code: Enums.ErrorCode.failed };
    case "invalid_status":
      return { message: Messages.MSG_INVALID_SPECIAL_PAYMENT_STATUS, code: Enums.ErrorCode.failed };
    case "not_found":
      return { message: Messages.MSG_NO_RECORD, code: Enums.ErrorCode.not_exist };
    default:
      return { message: Messages.MSG_SOME_ERROR_OCCURED, code: Enums.ErrorCode.failed };
  }
};

const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { title, typeId, target } = req.body;
    if (!title || !typeId || !target) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await spService.create(req.body, scope, user.id);
    if (result.errorCode !== "success") {
      const { message, code } = errorMessageFor(result.errorCode);
      return res.json(error(message, code));
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
      typeId?: string;
      target?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await spService.getAll(filter, page, limit, {
      search: query.search,
      status: query.status,
      typeId: query.typeId,
      target: query.target,
    });

    if (!result.result.length) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(pagination(result.result, result.totalCount, page, limit));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getSummary = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await spService.getSummary(filter);
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const get = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await spService.get(req.params.id, filter);
    if (!result) return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const submitForApproval = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await spService.submitForApproval(req.params.id, filter);
    if (result.errorCode !== "success") {
      const { message, code } = errorMessageFor(result.errorCode);
      return res.json(error(message, code));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const approve = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await spService.approve(req.params.id, filter, user.id);
    if (result.errorCode !== "success") {
      const { message, code } = errorMessageFor(result.errorCode);
      return res.json(error(message, code));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const reject = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await spService.reject(req.params.id, filter, req.body?.reason);
    if (result.errorCode !== "success") {
      const { message, code } = errorMessageFor(result.errorCode);
      return res.json(error(message, code));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const markPaid = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await spService.markPaid(req.params.id, filter, user.id);
    if (result.errorCode !== "success") {
      const { message, code } = errorMessageFor(result.errorCode);
      return res.json(error(message, code));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const cancel = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await spService.cancel(req.params.id, filter);
    if (result.errorCode !== "success") {
      const { message, code } = errorMessageFor(result.errorCode);
      return res.json(error(message, code));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { create, getAll, getSummary, get, submitForApproval, approve, reject, markPaid, cancel };
