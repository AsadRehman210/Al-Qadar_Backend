import { Request, Response } from 'express';
import {
  post as postService,
  getAll as getAllService,
  get as getService,
  deleteByID as deleteByIDService,
} from '../../service/user/user-service';
import { success, error, pagination } from '../../utility/helper/common';
import { Messages } from '../../utility/helper/constants/message';
import { HelperFunctions } from '../../utility/helper/helper-function';
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";
import { BCRYPT_SALT_ROUNDS } from "../../utility/helper/constants/security";
import bcrypt from "bcrypt";

const post = async (req: Request, res: Response): Promise<Response> => {
  try {
    const body = req.body;
    // Only hash when a password was actually provided — this endpoint is
    // reused for both create and edit (edit sends no password when it isn't
    // being changed), and bcrypt.hashSync(undefined, ...) throws.
    if (body.password) {
      body.password = bcrypt.hashSync(body.password, BCRYPT_SALT_ROUNDS);
    } else {
      delete body.password;
    }

    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, body);
    const result = await postService(body, scope);

    if (result.errorCode === Enums.ErrorCode.updated) {
      const data = success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result);
      return res.json(data);
    } else if (result.errorCode === Enums.ErrorCode.success) {
      const data = success(Messages.MSG_SUCCESS, Enums.ErrorCode.success, result.result);
      return res.json(data);
    } else if (result.errorCode === Enums.ErrorCode.duplicate_entry) {
      const data = error(Messages.MSG_DUPLICATE_ENTRY, Enums.ErrorCode.failed);
      return res.json(data);
    }
    else {
      const data = error(Messages.MSG_INVALID_CRED, Enums.ErrorCode.failed);
      return res.json(data);
    }
  } catch (err: any) {
    const data = error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.failed, err.message);
    return res.json(data);
  }
};

const getAll = async (req: Request, res: Response): Promise<Response> => {
  try {
    const body = req.query;
    if (!body.page || isNaN(Number(body.page)) || Number(body.page) < 0) {
      body.page = "1";
    }
    if (!body.limit || isNaN(Number(body.limit)) || Number(body.limit) < 0) {
      body.limit = "10";
    }

    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await getAllService(filter, parseInt(body.page as string), parseInt(body.limit as string));

    if (!HelperFunctions.isNullOrEmptyArray(result.result)) {
      const data = pagination(result.result, result.totalCount, Number(body.page), Number(body.limit));
      return res.json(data);
    } else {
      const data = error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist);
      return res.json(data);
    }
  } catch (err: any) {
    const data = error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.failed, err.message);
    return res.json(data);
  }
};

const get = async (req: Request, res: Response): Promise<Response> => {
  try {
    const id = req.query.id;
    let result;
    if (id) {
      const user = req.user as RequestUser;
      const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
      result = await getService(id.toString(), filter);
    }

    if (result) {
      const data = success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result);
      return res.json(data);
    } else {
      const data = error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist);
      return res.json(data);
    }
  } catch (err: any) {
    const data = error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.failed, err.message);
    return res.json(data);
  }
};

const deleteByID = async (req: Request, res: Response): Promise<Response> => {
  try {
    const id = req.body.id;
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await deleteByIDService(id, filter);

    if (result?.trueOrFalse == true) {
      const data = success(Messages.MSG_DELETE_SUCCESS, Enums.ErrorCode.success, result);
      return res.json(data);
    } else {
      const data = error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist);
      return res.json(data);
    }
  } catch (err: any) {
    const data = error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.failed, err);
    return res.json(data);
  }
};



export {
  post,
  getAll,
  get,
  deleteByID
};
