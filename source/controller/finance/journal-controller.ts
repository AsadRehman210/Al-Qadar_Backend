import { Request, Response } from "express";
import * as journalService from "../../service/finance/journal-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { date, memo, lines } = req.body as {
      date?: string;
      memo?: string;
      lines?: { accountId: string; debit: number; credit: number }[];
    };
    if (!date || !Array.isArray(lines) || lines.length < 2) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }

    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const journal = await journalService.createJournalEntry({
      tenant: scope,
      createdBy: user.id,
      date: new Date(date),
      memo,
      lines,
    });
    return res.json(success(Messages.MSG_SAVED, Enums.ErrorCode.success, { id: String(journal._id), journalNo: journal.journalNo }));
  } catch (err: any) {
    if (err.message && err.message.includes("not balanced")) {
      return res.json(error(Messages.MSG_JOURNAL_NOT_BALANCED, Enums.ErrorCode.failed));
    }
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
      fromDate?: string;
      toDate?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await journalService.getAll(filter, page, limit, {
      search: query.search,
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

const get = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await journalService.get(req.params.id, filter);

    if (!result) {
      return res.json(error(Messages.MSG_JOURNAL_ENTRY_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { create, getAll, get };
