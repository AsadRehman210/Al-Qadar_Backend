import { Router } from "express";
import { getOverview, getAttendanceTrend, getUnmarkedToday } from "../../controller/analytics/hr-analytics-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const hrAnalyticsRoute = Router();

const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

hrAnalyticsRoute
  .get("/overview", verifyToken, canRead, getOverview)
  .get("/attendance-trend", verifyToken, canRead, getAttendanceTrend)
  .get("/unmarked-today", verifyToken, canRead, getUnmarkedToday);

export default hrAnalyticsRoute;
