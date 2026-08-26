import { Router } from "express";
import {
  create,
  toggleTask,
  getAll,
  getSummary,
  get,
  getByEmployee,
  getByCandidate,
} from "../../controller/onboarding/onboarding-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const onboardingRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

onboardingRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/summary", verifyToken, canRead, getSummary)
  .get("/employee/:employeeId", verifyToken, canRead, getByEmployee)
  .get("/candidate/:candidateId", verifyToken, canRead, getByCandidate)
  .get("/:id", verifyToken, canRead, get)
  .patch("/:id/task/:templateId", verifyToken, canWrite, toggleTask);

export default onboardingRoute;
