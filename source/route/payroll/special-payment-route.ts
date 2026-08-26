import { Router } from "express";
import {
  create,
  getAll,
  getSummary,
  get,
  submitForApproval,
  approve,
  reject,
  markPaid,
  cancel,
} from "../../controller/payroll/special-payment-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const specialPaymentRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

specialPaymentRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/summary", verifyToken, canRead, getSummary)
  .get("/:id", verifyToken, canRead, get)
  .patch("/:id/submit", verifyToken, canWrite, submitForApproval)
  .patch("/:id/approve", verifyToken, canWrite, approve)
  .patch("/:id/reject", verifyToken, canWrite, reject)
  .patch("/:id/mark-paid", verifyToken, canWrite, markPaid)
  .patch("/:id/cancel", verifyToken, canWrite, cancel);

export default specialPaymentRoute;
