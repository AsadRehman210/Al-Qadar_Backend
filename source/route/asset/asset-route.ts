import { Router } from "express";
import {
  create,
  getAll,
  get,
  update,
  assign,
  returnAsset,
  addMaintenance,
  updateMaintenance,
  updateInsurance,
  transferLocation,
  addDocument,
  removeDocument,
  dispose,
  getDistinctLocations,
  getSummary,
} from "../../controller/asset/asset-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const assetRoute = Router();

const canWrite = requireRole(AccountRole.admin, AccountRole.merchant);
const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

assetRoute
  .post("/", verifyToken, canWrite, create)
  .get("/", verifyToken, canRead, getAll)
  .get("/locations", verifyToken, canRead, getDistinctLocations)
  .get("/summary", verifyToken, canRead, getSummary)
  .get("/:id", verifyToken, canRead, get)
  .put("/:id", verifyToken, canWrite, update)
  .post("/:id/assign", verifyToken, canWrite, assign)
  .post("/:id/return", verifyToken, canWrite, returnAsset)
  .post("/:id/maintenance", verifyToken, canWrite, addMaintenance)
  .put("/:id/maintenance/:recordId", verifyToken, canWrite, updateMaintenance)
  .put("/:id/insurance", verifyToken, canWrite, updateInsurance)
  .post("/:id/transfer-location", verifyToken, canWrite, transferLocation)
  .post("/:id/documents", verifyToken, canWrite, addDocument)
  .delete("/:id/documents/:docId", verifyToken, canWrite, removeDocument)
  .post("/:id/dispose", verifyToken, canWrite, dispose);

export default assetRoute;
