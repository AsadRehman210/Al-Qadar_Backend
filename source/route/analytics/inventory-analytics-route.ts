import { Router } from "express";
import { getOverview, getExpiryBuckets, getExpiryBucketDetail } from "../../controller/analytics/inventory-analytics-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const inventoryAnalyticsRoute = Router();

const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

inventoryAnalyticsRoute
  .get("/overview", verifyToken, canRead, getOverview)
  .get("/expiry", verifyToken, canRead, getExpiryBuckets)
  .get("/expiry/:bucket", verifyToken, canRead, getExpiryBucketDetail);

export default inventoryAnalyticsRoute;
