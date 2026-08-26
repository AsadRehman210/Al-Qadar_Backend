import { Router } from "express";
import { apply, getAll, getByJob, updateStage, hire } from "../../controller/recruitment/candidate-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const candidateRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

candidateRoute
  .post("/", verifyToken, canWrite, apply)
  .get("/", verifyToken, canRead, getAll)
  .get("/job/:jobId", verifyToken, canRead, getByJob)
  .patch("/:id/stage", verifyToken, canWrite, updateStage)
  .patch("/:id/hire", verifyToken, canWrite, hire);

export default candidateRoute;
