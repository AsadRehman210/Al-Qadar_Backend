import { Request, Response } from "express";
import * as onboardingService from "../../service/onboarding/onboarding-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const errorMessageFor = (errorCode: string): { message: string; code: Enums.ErrorCode } => {
  switch (errorCode) {
    case "invalid_employee":
      return { message: Messages.MSG_EMPLOYEE_NOT_EXIST, code: Enums.ErrorCode.invalid_id };
    case "not_found":
      return { message: Messages.MSG_NO_RECORD, code: Enums.ErrorCode.not_exist };
    default:
      return { message: Messages.MSG_SOME_ERROR_OCCURED, code: Enums.ErrorCode.failed };
  }
};

const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.employeeId) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await onboardingService.create(req.body, scope, user.id);

    if (result.errorCode !== "success") {
      const { message, code } = errorMessageFor(result.errorCode);
      return res.json(error(message, code));
    }
    return res.json(success(Messages.MSG_SAVED, Enums.ErrorCode.success, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const toggleTask = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.query as { adminId?: string; merchantId?: string });
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await onboardingService.toggleTask(req.params.id, req.params.templateId, filter, scope);

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
      employeeId?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await onboardingService.getAll(filter, page, limit, {
      search: query.search,
      status: query.status,
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
    const result = await onboardingService.getSummary(filter);
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const get = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await onboardingService.get(req.params.id, filter);
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
    const result = await onboardingService.getByEmployee(req.params.employeeId, filter);
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getByCandidate = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await onboardingService.getByCandidate(req.params.candidateId, filter);
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { create, toggleTask, getAll, getSummary, get, getByEmployee, getByCandidate };
