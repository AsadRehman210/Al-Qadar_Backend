import { Router } from "express";
import {
  create,
  getAll,
  get,
  getReceivables,
  update,
  updateDeliveryStatus,
  addPayment,
  addRefund,
  deleteByID,
} from "../../controller/sales/sale-invoice-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const saleInvoiceRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

saleInvoiceRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/receivables", verifyToken, canRead, getReceivables)
  .get("/:id", verifyToken, canRead, get)
  .put("/:id", verifyToken, canWrite, update)
  .patch("/:id/delivery-status", verifyToken, canWrite, updateDeliveryStatus)
  .post("/:id/payments", verifyToken, canWrite, addPayment)
  .post("/:id/refunds", verifyToken, canWrite, addRefund)
  .delete("/:id", verifyToken, canWrite, deleteByID);

export default saleInvoiceRoute;
