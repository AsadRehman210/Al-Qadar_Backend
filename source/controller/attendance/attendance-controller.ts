import { Request, Response } from "express";
import * as attendanceService from "../../service/attendance/attendance-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const mark = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.employeeId || !req.body.date || !req.body.status) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }

    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await attendanceService.markAttendance(req.body, scope, user.id);

    if (result.errorCode === "invalid_employee") {
      return res.json(error(Messages.MSG_EMPLOYEE_NOT_EXIST, Enums.ErrorCode.invalid_id));
    }
    return res.json(success(Messages.MSG_SAVED, Enums.ErrorCode.success, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const markBulk = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { employeeIds, startDate, endDate, status } = req.body;
    if (!Array.isArray(employeeIds) || !employeeIds.length || !startDate || !endDate || !status) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }

    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await attendanceService.markAttendanceBulk(req.body, scope, user.id);

    return res.json(success(Messages.MSG_SAVED, Enums.ErrorCode.success, result));
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
      employeeId?: string;
      startDate?: string;
      endDate?: string;
      month?: string;
      year?: string;
      status?: string;
      search?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await attendanceService.getAll(filter, query, page, limit);

    if (!result.result.length) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(pagination(result.result, result.totalCount, page, limit));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getTodayStats = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await attendanceService.getTodayStats(filter);
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getSummary = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { month, year } = req.query as { month?: string; year?: string };
    if (!month || !year) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }

    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await attendanceService.getSummary(req.params.employeeId, month, year, filter);

    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const get = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await attendanceService.get(req.params.id, filter);

    if (!result) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const update = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await attendanceService.update(req.params.id, req.body, filter, scope);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
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
    const deleted = await attendanceService.deleteByID(req.params.id, filter);

    if (!deleted) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DELETE_SUCCESS, Enums.ErrorCode.success));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { mark, markBulk, getAll, getSummary, getTodayStats, get, update, deleteByID };
