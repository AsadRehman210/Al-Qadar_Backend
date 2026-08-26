import { Router } from "express";
import { mark, markBulk, getAll, getSummary, getTodayStats, get, update, deleteByID } from "../../controller/attendance/attendance-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const attendanceRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

attendanceRoute
  .post("/", verifyToken, canWrite, mark)
  .post("/bulk", verifyToken, canWrite, markBulk)
  .get("/", verifyToken, canRead, getAll)
  .get("/today-stats", verifyToken, canRead, getTodayStats)
  .get("/summary/:employeeId", verifyToken, canRead, getSummary)
  .get("/:id", verifyToken, canRead, get)
  .put("/:id", verifyToken, canWrite, update)
  .delete("/:id", verifyToken, canWrite, deleteByID);

export default attendanceRoute;
