import { Router } from "express";
import { postContribution, getContributionHistory } from "../../controller/provident-fund/pf-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const pfContributionRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

pfContributionRoute
  .post("/", verifyToken, canWrite, postContribution)
  .get("/employee/:employeeId", verifyToken, canRead, getContributionHistory);

export default pfContributionRoute;
