import { Router } from "express";
import { upsert, getAll, deleteByID, getBudgetVsActual } from "../../controller/finance/budget-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const budgetRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

budgetRoute
  .post("/", verifyToken, canWrite, upsert)
  .get("/vs-actual", verifyToken, canRead, getBudgetVsActual)
  .get("/", verifyToken, canRead, getAll)
  .delete("/:id", verifyToken, canWrite, deleteByID);

export default budgetRoute;
