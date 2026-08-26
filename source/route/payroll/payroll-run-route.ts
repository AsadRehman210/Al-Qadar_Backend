import { Router } from "express";
import {
  create,
  getAll,
  getSummary,
  get,
  getByEmployee,
  getAllEmployeesHistory,
  recomputeLine,
  submitForApproval,
  approve,
  reject,
  process,
  markAsPaid,
  cancel,
} from "../../controller/payroll/payroll-run-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const payrollRunRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

payrollRunRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/summary", verifyToken, canRead, getSummary)
  .get("/employees-history", verifyToken, canRead, getAllEmployeesHistory)
  .get("/employee/:employeeId", verifyToken, canRead, getByEmployee)
  .get("/:id", verifyToken, canRead, get)
  .patch("/:id/line/:employeeId", verifyToken, canWrite, recomputeLine)
  .patch("/:id/submit", verifyToken, canWrite, submitForApproval)
  .patch("/:id/approve", verifyToken, canWrite, approve)
  .patch("/:id/reject", verifyToken, canWrite, reject)
  .patch("/:id/process", verifyToken, canWrite, process)
  .patch("/:id/mark-paid", verifyToken, canWrite, markAsPaid)
  .patch("/:id/cancel", verifyToken, canWrite, cancel);

export default payrollRunRoute;
