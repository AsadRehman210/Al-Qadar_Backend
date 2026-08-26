import { Router } from "express";
import { create, getAll, get, update, deleteByID, getInvoices, getPayments, getLedger, getBalance, getDebitCreditSummary } from "../../controller/purchase/supplier-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const supplierRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

supplierRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/:id", verifyToken, canRead, get)
  .get("/:id/invoices", verifyToken, canRead, getInvoices)
  .get("/:id/payments", verifyToken, canRead, getPayments)
  .get("/:id/ledger", verifyToken, canRead, getLedger)
  .get("/:id/balance", verifyToken, canRead, getBalance)
  .get("/:id/debit-credit-balance", verifyToken, canRead, getDebitCreditSummary)
  .put("/:id", verifyToken, canWrite, update)
  .delete("/:id", verifyToken, canWrite, deleteByID);

export default supplierRoute;
