import { Router } from "express";
import { start, getAll, get, getActive, recordResult, complete } from "../../controller/asset/asset-audit-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const assetAuditRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

assetAuditRoute
  .post("/start", verifyToken, canWrite, start)
  .get("/active", verifyToken, canRead, getActive)
  .get("/", verifyToken, canRead, getAll)
  .get("/:id", verifyToken, canRead, get)
  .post("/:id/result/:assetId", verifyToken, canWrite, recordResult)
  .post("/:id/complete", verifyToken, canWrite, complete);

export default assetAuditRoute;
