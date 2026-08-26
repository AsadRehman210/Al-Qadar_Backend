import { Router } from "express";
import { getAll, adjust, adjustmentHistory, summary } from "../../controller/warehouse/stock-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const stockRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

stockRoute
  .get("/", verifyToken, canRead, getAll)
  .get("/summary", verifyToken, canRead, summary)
  .get("/adjustment-history", verifyToken, canRead, adjustmentHistory)
  .post("/adjust", verifyToken, canWrite, adjust);

export default stockRoute;
