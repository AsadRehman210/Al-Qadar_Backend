import { Router } from "express";
import { create, getAll, get, decide, fulfill } from "../../controller/asset/asset-request-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const assetRequestRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

assetRequestRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/:id", verifyToken, canRead, get)
  .post("/:id/decide", verifyToken, canWrite, decide)
  .post("/:id/fulfill", verifyToken, canWrite, fulfill);

export default assetRequestRoute;
