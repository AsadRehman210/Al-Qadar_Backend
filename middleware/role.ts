import { Request, Response, NextFunction } from "express";
import { error } from "../source/utility/helper/common";
import { Messages } from "../source/utility/helper/constants/message";
import * as Enums from "../source/utility/helper/constants/enum";

// Must run AFTER verifyToken, which populates req.user from the JWT payload.
const requireRole = (...allowedRoles: Enums.AccountRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = (req as any).user?.role;
    if (!role || !allowedRoles.includes(role)) {
      res.json(error(Messages.MSG_USER_IS_NOT_AUTHORIZED, Enums.ErrorCode.no_access));
      return;
    }
    next();
  };
};

export { requireRole };
