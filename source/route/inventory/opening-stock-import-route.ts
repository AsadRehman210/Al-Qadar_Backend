import { Router } from "express";
import { getStatus, importRows } from "../../controller/inventory/opening-stock-import-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const openingStockImportRoute = Router();

const canAccess = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

openingStockImportRoute
  .get("/status", verifyToken, canAccess, getStatus)
  .post("/", verifyToken, canAccess, importRows);

export default openingStockImportRoute;
