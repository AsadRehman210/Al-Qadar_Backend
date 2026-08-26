import { Router } from "express";
import { create, getAll, get, update, deleteByID } from "../../controller/leave/leave-type-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const leaveTypeRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

leaveTypeRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/:id", verifyToken, canRead, get)
  .put("/:id", verifyToken, canWrite, update)
  .delete("/:id", verifyToken, canWrite, deleteByID);

export default leaveTypeRoute;
