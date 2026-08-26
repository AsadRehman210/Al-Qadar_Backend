import { Router } from "express";
import {
  apply,
  getAll,
  getSummary,
  get,
  getByEmployee,
  getBalances,
  managerApprove,
  managerReject,
  hrApprove,
  hrReject,
  cancel,
} from "../../controller/leave/leave-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const leaveRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

leaveRoute
  .post("/", verifyToken, canWrite, apply)
  .get("/", verifyToken, canRead, getAll)
  .get("/summary", verifyToken, canRead, getSummary)
  .get("/employee/:employeeId", verifyToken, canRead, getByEmployee)
  .get("/employee/:employeeId/balance", verifyToken, canRead, getBalances)
  .get("/:id", verifyToken, canRead, get)
  .patch("/:id/manager-approve", verifyToken, canWrite, managerApprove)
  .patch("/:id/manager-reject", verifyToken, canWrite, managerReject)
  .patch("/:id/hr-approve", verifyToken, canWrite, hrApprove)
  .patch("/:id/hr-reject", verifyToken, canWrite, hrReject)
  .patch("/:id/cancel", verifyToken, canWrite, cancel);

export default leaveRoute;
