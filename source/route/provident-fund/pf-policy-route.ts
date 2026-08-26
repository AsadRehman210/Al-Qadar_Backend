import { Router } from "express";
import { upsert, get } from "../../controller/provident-fund/pf-policy-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const pfPolicyRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

pfPolicyRoute
  .post("/", verifyToken, canWrite, upsert)
  .get("/", verifyToken, canRead, get);

export default pfPolicyRoute;
