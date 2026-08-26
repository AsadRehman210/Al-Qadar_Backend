import { Router } from "express";
import {
  create,
  getAll,
  get,
  getPayables,
  update,
  updateStatus,
  addPayment,
  addRefund,
  deleteByID,
} from "../../controller/purchase/purchase-invoice-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const purchaseInvoiceRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

purchaseInvoiceRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/payables", verifyToken, canRead, getPayables)
  .get("/:id", verifyToken, canRead, get)
  .put("/:id", verifyToken, canWrite, update)
  .patch("/:id/status", verifyToken, canWrite, updateStatus)
  .post("/:id/payments", verifyToken, canWrite, addPayment)
  .post("/:id/refunds", verifyToken, canWrite, addRefund)
  .delete("/:id", verifyToken, canWrite, deleteByID);

export default purchaseInvoiceRoute;
