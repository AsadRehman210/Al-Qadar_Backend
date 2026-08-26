import { Router } from "express";
import { create, getAll, get, update, deleteByID } from "../../controller/designation/designation-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const designationRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

designationRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/:id", verifyToken, canRead, get)
  .put("/:id", verifyToken, canWrite, update)
  .delete("/:id", verifyToken, canWrite, deleteByID);

export default designationRoute;
