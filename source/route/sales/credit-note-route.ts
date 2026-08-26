import { Router } from "express";
import { create, getAll, get, getReturnableLines, updateStatus } from "../../controller/sales/credit-note-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const creditNoteRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

creditNoteRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/returnable/:invoiceId", verifyToken, canRead, getReturnableLines)
  .get("/:id", verifyToken, canRead, get)
  .patch("/:id/status", verifyToken, canWrite, updateStatus);

export default creditNoteRoute;
