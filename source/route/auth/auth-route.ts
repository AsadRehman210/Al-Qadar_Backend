import { Router } from "express";
import { login, logout, forgotPassword, verifyOtp, resetPassword } from "../../controller/auth/auth-controller";
import { verifyToken } from "../../../middleware/auth";
import { loginLimiter, otpLimiter } from "../../../middleware/rate-limit";

const authRoute = Router();

authRoute
  .post("/login", loginLimiter, login)
  .post("/logout", verifyToken, logout)
  .post("/forgot-password", otpLimiter, forgotPassword)
  .post("/verify-otp", otpLimiter, verifyOtp)
  .post("/reset-password", otpLimiter, resetPassword);

export default authRoute;
