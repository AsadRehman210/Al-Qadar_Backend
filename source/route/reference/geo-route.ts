import { Router } from "express";
import { getCountries, getCities } from "../../controller/reference/geo-controller";
import { getCurrencies } from "../../controller/reference/currency-controller";
import { verifyToken } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role";
import { AccountRole } from "../../utility/helper/constants/enum";

const geoRoute = Router();

const canRead = requireRole(AccountRole.super_admin, AccountRole.admin, AccountRole.merchant);

geoRoute
  .get("/countries", verifyToken, canRead, getCountries)
  .get("/countries/:isoCode/cities", verifyToken, canRead, getCities)
  .get("/currencies", verifyToken, canRead, getCurrencies);

export default geoRoute;
