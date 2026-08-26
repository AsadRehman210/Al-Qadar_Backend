import { Router } from "express";
import {
  applyWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
  markWithdrawalPaid,
  getWithdrawals,
  getWithdrawal,
  getWithdrawalsByEmployee,
} from "../../controller/provident-fund/pf-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const pfWithdrawalRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

pfWithdrawalRoute
  .post("/", verifyToken, canWrite, applyWithdrawal)
  .get("/", verifyToken, canRead, getWithdrawals)
  .get("/employee/:employeeId", verifyToken, canRead, getWithdrawalsByEmployee)
  .get("/:id", verifyToken, canRead, getWithdrawal)
  .patch("/:id/approve", verifyToken, canWrite, approveWithdrawal)
  .patch("/:id/reject", verifyToken, canWrite, rejectWithdrawal)
  .patch("/:id/mark-paid", verifyToken, canWrite, markWithdrawalPaid);

export default pfWithdrawalRoute;
