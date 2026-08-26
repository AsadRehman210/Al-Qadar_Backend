import { Router } from "express";
import { create, getAll, get } from "../../controller/warehouse/stock-issue-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const stockIssueRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

stockIssueRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/:id", verifyToken, canRead, get);

export default stockIssueRoute;
