import { Router } from "express";
import { getTrialBalance, getProfitAndLoss, getBalanceSheet, getVatSummary, getCashFlow } from "../../controller/finance/reports-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const reportsRoute = Router();

const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

reportsRoute
  .get("/trial-balance", verifyToken, canRead, getTrialBalance)
  .get("/profit-and-loss", verifyToken, canRead, getProfitAndLoss)
  .get("/balance-sheet", verifyToken, canRead, getBalanceSheet)
  .get("/vat-summary", verifyToken, canRead, getVatSummary)
  .get("/cash-flow", verifyToken, canRead, getCashFlow);

export default reportsRoute;
