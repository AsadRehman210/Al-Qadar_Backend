import { Request, Response } from "express";
import * as bankAccountService from "../../service/finance/bank-account-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.name || !req.body.type) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }

    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await bankAccountService.create(req.body, scope, user.id);
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
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await bankAccountService.getAll(filter, page, limit, {
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

const get = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await bankAccountService.get(req.params.id, filter);

    if (!result) {
      return res.json(error(Messages.MSG_BANK_ACCOUNT_NOT_EXIST, Enums.ErrorCode.not_exist));
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
    const result = await bankAccountService.update(req.params.id, req.body, filter);

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_BANK_ACCOUNT_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const postEntry = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { date, type, amount, contraAccountId, description, reference } = req.body as {
      date?: string;
      type?: "deposit" | "withdrawal" | "bank_charge";
      amount?: number;
      contraAccountId?: string;
      description?: string;
      reference?: string;
    };
    if (!date || !type || !amount || !contraAccountId) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }

    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await bankAccountService.postEntry(
      req.params.id,
      { date: new Date(date), type, amount, contraAccountId, description, reference },
      scope,
      user.id
    );

    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_BANK_ACCOUNT_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_SAVED, Enums.ErrorCode.success));
  } catch (err: any) {
    if (err.message && err.message.includes("not balanced")) {
      return res.json(error(Messages.MSG_JOURNAL_NOT_BALANCED, Enums.ErrorCode.failed));
    }
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { create, getAll, get, update, postEntry };
