import bcrypt from "bcrypt";
import { AccountModel } from "../../model/account/account-model";
import { OtpModel } from "../../model/otp/otp-model";
import { accountDto } from "../../utility/dtos/account/account-dto";
import { mapDbToDto } from "../../utility/mapper/account/account-mapper";
import { HelperFunctions } from "../../utility/helper/helper-function";
import * as Enums from "../../utility/helper/constants/enum";
import { Messages } from "../../utility/helper/constants/message";
import { syncExpiredStatus } from "../../utility/helper/payment-expiry";
import { getTenantThemeColor } from "../account/account-service";
import { agenda } from "../../config/agenda";
import { BCRYPT_SALT_ROUNDS } from "../../utility/helper/constants/security";

const MAX_FAILED_ATTEMPTS = 3;
const LOCK_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours, matching MSG_TEMP_ACCOUNT_BLOCKED wording
const OTP_TTL_MS = 60 * 1000; // 1 minute, per the requested forgot-password flow

interface LoginResult {
  errorCode: Enums.ErrorCode;
  message: string;
  result: { account: accountDto; token: string } | null;
}

const login = async (
  email: string,
  password: string,
  portal?: Enums.AccountRole
): Promise<LoginResult> => {
  const account = await AccountModel.findOne({ email: email.toLowerCase() });

  if (!account) {
    return { errorCode: Enums.ErrorCode.invalid_credentials, message: Messages.MSG_INVALID_CRED, result: null };
  }

  if (account.lock_until && account.lock_until.getTime() > Date.now()) {
    return { errorCode: Enums.ErrorCode.locked_account, message: Messages.MSG_TEMP_ACCOUNT_BLOCKED, result: null };
  }

  // A Merchant whose payment period has lapsed is rejected here too, not
  // just eventually noticed elsewhere — persists the flip to inactive so
  // it's visible to whoever manages them without a separate check.
  await syncExpiredStatus(account);

  if (account.status !== Enums.AccountStatus.active) {
    return { errorCode: Enums.ErrorCode.de_active, message: Messages.MSG_USER_DEACTIVATED, result: null };
  }

  if (portal && account.role !== portal) {
    return { errorCode: Enums.ErrorCode.unauthorized, message: Messages.MSG_PORTAL_MISMATCH, result: null };
  }

  const passwordMatches = await bcrypt.compare(password, account.password || "");
  if (!passwordMatches) {
    const attempts = (account.failed_attempts || 0) + 1;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      account.failed_attempts = 0;
      account.lock_until = new Date(Date.now() + LOCK_DURATION_MS);
    } else {
      account.failed_attempts = attempts;
    }
    await account.save();
    return { errorCode: Enums.ErrorCode.invalid_credentials, message: Messages.MSG_INVALID_CRED, result: null };
  }

  account.failed_attempts = 0;
  account.lock_until = null;
  account.last_login = new Date();
  await account.save();

  const token = HelperFunctions.generateToken({
    id: account._id,
    role: account.role,
    adminId: account.adminId || null,
  });

  // The DTO's own themeColor is only ever the account's raw, directly-set
  // value (null for almost every Merchant) — resolved here so the frontend
  // always receives a concrete color to paint with, already inherited from
  // the parent Admin (or defaulted) rather than re-deriving that itself.
  const accountDtoResult = mapDbToDto(account);
  accountDtoResult.themeColor = await getTenantThemeColor({
    adminId: account.adminId ? String(account.adminId) : account.role === Enums.AccountRole.admin ? String(account._id) : null,
    merchantId: account.role === Enums.AccountRole.merchant ? String(account._id) : null,
  });

  return {
    errorCode: Enums.ErrorCode.success,
    message: Messages.MSG_LOGIN_SUCCESS,
    result: { account: accountDtoResult, token },
  };
};

interface SimpleResult {
  errorCode: Enums.ErrorCode;
  message: string;
}

// Always responds success (even for an unknown email) so the endpoint can't
// be used to enumerate registered emails — the OTP is simply never sent for
// one that doesn't exist. A locked account is rejected here too, not just
// at the final reset step, so a locked user gets no OTP at all.
const requestPasswordResetOtp = async (email: string): Promise<SimpleResult> => {
  const account = await AccountModel.findOne({ email: email.toLowerCase() }).lean();
  if (!account) {
    return { errorCode: Enums.ErrorCode.success, message: Messages.MSG_OTP_SENT };
  }

  if (account.lock_until && account.lock_until.getTime() > Date.now()) {
    return { errorCode: Enums.ErrorCode.locked_account, message: Messages.MSG_ACCOUNT_LOCKED_CANNOT_RESET };
  }

  const code = HelperFunctions.generateCode();
  await OtpModel.create({
    email: account.email,
    code,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  // Outside production, SMTP is typically unconfigured (see
  // helper-function.ts's sendOtpEmail failing with "Missing credentials" in
  // local dev) — log the real, randomly-generated code so the flow stays
  // testable without email. This is NOT a fallback code; it's the same
  // random value stored above and required by resetPasswordWithOtp below.
  if (process.env.PRODUCTION !== "TRUE") {
    console.log(`[dev] password reset OTP for ${account.email}: ${code}`);
  }

  // Fire-and-forget via Agenda instead of awaiting the SMTP round-trip
  // directly — the request responds as soon as the OTP is stored, not
  // whenever Gmail's SMTP finishes. If scheduling itself fails (rare —
  // Agenda not yet connected), log it but still tell the caller the OTP
  // flow succeeded, matching sendOtpEmail's own existing swallow-errors
  // behavior (a delivery failure was never surfaced to the caller before).
  try {
    await agenda.now('send-otp-email', { email: account.email, code });
  } catch (err) {
    console.error('[agenda] failed to schedule send-otp-email:', err);
  }

  return { errorCode: Enums.ErrorCode.success, message: Messages.MSG_OTP_SENT };
};

// Read-only check the frontend calls right after the user types the 6-digit
// code, so a wrong/expired OTP surfaces immediately (its own step) instead
// of only at the very end after they've also filled in a new password.
// Deliberately does NOT mark the OTP used or touch failed_attempts — that
// stays resetPasswordWithOtp's job, so this can be called freely (rate
// limiting on the route is what keeps it from being a guessing oracle).
const verifyPasswordResetOtp = async (email: string, otp: string): Promise<SimpleResult> => {
  const account = await AccountModel.findOne({ email: email.toLowerCase() }).select("_id email").lean();
  if (!account) {
    return { errorCode: Enums.ErrorCode.invalid_credentials, message: Messages.MSG_OTP_INVALID_OR_EXPIRED };
  }

  const otpRecord = await OtpModel.findOne({
    email: account.email,
    code: otp,
    used: false,
    expiresAt: { $gt: new Date() },
  }).select("_id").lean();

  if (!otpRecord) {
    return { errorCode: Enums.ErrorCode.invalid_credentials, message: Messages.MSG_OTP_INVALID_OR_EXPIRED };
  }

  return { errorCode: Enums.ErrorCode.success, message: Messages.MSG_CODE_MATCHED_SUCCESSFULLY };
};

const resetPasswordWithOtp = async (
  email: string,
  otp: string,
  newPassword: string
): Promise<SimpleResult> => {
  const account = await AccountModel.findOne({ email: email.toLowerCase() });
  if (!account) {
    return { errorCode: Enums.ErrorCode.invalid_credentials, message: Messages.MSG_OTP_INVALID_OR_EXPIRED };
  }

  // Re-checked here, not just at request time — an account can lock (3 more
  // failed logins) in the window between requesting the OTP and using it.
  if (account.lock_until && account.lock_until.getTime() > Date.now()) {
    return { errorCode: Enums.ErrorCode.locked_account, message: Messages.MSG_ACCOUNT_LOCKED_CANNOT_RESET };
  }

  const otpRecord = await OtpModel.findOne({
    email: account.email,
    code: otp,
    used: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    return { errorCode: Enums.ErrorCode.invalid_credentials, message: Messages.MSG_OTP_INVALID_OR_EXPIRED };
  }

  otpRecord.used = true;
  await otpRecord.save();

  account.password = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
  account.failed_attempts = 0;
  await account.save();

  return { errorCode: Enums.ErrorCode.success, message: Messages.MSG_PASSWORD_RESET_SUCCESS };
};

export { login, requestPasswordResetOtp, verifyPasswordResetOtp, resetPasswordWithOtp };
