import { Router } from "express";
import { create, getAll, get, update } from "../../controller/finance/chart-of-account-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const chartOfAccountRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

chartOfAccountRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/:id", verifyToken, canRead, get)
  .put("/:id", verifyToken, canWrite, update);

export default chartOfAccountRoute;
