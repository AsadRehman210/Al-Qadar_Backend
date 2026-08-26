import { Router } from "express";
import { create, getAll, getCurrent, get, update } from "../../controller/attendance/attendance-policy-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const attendancePolicyRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

attendancePolicyRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/current", verifyToken, canRead, getCurrent)
  .get("/:id", verifyToken, canRead, get)
  .put("/:id", verifyToken, canWrite, update);

export default attendancePolicyRoute;
