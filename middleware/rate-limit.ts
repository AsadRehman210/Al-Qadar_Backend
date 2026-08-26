import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { error } from '../source/utility/helper/common';
import { Messages } from '../source/utility/helper/constants/message';
import * as Enums from '../source/utility/helper/constants/enum';

// Same response envelope as every other endpoint (always HTTP 200, error
// distinguished by `success:false` in the body) — the frontend reads
// `response.message`/`response.success`, not the HTTP status, so a plain
// 429 here would be invisible to it.
const rateLimitHandler = (_req: Request, res: Response): Response =>
  res.json(error(Messages.MSG_TOO_MANY_REQUESTS, Enums.ErrorCode.rate_limited));

// The protective limits below are for a real deployment. Locally, hitting
// them mid-testing (repeatedly requesting/verifying an OTP while building
// the flow) is just friction, not a risk — there's no real attacker to
// throttle. So the ceiling itself is environment-aware: effectively
// unlimited outside production, tight once PRODUCTION=TRUE. This can't be
// forgotten at deploy time the way a manually-raised-then-forgotten limit
// could — it automatically re-tightens whenever PRODUCTION is set correctly.
const isProduction = process.env.PRODUCTION === "TRUE";

// Login already has its own per-account lockout (3 failed attempts -> 2h
// lock, see auth-service.ts), but that doesn't stop someone sweeping many
// different accounts from one IP. A generous per-IP ceiling catches that
// without getting in the way of normal use (e.g. a shared office IP with
// several people logging in).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 20 : 100000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// forgot-password had no throttle at all — repeatedly hitting it emails the
// same address over and over (inbox-bombing a target) and burns the app's
// SMTP sending quota for free. OTP request/verify/reset-password get the
// same tight limit since resetPassword's whole job is checking a guessed
// 6-digit code, and verify-otp exists specifically to be called repeatedly
// while the user is typing — production still bounds that, dev doesn't need to.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 5 : 100000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export { loginLimiter, otpLimiter };
