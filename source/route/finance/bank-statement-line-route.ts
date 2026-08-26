import { Router } from "express";
import { create, getAll, match, unmatch } from "../../controller/finance/bank-statement-line-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const bankStatementLineRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

bankStatementLineRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .post("/:id/match", verifyToken, canWrite, match)
  .post("/:id/unmatch", verifyToken, canWrite, unmatch);

export default bankStatementLineRoute;
