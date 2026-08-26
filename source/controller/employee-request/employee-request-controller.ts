import { Request, Response } from "express";
import * as requestService from "../../service/employee-request/employee-request-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const errorMessageFor = (errorCode: string): { message: string; code: Enums.ErrorCode } => {
  switch (errorCode) {
    case "invalid_employee":
      return { message: Messages.MSG_EMPLOYEE_NOT_EXIST, code: Enums.ErrorCode.invalid_id };
    case "invalid_status":
      return { message: Messages.MSG_INVALID_REQUEST_STATUS, code: Enums.ErrorCode.failed };
    case "not_found":
      return { message: Messages.MSG_NO_RECORD, code: Enums.ErrorCode.not_exist };
    default:
      return { message: Messages.MSG_SOME_ERROR_OCCURED, code: Enums.ErrorCode.failed };
  }
};

const apply = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { type, employeeId, appliedVia } = req.body;
    if (!type || !employeeId || !appliedVia) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }

    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await requestService.apply(req.body, scope, user.id);

    if (result.errorCode !== "success") {
      const { message, code } = errorMessageFor(result.errorCode);
      return res.json(error(message, code));
    }
    return res.json(success(Messages.MSG_SAVED, Enums.ErrorCode.success, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const managerApprove = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await requestService.managerApprove(req.params.id, filter, user.id, req.body?.comments);

    if (result.errorCode !== "success") {
      const { message, code } = errorMessageFor(result.errorCode);
      return res.json(error(message, code));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const managerReject = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await requestService.managerReject(req.params.id, filter, user.id, req.body?.comments);

    if (result.errorCode !== "success") {
      const { message, code } = errorMessageFor(result.errorCode);
      return res.json(error(message, code));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const hrApprove = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await requestService.hrApprove(req.params.id, filter, user.id, req.body?.comments);

    if (result.errorCode !== "success") {
      const { message, code } = errorMessageFor(result.errorCode);
      return res.json(error(message, code));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const hrReject = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await requestService.hrReject(req.params.id, filter, user.id, req.body?.comments);

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
    const result = await requestService.cancel(req.params.id, filter);

    if (result.errorCode !== "success") {
      const { message, code } = errorMessageFor(result.errorCode);
      return res.json(error(message, code));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
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
      type?: string;
      employeeId?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await requestService.getAll(filter, page, limit, {
      search: query.search,
      status: query.status,
      type: query.type,
      employeeId: query.employeeId,
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
    const result = await requestService.getSummary(filter);
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const get = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await requestService.get(req.params.id, filter);

    if (!result) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getByEmployee = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await requestService.getByEmployee(req.params.employeeId, filter);
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export {
  apply,
  managerApprove,
  managerReject,
  hrApprove,
  hrReject,
  cancel,
  getAll,
  getSummary,
  get,
  getByEmployee,
};
