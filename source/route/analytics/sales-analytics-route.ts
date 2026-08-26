import { Router } from "express";
import { getOverview, getProfitTrend, getTopProducts, getTopProductsPaginated } from "../../controller/analytics/sales-analytics-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const salesAnalyticsRoute = Router();

const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

salesAnalyticsRoute
  .get("/overview", verifyToken, canRead, getOverview)
  .get("/profit-trend", verifyToken, canRead, getProfitTrend)
  .get("/top-products", verifyToken, canRead, getTopProducts)
  .get("/top-products-paginated", verifyToken, canRead, getTopProductsPaginated);

export default salesAnalyticsRoute;
