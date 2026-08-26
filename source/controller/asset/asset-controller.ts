import { Request, Response } from "express";
import * as assetService from "../../service/asset/asset-service";
import { success, error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const ERROR_MESSAGE: Record<string, string> = {
  not_found: Messages.MSG_ASSET_NOT_EXIST,
  category_not_found: Messages.MSG_ASSET_CATEGORY_NOT_EXIST,
  employee_not_found: Messages.MSG_EMPLOYEE_NOT_EXIST,
  already_disposed: Messages.MSG_ASSET_ALREADY_DISPOSED,
  already_assigned: Messages.MSG_ASSET_ALREADY_ASSIGNED,
  not_assigned: Messages.MSG_ASSET_NOT_ASSIGNED,
  maintenance_record_not_found: Messages.MSG_NO_RECORD,
};

const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.name || !req.body.categoryId) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await assetService.create(req.body, scope, user.id);

    if (result.errorCode !== "success") {
      return res.json(error(ERROR_MESSAGE[result.errorCode] || Messages.MSG_INVALID_DATA, Enums.ErrorCode.not_exist));
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
      page?: string; limit?: string; adminId?: string; merchantId?: string;
      search?: string; status?: string; categoryId?: string; assignedToId?: string; location?: string;
    };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 10 : Number(query.limit);

    const filter = buildScopeFilter(user, query);
    const result = await assetService.getAll(filter, page, limit, {
      search: query.search,
      status: query.status,
      categoryId: query.categoryId,
      assignedToId: query.assignedToId,
      location: query.location,
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
    const result = await assetService.get(req.params.id, filter);

    if (!result) {
      return res.json(error(Messages.MSG_ASSET_NOT_EXIST, Enums.ErrorCode.not_exist));
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
    const result = await assetService.update(req.params.id, req.body, filter);

    if (result.errorCode !== "success") {
      return res.json(error(ERROR_MESSAGE[result.errorCode] || Messages.MSG_ASSET_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const assign = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.employeeId) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await assetService.assign(req.params.id, req.body, filter, user.id);

    if (result.errorCode !== "success") {
      return res.json(error(ERROR_MESSAGE[result.errorCode] || Messages.MSG_ASSET_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const returnAsset = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await assetService.returnAsset(req.params.id, req.body, filter);

    if (result.errorCode !== "success") {
      return res.json(error(ERROR_MESSAGE[result.errorCode] || Messages.MSG_ASSET_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const addMaintenance = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await assetService.addMaintenance(req.params.id, req.body, filter);

    if (result.errorCode !== "success") {
      return res.json(error(ERROR_MESSAGE[result.errorCode] || Messages.MSG_ASSET_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_SAVED, Enums.ErrorCode.success, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const updateMaintenance = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await assetService.updateMaintenance(req.params.id, req.params.recordId, req.body, filter);

    if (result.errorCode !== "success") {
      return res.json(error(ERROR_MESSAGE[result.errorCode] || Messages.MSG_ASSET_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const updateInsurance = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await assetService.updateInsurance(req.params.id, req.body, filter);

    if (result.errorCode !== "success") {
      return res.json(error(ERROR_MESSAGE[result.errorCode] || Messages.MSG_ASSET_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const transferLocation = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.location) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await assetService.transferLocation(req.params.id, req.body, filter, user.id);

    if (result.errorCode !== "success") {
      return res.json(error(ERROR_MESSAGE[result.errorCode] || Messages.MSG_ASSET_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const addDocument = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body.name) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await assetService.addDocument(req.params.id, req.body, filter, user.id);

    if (result.errorCode !== "success") {
      return res.json(error(ERROR_MESSAGE[result.errorCode] || Messages.MSG_ASSET_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_SAVED, Enums.ErrorCode.success, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const removeDocument = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await assetService.removeDocument(req.params.id, req.params.docId, filter);

    if (result.errorCode !== "success") {
      return res.json(error(ERROR_MESSAGE[result.errorCode] || Messages.MSG_ASSET_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const dispose = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await assetService.dispose(req.params.id, req.body, filter, user.id);

    if (result.errorCode !== "success") {
      return res.json(error(ERROR_MESSAGE[result.errorCode] || Messages.MSG_ASSET_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_UPDATED, Enums.ErrorCode.updated, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getSummary = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await assetService.getSummary(filter);
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getDistinctLocations = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await assetService.getDistinctLocations(filter);
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export {
  create,
  getAll,
  get,
  update,
  assign,
  returnAsset,
  addMaintenance,
  updateMaintenance,
  updateInsurance,
  transferLocation,
  addDocument,
  removeDocument,
  dispose,
  getDistinctLocations,
  getSummary,
};
