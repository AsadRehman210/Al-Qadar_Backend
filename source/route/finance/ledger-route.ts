import { Router } from "express";
import { getAll, getByAccount, getTrialBalance } from "../../controller/finance/ledger-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const ledgerRoute = Router();

const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

ledgerRoute
  .get("/", verifyToken, canRead, getAll)
  .get("/trial-balance", verifyToken, canRead, getTrialBalance)
  .get("/account/:accountId", verifyToken, canRead, getByAccount);

export default ledgerRoute;
