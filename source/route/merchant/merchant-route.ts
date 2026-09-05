import { Router } from "express";
import {
  create,
  update,
  linkAdmin,
  unlinkAdmin,
  activate,
  deactivate,
  unlock,
  unlockOpeningStock,
  addPayment,
  getPayments,
  getAllMerchants,
  getMerchantSummary,
  getMerchant,
} from "../../controller/merchant/merchant-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const merchantRoute = Router();

// A Super Admin may create a Merchant under any Admin (or directly, no
// parent Admin). An Admin may create a Merchant too, but the service layer
// forces it under themselves regardless of what's in the request body.
// A Merchant has no route to create anyone — there is none here to hit.
merchantRoute.post("/", verifyToken, requireRole(AccountRole.super_admin, AccountRole.admin), create);

// List/read — an Admin sees only its own merchants, a Super Admin sees all
// (or one Admin's via ?adminId=), enforced in the service layer.
merchantRoute.get("/", verifyToken, requireRole(AccountRole.super_admin, AccountRole.admin), getAllMerchants);
merchantRoute.get("/summary", verifyToken, requireRole(AccountRole.super_admin, AccountRole.admin), getMerchantSummary);
merchantRoute.get("/:id", verifyToken, requireRole(AccountRole.super_admin, AccountRole.admin), getMerchant);

// Same permission shape as create — a Super Admin may edit any Merchant, an
// Admin only ever its own (enforced in the service layer, not just here).
merchantRoute.put("/:id", verifyToken, requireRole(AccountRole.super_admin, AccountRole.admin), update);

// Link/unlink/activate/deactivate are Super Admin-only platform actions —
// an Admin does not get to re-parent or (de)activate a Merchant, even its own.
merchantRoute.patch("/:id/link-admin", verifyToken, requireRole(AccountRole.super_admin), linkAdmin);
merchantRoute.patch("/:id/unlink-admin", verifyToken, requireRole(AccountRole.super_admin), unlinkAdmin);
merchantRoute.patch("/:id/activate", verifyToken, requireRole(AccountRole.super_admin), activate);
merchantRoute.patch("/:id/deactivate", verifyToken, requireRole(AccountRole.super_admin), deactivate);

// Unlock has its own hierarchy, different from activate/deactivate: a Super
// Admin can always unlock; a Merchant's own parent Admin can too (enforced
// in the service layer), but an unrelated Admin cannot.
merchantRoute.patch("/:id/unlock", verifyToken, requireRole(AccountRole.super_admin, AccountRole.admin), unlock);
merchantRoute.patch(
  "/:id/unlock-opening-stock",
  verifyToken,
  requireRole(AccountRole.super_admin, AccountRole.admin),
  unlockOpeningStock
);

// Payment recording is Super Admin or the Merchant's own Admin — the service
// layer enforces an Admin can only pay for a Merchant that's actually theirs.
merchantRoute.post("/:id/payment", verifyToken, requireRole(AccountRole.super_admin, AccountRole.admin), addPayment);
merchantRoute.get(
  "/:id/payment",
  verifyToken,
  requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant),
  getPayments
);

export default merchantRoute;
