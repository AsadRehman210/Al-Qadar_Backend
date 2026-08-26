import { Request, Response } from "express";
import * as vatConfigService from "../../service/finance/vat-config-service";
import { success, error } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, buildScopeFilter, RequestUser } from "../../utility/helper/tenant-scope";

const get = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const filter = buildScopeFilter(user, req.query as { adminId?: string; merchantId?: string });
    const result = await vatConfigService.get(filter);
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const upsert = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { rate } = req.body;
    if (rate === undefined || rate === null || isNaN(Number(rate))) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }

    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await vatConfigService.upsert(
      { rate: Number(rate), registrationNumber: req.body.registrationNumber },
      scope,
      user.id
    );
    return res.json(success(Messages.MSG_SAVED, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { get, upsert };
