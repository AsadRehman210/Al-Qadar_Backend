import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { error } from "../source/utility/helper/common";
import { Messages } from "../source/utility/helper/constants/message";
import * as Enums from "../source/utility/helper/constants/enum";
import { RequestUser } from "../source/utility/helper/tenant-scope";
import { permissionForRoute } from "../source/utility/helper/constants/permissions";
import { userModel } from "../source/model/user/user-model";

const config = process.env as any;

// Route-level guard (composed into a route chain after requireRole). An
// Account owner (`isSubUser` falsy) always passes — they are the "default
// user" with every permission. A sub-user passes only if their Role grants at
// least one listed key.
const requirePermission = (...keys: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as RequestUser | undefined;
    if (!user?.isSubUser) {
      next();
      return;
    }
    const held = user.permissions || [];
    if (keys.some((k) => held.includes(k))) {
      next();
      return;
    }
    res.json(error(Messages.MSG_USER_IS_NOT_AUTHORIZED, Enums.ErrorCode.no_access));
  };
};

// Blanket enforcement mounted once on the `/api` router (source/route/index.ts),
// so every business module is covered without touching 60+ route files. Runs
// BEFORE each route's own verifyToken: an absent/invalid token is left for
// verifyToken to reject with the canonical 401; a valid OWNER token passes
// straight through; a valid SUB-USER token is checked against
// MODULE_PERMISSION_MAP for `${method} ${path}` using the Role's current
// permissions (loaded fresh here, so revocation is immediate).
const enforceModulePermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const header = req.headers.authorization;
    if (!header) {
      next();
      return;
    }
    const token = header.split(" ")[1];
    let decoded: any;
    try {
      decoded = jwt.verify(token, config.TOKEN_KEY);
    } catch {
      next();
      return;
    }

    if (!decoded?.isSubUser || !decoded?.sub) {
      next();
      return;
    }

    // Path relative to the /api mount, without querystring.
    const path = (req.originalUrl.split("?")[0] || "").replace(/^\/api/, "") || "/";
    const required = permissionForRoute(req.method, path);
    if (!required) {
      next();
      return;
    }

    const subUser = await userModel
      .findOne({ _id: decoded.sub, action_type: { $ne: Enums.ActivityFlag.delete } })
      .populate({ path: "roleId", select: "permissions status" })
      .lean();
    const role = (subUser as any)?.roleId;
    const held: string[] = Array.isArray(role?.permissions) ? role.permissions : [];

    if (held.includes(required)) {
      next();
      return;
    }
    res.json(error(Messages.MSG_USER_IS_NOT_AUTHORIZED, Enums.ErrorCode.no_access));
  } catch (err: any) {
    // Never hard-fail the request here — verifyToken remains the authority.
    next();
  }
};

export { requirePermission, enforceModulePermissions };
