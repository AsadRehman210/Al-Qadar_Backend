import { Router } from "express";
import {
  create,
  getAll,
  get,
  update,
  updateStatus,
  markConverted,
  deleteByID,
} from "../../controller/sales/quotation-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const quotationRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

quotationRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/:id", verifyToken, canRead, get)
  .put("/:id", verifyToken, canWrite, update)
  .patch("/:id/status", verifyToken, canWrite, updateStatus)
  .patch("/:id/mark-converted", verifyToken, canWrite, markConverted)
  .delete("/:id", verifyToken, canWrite, deleteByID);

export default quotationRoute;
