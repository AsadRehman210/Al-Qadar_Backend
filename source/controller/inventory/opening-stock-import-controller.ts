import { Request, Response } from "express";
import * as openingStockImportService from "../../service/inventory/opening-stock-import-service";
import { success, error } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { RequestUser } from "../../utility/helper/tenant-scope";

const getStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const query = req.query as { adminId?: string; merchantId?: string };
    const result = await openingStockImportService.getStatus(user, query);
    if (result.errorCode === "tenant_required") {
      return res.json(error(Messages.MSG_OPENING_STOCK_TENANT_REQUIRED, Enums.ErrorCode.failed));
    }
    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const importRows = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const result = await openingStockImportService.importRows(user, req.body || {}, user.id);
    if (result.errorCode === "tenant_required") {
      return res.json(error(Messages.MSG_OPENING_STOCK_TENANT_REQUIRED, Enums.ErrorCode.failed));
    }
    if (result.errorCode === "not_found") {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    if (result.errorCode === "already_imported") {
      return res.json(error(Messages.MSG_OPENING_STOCK_ALREADY_IMPORTED, Enums.ErrorCode.failed));
    }
    if (result.errorCode === "invalid" || result.errorCode === "failed") {
      return res.json(error(Messages.MSG_OPENING_STOCK_IMPORT_INVALID, Enums.ErrorCode.failed, result.errors));
    }
    return res.json(success(Messages.MSG_OPENING_STOCK_IMPORTED, Enums.ErrorCode.success, result.result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { getStatus, importRows };
