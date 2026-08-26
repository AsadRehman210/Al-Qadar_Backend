/// <reference path="./source/types/express.d.ts" />
// A triple-slash reference, not a normal import: express.d.ts is a pure
// ambient `declare global` file with no runtime exports, so a real `import`
// compiles to a `require()` that fails at runtime (nothing to load — a
// .d.ts emits no .js). The reference comment is compile-time only (stripped
// from emitted JS entirely) and is what pulls the file into ts-node's
// program — ts-node resolves files lazily via the require graph starting
// from this entry point, unlike plain `tsc`, which scans the whole project
// by default and would have picked express.d.ts up regardless.
import express from "express";
import { Request, Response,NextFunction  } from "express";
const interceptor = require('express-interceptor');
require("dotenv").config();
const cors = require("cors");
const app = express();

// Default (qs) query parsing turns `?status[$ne]=Cancelled` into a nested
// object — `{ status: { $ne: 'Cancelled' } }` — which then flows straight
// into buildExactFilters/buildScopeFilter as a live Mongo operator, since
// neither validates that a filter value is a plain string. 'simple' (Node's
// built-in querystring) never produces nested objects/arrays from bracket
// syntax, closing that off at the source. No route in this app relies on
// bracket-style query params (checked all three frontends).
app.set('query parser', 'simple');

import * as config from "./source/config/database"
import router from "./source/route/index"
import jwt from 'jsonwebtoken';
import { JwtPayload, SignOptions } from 'jsonwebtoken';
import { error } from "./source/utility/helper/common";
import { Messages } from "./source/utility/helper/constants/message";
import * as Enums from "./source/utility/helper/constants/enum";
import { startAgenda, stopAgenda } from "./source/config/agenda";
import { HelperFunctions } from "./source/utility/helper/helper-function";
import { registerArchiveJob } from "./source/utility/helper/archive";

// Wide-open CORS is fine for local dev but not for a real deployment — make
// it configurable via env instead of unconditionally allowing every origin.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : true; // true = reflect request origin (cors package default), fine for dev
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
config;
app.get("/", (req: Request, res: Response) => {
  res.send("Hello, World from auth!");
});



const responseHandler = interceptor((req: Request, res: Response) => {

  return {
    isInterceptable: (body: any) => {
      return true;
    },
    
    intercept: (body: any, send:any) => {
      try {
        // Attempt to parse the response body as JSON
        const parsedBody = JSON.parse(body);
        let token =req.headers.authorization;
        if(token)
        {
          token = token.replace('Bearer ', '');
          const decoded: JwtPayload = jwt.verify(token, process.env.TOKEN_KEY || "") as JwtPayload;
          const TOKEN_KEY = process.env.TOKEN_KEY;
          const expiresIn = process.env.TOKEN_TIME;
          if (TOKEN_KEY && expiresIn) {
            // Re-sign with the FULL original payload (role, adminId, etc.),
            // not just user_id — the old version silently dropped every
            // custom claim on every single authenticated request after login.
            // iat/exp/nbf are stripped since jwt.sign() rejects them when
            // expiresIn is also passed.
            const { iat, exp, nbf, ...claims } = decoded;
            parsedBody.token = jwt.sign(claims, TOKEN_KEY, {
              expiresIn: expiresIn as SignOptions["expiresIn"],
            });
          }
        }

        res.send(parsedBody);
      } catch (err) {
        // If the response body cannot be parsed as JSON, or the token is
        // expired/invalid, send the original response untouched — the
        // route's own verifyToken middleware already ran (or will run on
        // the next request) and is the actual authority on rejecting it.
        send(body);
      }
    },
  };
});

app.use(responseHandler);

// Middleware to prevent caching
const noCacheMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
};

// Apply this middleware to your routes or globally
app.use(noCacheMiddleware);

app.use("/api", router);

// Unmatched route — respond with the same JSON envelope as everything else,
// not Express's default HTML 404 page.
app.use((req: Request, res: Response) => {
  res.status(404).json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
});

// Final safety net — catches anything thrown/rejected in a route that wasn't
// already caught locally, so a client never sees a raw stack trace.
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json(error(Messages.MSG_INTERNAL_SERVER_ERROR, Enums.ErrorCode.exception, err?.message));
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log("server up and running on PORT :", port);
});

// Register every background-job definition before starting the processor,
// so a job scheduled the instant Agenda comes up always has a handler.
HelperFunctions.registerEmailJobs();
registerArchiveJob();
startAgenda().catch((err) => console.error("[agenda] failed to start:", err));

// Let in-flight jobs finish (or at least stop cleanly) instead of the
// process just vanishing mid-job on a deploy/restart.
process.on("SIGTERM", () => stopAgenda().finally(() => process.exit(0)));
process.on("SIGINT", () => stopAgenda().finally(() => process.exit(0)));