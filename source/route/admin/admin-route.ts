import { Router } from "express";
import {
  create,
  getAllAdmins,
  getAdminSummary,
  getAdmin,
  updateAdmin,
  activate,
  deactivate,
  unlock,
  addPayment,
  getPayments,
} from "../../controller/admin/admin-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const adminRoute = Router();

// Every route here is Super Admin-only — an Admin has no visibility into,
// or control over, other Admin accounts.
adminRoute.post("/", verifyToken, requireRole(AccountRole.super_admin), create);
adminRoute.get("/", verifyToken, requireRole(AccountRole.super_admin), getAllAdmins);
adminRoute.get("/summary", verifyToken, requireRole(AccountRole.super_admin), getAdminSummary);
adminRoute.get("/:id", verifyToken, requireRole(AccountRole.super_admin), getAdmin);
adminRoute.put("/:id", verifyToken, requireRole(AccountRole.super_admin), updateAdmin);
adminRoute.patch("/:id/activate", verifyToken, requireRole(AccountRole.super_admin), activate);
adminRoute.patch("/:id/deactivate", verifyToken, requireRole(AccountRole.super_admin), deactivate);
adminRoute.patch("/:id/unlock", verifyToken, requireRole(AccountRole.super_admin), unlock);
adminRoute.post("/:id/payment", verifyToken, requireRole(AccountRole.super_admin), addPayment);
adminRoute.get("/:id/payment", verifyToken, requireRole(AccountRole.super_admin), getPayments);

export default adminRoute;
