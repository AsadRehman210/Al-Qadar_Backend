import { Router } from "express";
import { create, getAll, get, update, approve, cancel } from "../../controller/finance/vendor-bill-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const vendorBillRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

vendorBillRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/:id", verifyToken, canRead, get)
  .put("/:id", verifyToken, canWrite, update)
  .post("/:id/approve", verifyToken, canWrite, approve)
  .post("/:id/cancel", verifyToken, canWrite, cancel);

export default vendorBillRoute;
