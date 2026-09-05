import { Router } from "express";
import { create, getAll, get, update, complete, reverse, deleteByID } from "../../controller/inventory/production-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const productionRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

productionRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/:id", verifyToken, canRead, get)
  .put("/:id", verifyToken, canWrite, update)
  .post("/:id/complete", verifyToken, canWrite, complete)
  .post("/:id/reverse", verifyToken, canWrite, reverse)
  .delete("/:id", verifyToken, canWrite, deleteByID);

export default productionRoute;
