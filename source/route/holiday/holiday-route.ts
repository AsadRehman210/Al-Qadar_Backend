import { Router } from "express";
import { create, getAll, getSummary, get, update, deleteByID, getForDate } from "../../controller/holiday/holiday-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const holidayRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

holidayRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/summary", verifyToken, canRead, getSummary)
  .get("/check/:date", verifyToken, canRead, getForDate)
  .get("/:id", verifyToken, canRead, get)
  .put("/:id", verifyToken, canWrite, update)
  .delete("/:id", verifyToken, canWrite, deleteByID);

export default holidayRoute;
