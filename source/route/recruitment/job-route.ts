import { Router } from "express";
import { create, getAll, getSummary, get, update } from "../../controller/recruitment/job-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const jobRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

jobRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/summary", verifyToken, canRead, getSummary)
  .get("/:id", verifyToken, canRead, get)
  .put("/:id", verifyToken, canWrite, update);

export default jobRoute;
