import { Router } from "express";
import { create, getAll, get, getReturnableLines, updateStatus } from "../../controller/purchase/debit-note-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const debitNoteRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

debitNoteRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/returnable/:invoiceId", verifyToken, canRead, getReturnableLines)
  .get("/:id", verifyToken, canRead, get)
  .patch("/:id/status", verifyToken, canWrite, updateStatus);

export default debitNoteRoute;
