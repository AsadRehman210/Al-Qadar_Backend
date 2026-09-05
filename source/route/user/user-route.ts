import { Router } from "express";
import {
  create,
  getAll,
  get,
  update,
  activate,
  deactivate,
  deleteByID,
} from "../../controller/user/user-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { requirePermission } from "../../../middleware/permission";
import { AccountRole } from "../../utility/helper/constants/enum";
import { PERMISSIONS } from "../../utility/helper/constants/permissions";

const userRoute = Router();

const canManage = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

userRoute
  .post("/", verifyToken, canManage, requirePermission(PERMISSIONS.user.create), create)
  .get("/", verifyToken, canManage, requirePermission(PERMISSIONS.user.view), getAll)
  .get("/:id", verifyToken, canManage, requirePermission(PERMISSIONS.user.view), get)
  .put("/:id", verifyToken, canManage, requirePermission(PERMISSIONS.user.edit), update)
  .patch("/:id/activate", verifyToken, canManage, requirePermission(PERMISSIONS.user.edit), activate)
  .patch("/:id/deactivate", verifyToken, canManage, requirePermission(PERMISSIONS.user.edit), deactivate)
  .delete("/:id", verifyToken, canManage, requirePermission(PERMISSIONS.user.delete), deleteByID);

export default userRoute;
