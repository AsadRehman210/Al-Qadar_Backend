import { Router } from "express";
import { create, getAll, get, update, send, cancel } from "../../controller/finance/customer-invoice-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const customerInvoiceRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

customerInvoiceRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/:id", verifyToken, canRead, get)
  .put("/:id", verifyToken, canWrite, update)
  .post("/:id/send", verifyToken, canWrite, send)
  .post("/:id/cancel", verifyToken, canWrite, cancel);

export default customerInvoiceRoute;
