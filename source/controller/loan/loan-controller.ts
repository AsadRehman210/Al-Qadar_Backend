import { Request, Response } from "express";
import * as loanService from "../../service/loan/loan-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const errorMessageFor = (errorCode: string): { message: string; code: Enums.ErrorCode } => {
  switch (errorCode) {
    case "invalid_employee":
      return { message: Messages.MSG_EMPLOYEE_NOT_EXIST, code: Enums.ErrorCode.invalid_id };
    case "invalid_amount":
      return { message: Messages.MSG_LOAN_INVALID_AMOUNT, code: Enums.ErrorCode.failed };
    case "invalid_status":
      return { message: Messages.MSG_INVALID_LOAN_STATUS, code: Enums.ErrorCode.failed };
    case "installment_not_found":
      return { message: Messages.MSG_INSTALLMENT_NOT_EXIST, code: Enums.ErrorCode.not_exist };
    case "installment_already_paid":
      return { message: Messages.MSG_INSTALLMENT_ALREADY_PAID, code: Enums.ErrorCode.failed };
    case "not_found":
      return { message: Messages.MSG_NO_RECORD, code: Enums.ErrorCode.not_exist };
    default:
      return { message: Messages.MSG_SOME_ERROR_OCCURED, code: Enums.ErrorCode.failed };
  }
};

const apply = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { employeeId, loanType, loanAmount, numberOfInstallments, appliedVia } = req.body;
    if (!employeeId || !loanType || !loanAmount || !numberOfInstallments || !appliedVia) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }

    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await loanService.apply(req.body, scope, user.id);

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
    const result = await loanService.managerApprove(req.params.id, filter, user.id, req.body?.comments);

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
    const result = await loanService.managerReject(req.params.id, filter, user.id, req.body?.comments);

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
    const result = await loanService.hrApprove(req.params.id, filter, user.id);

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
    const result = await loanService.hrReject(req.params.id, filter, user.id, req.body?.rejectionReason);

    if (result.errorCode !== "success") {
      const { message, code } = errorMessageFor(result.errorCode);
      return res.json(error(message, code));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const disburse = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await loanService.disburse(req.params.id, filter, user.id);

    if (result.errorCode !== "success") {
      const { message, code } = errorMessageFor(result.errorCode);
      return res.json(error(message, code));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const recordRepayment = async (req: Request, res: Response): Promise<Response> => {
  try {
    const installmentNo = Number(req.params.installmentNo);
    if (isNaN(installmentNo)) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await loanService.recordRepayment(req.params.id, installmentNo, filter, user.id);

    if (result.errorCode !== "success") {
      const { message, code } = errorMessageFor(result.errorCode);
      return res.json(error(message, code));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const preClose = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const requestedAmount = typeof req.body?.preClosureAmount === "number" ? req.body.preClosureAmount : undefined;
    const result = await loanService.preClose(req.params.id, filter, user.id, requestedAmount);

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
      loanType?: string;
      employeeId?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await loanService.getAll(filter, page, limit, {
      search: query.search,
      status: query.status,
      loanType: query.loanType,
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

const get = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await loanService.get(req.params.id, filter);

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
    const result = await loanService.getByEmployee(req.params.employeeId, filter);
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
  disburse,
  recordRepayment,
  preClose,
  getAll,
  get,
  getByEmployee,
};
