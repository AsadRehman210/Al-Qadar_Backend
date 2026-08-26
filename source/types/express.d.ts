import { RequestUser } from "../utility/helper/tenant-scope";

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

export {};
