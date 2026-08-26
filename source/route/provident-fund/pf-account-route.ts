import { Router } from "express";
import { getAccountByEmployee, getAllAccounts, getAccountsSummary } from "../../controller/provident-fund/pf-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const pfAccountRoute = Router();

const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

pfAccountRoute.get("/", verifyToken, canRead, getAllAccounts);
pfAccountRoute.get("/summary", verifyToken, canRead, getAccountsSummary);
pfAccountRoute.get("/employee/:employeeId", verifyToken, canRead, getAccountByEmployee);

export default pfAccountRoute;
