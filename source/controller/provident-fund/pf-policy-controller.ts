import { Request, Response } from "express";
import * as pfPolicyService from "../../service/provident-fund/pf-policy-service";
import { success, error } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";
import { resolveTenantScope, RequestUser } from "../../utility/helper/tenant-scope";

const upsert = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { employeeRate, employerRate } = req.body;
    if (employeeRate === undefined || employerRate === undefined) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }

    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.body);
    const result = await pfPolicyService.upsertPolicy(req.body, scope, user.id);
    return res.json(success(Messages.MSG_SAVED, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const get = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as RequestUser;
    const scope = resolveTenantScope(user, req.query as { adminId?: string; merchantId?: string });
    const result = await pfPolicyService.getPolicy(scope);

    if (!result) {
      return res.json(error(Messages.MSG_PF_POLICY_NOT_EXIST, Enums.ErrorCode.not_exist));
    }
    return res.json(success(Messages.MSG_DATA_FOUND, Enums.ErrorCode.success, result));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { upsert, get };
