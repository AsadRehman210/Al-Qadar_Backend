import { Router } from "express";
import { create, getAll, getActive, get, update, deleteByID } from "../../controller/role/role-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { requirePermission } from "../../../middleware/permission";
import { AccountRole } from "../../utility/helper/constants/enum";
import { PERMISSIONS } from "../../utility/helper/constants/permissions";

const roleRoute = Router();

const canManage = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

roleRoute
  .post("/", verifyToken, canManage, requirePermission(PERMISSIONS.role.create), create)
  .get("/", verifyToken, canManage, requirePermission(PERMISSIONS.role.view), getAll)
  .get("/active", verifyToken, canManage, requirePermission(PERMISSIONS.role.view, PERMISSIONS.user.create, PERMISSIONS.user.edit), getActive)
  .get("/:id", verifyToken, canManage, requirePermission(PERMISSIONS.role.view), get)
  .put("/:id", verifyToken, canManage, requirePermission(PERMISSIONS.role.edit), update)
  .delete("/:id", verifyToken, canManage, requirePermission(PERMISSIONS.role.delete), deleteByID);

export default roleRoute;
