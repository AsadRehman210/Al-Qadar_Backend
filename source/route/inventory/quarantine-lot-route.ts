import { Router } from "express";
import { getAll, get } from "../../controller/inventory/quarantine-lot-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const quarantineLotRoute = Router();

const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

quarantineLotRoute
  .get("/", verifyToken, canRead, getAll)
  .get("/:id", verifyToken, canRead, get);

export default quarantineLotRoute;
