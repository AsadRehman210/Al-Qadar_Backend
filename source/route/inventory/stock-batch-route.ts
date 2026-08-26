import { Router } from "express";
import { getAll } from "../../controller/inventory/stock-batch-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const stockBatchRoute = Router();

const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

stockBatchRoute.get("/", verifyToken, canRead, getAll);

export default stockBatchRoute;
