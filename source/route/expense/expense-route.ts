import { Router } from "express";
import {
  apply,
  managerApprove,
  managerReject,
  hrApprove,
  hrReject,
  markReimbursed,
  getAll,
  get,
  getByEmployee,
} from "../../controller/expense/expense-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const expenseRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

expenseRoute
  .post("/", verifyToken, canWrite, apply)
  .get("/", verifyToken, canRead, getAll)
  .get("/employee/:employeeId", verifyToken, canRead, getByEmployee)
  .get("/:id", verifyToken, canRead, get)
  .patch("/:id/manager-approve", verifyToken, canWrite, managerApprove)
  .patch("/:id/manager-reject", verifyToken, canWrite, managerReject)
  .patch("/:id/hr-approve", verifyToken, canWrite, hrApprove)
  .patch("/:id/hr-reject", verifyToken, canWrite, hrReject)
  .patch("/:id/reimburse", verifyToken, canWrite, markReimbursed);

export default expenseRoute;
