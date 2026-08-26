import { Request, Response } from "express";
import {
  login as loginService,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithOtp,
} from "../../service/auth/auth-service";
import { success, error } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";

const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password, portal } = req.body;

    if (!email || !password) {
      return res.json(error(Messages.MSG_EMAIL_PASSWORD_REQUIRED, Enums.ErrorCode.failed));
    }

    const allowedPortals = Object.values(Enums.AccountRole);
    const requestedPortal = portal && allowedPortals.includes(portal) ? (portal as Enums.AccountRole) : undefined;

    const result = await loginService(email, password, requestedPortal);

    if (result.errorCode === Enums.ErrorCode.success) {
      return res.json(success(result.message, result.errorCode, result.result));
    }
    return res.json(error(result.message, result.errorCode));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const logout = async (_req: Request, res: Response): Promise<Response> => {
  try {
    return res.json(success(Messages.MSG_LOGOUT_SUCCESS, Enums.ErrorCode.success));
  } catch (err: any) {
    return res.json(error(Messages.MSG_LOGOUT_FAILED, Enums.ErrorCode.exception, err.message));
  }
};

const forgotPassword = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const result = await requestPasswordResetOtp(email);
    if (result.errorCode === Enums.ErrorCode.success) {
      return res.json(success(result.message, result.errorCode));
    }
    return res.json(error(result.message, result.errorCode));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const verifyOtp = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const result = await verifyPasswordResetOtp(email, otp);
    if (result.errorCode === Enums.ErrorCode.success) {
      return res.json(success(result.message, result.errorCode));
    }
    return res.json(error(result.message, result.errorCode));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const resetPassword = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) {
      return res.json(error(Messages.MSG_INVALID_DATA, Enums.ErrorCode.failed));
    }
    const result = await resetPasswordWithOtp(email, otp, password);
    if (result.errorCode === Enums.ErrorCode.success) {
      return res.json(success(result.message, result.errorCode));
    }
    return res.json(error(result.message, result.errorCode));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { login, logout, forgotPassword, verifyOtp, resetPassword };
