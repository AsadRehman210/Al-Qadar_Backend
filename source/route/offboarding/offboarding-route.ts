import { Router } from "express";
import {
  initiateExit,
  updateClearanceItem,
  saveExitInterview,
  computeSettlement,
  markSettlementProcessed,
  cancelExit,
  getActiveForEmployee,
  getAll,
  getSummary,
  get,
  getByEmployee,
} from "../../controller/offboarding/offboarding-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const offboardingRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

offboardingRoute
  .post("/", verifyToken, canWrite, initiateExit)
  .get("/", verifyToken, canRead, getAll)
  .get("/summary", verifyToken, canRead, getSummary)
  .get("/employee/:employeeId", verifyToken, canRead, getByEmployee)
  .get("/employee/:employeeId/active", verifyToken, canRead, getActiveForEmployee)
  .get("/:id", verifyToken, canRead, get)
  .get("/:id/settlement", verifyToken, canRead, computeSettlement)
  .patch("/:id/clearance/:section", verifyToken, canWrite, updateClearanceItem)
  .patch("/:id/exit-interview", verifyToken, canWrite, saveExitInterview)
  .patch("/:id/process-settlement", verifyToken, canWrite, markSettlementProcessed)
  .patch("/:id/cancel", verifyToken, canWrite, cancelExit);

export default offboardingRoute;
