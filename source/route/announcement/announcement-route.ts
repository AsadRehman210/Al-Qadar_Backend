import { Router } from "express";
import { create, getAll, deleteByID } from "../../controller/announcement/announcement-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const announcementRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

announcementRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .delete("/:id", verifyToken, canWrite, deleteByID);

export default announcementRoute;
