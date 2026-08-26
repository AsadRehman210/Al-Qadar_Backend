import { Router } from "express";
import { create, getCurrent, getHistory, update } from "../../controller/salary/salary-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const salaryRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

salaryRoute
  .post("/", verifyToken, canWrite, create)
  .get("/employee/:employeeId", verifyToken, canRead, getCurrent)
  .get("/employee/:employeeId/history", verifyToken, canRead, getHistory)
  .put("/:id", verifyToken, canWrite, update);

export default salaryRoute;
