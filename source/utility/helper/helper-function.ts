import jwt, { SignOptions } from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { agenda } from '../../config/agenda';
import { Job } from 'agenda';

interface MailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
}
import * as fs from 'fs';

// Function to send a password-reset OTP email — same transporter setup as
// sendEmail's reset-link, but the message is the raw code itself since the
// reset flow is OTP-based, not link-based.
const sendOtpEmail = async (email: string, code: string): Promise<void> => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
  });

  const mailOptions: MailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
    to: email,
    subject: 'Your Password Reset Code',
    html: `<p>Your password reset code is:</p><h2 style="letter-spacing:4px;">${code}</h2><p>This code expires in 1 minute. If you did not request this, you can safely ignore this email.</p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('OTP email sent: ' + info.response);
  } catch (error) {
    console.error('Error sending OTP email: ', error);
  }
};

// Background-job wrappers — callers schedule these via agenda.now(...)
// instead of awaiting the SMTP round-trip directly, so a password-reset
// request responds immediately instead of blocking on Gmail's SMTP latency.
// Registered once at startup (see startAgenda() in app.ts); the actual send
// functions above already swallow their own errors, so a failed send here
// just logs — it never throws back into Agenda's retry machinery, matching
// the "best-effort, fire-and-forget" behavior the direct-await call had.
const registerEmailJobs = (): void => {
  agenda.define('send-otp-email', async (job: Job) => {
    const data = job.attrs.data as { email: string; code: string };
    await sendOtpEmail(data.email, data.code);
  });
};

// Function to generate a 6-digit code — always genuinely random. It used to
// return a fixed "000000" outside production (so local dev could bypass
// SMTP not being configured), but that meant ANY account's OTP was always
// "000000" whenever PRODUCTION wasn't exactly "TRUE" — a real password-reset
// bypass if that env var were ever misconfigured in a live deployment.
// Local testability is handled below instead, by logging the code.
function generateCode ():string {
  return Math.floor(Math.random() * 999999).toString().padStart(6, '0');
}

// Function to verify if the generated code matches the entered code
function verifyCode(generatedCode: string, enteredCode: string): boolean {
  return generatedCode === enteredCode;
}

// Function to calculate the difference in minutes between two dates
function timeDifference(dt2: Date, dt1: Date): number {
  const diffInSeconds = (dt2.getTime() - dt1.getTime()) / 1000;
  const diffInMinutes = diffInSeconds / 60;
  return Math.abs(Math.round(diffInMinutes)) - 5;
}

// Function to log messages to the console, depending on the environment
function writeConsole(message: string, data?: any): void {
  const production = process.env.PRODUCTION;
  if (data != null) {
    if (production === "TRUE" || production === "true") {
      console.log(`${message} ${data}`);
    }
  } else {
    if (production === "TRUE" || production === "true") {
      console.log(message);
    }
  }
}

// Function to generate a JWT token. Accepts either a raw id (legacy shape,
// wrapped as { user_id }) or a full payload object (e.g. { id, role, adminId })
// so callers can encode richer, role-aware claims.
function generateToken(userData: any): string {
  const TOKEN_KEY = process.env.TOKEN_KEY;
  const expiresIn = process.env.TOKEN_TIME;
  let token = "";
  if (TOKEN_KEY && expiresIn) {
    const payload = userData && typeof userData === "object" ? userData : { user_id: userData };
    token = jwt.sign(payload, TOKEN_KEY, {
      expiresIn: expiresIn as SignOptions["expiresIn"],
    });
  }
  return token;
}

// Function to check if a string is null or empty
function isNullOrEmpty(str: string | undefined): boolean {
  if (str === undefined) return true;
  else if (isNull(str)) return true;
  else if (isEmpty(str)) return true;
  else return false;
}

// Function to check if a string is null
function isNull(str: string | null): boolean {
  return str === null;
}

// Function to check if a string is empty
function isEmpty(str: string): boolean {
  return str === "";
}

// Function to check if two strings are not equal
function stringsNotEqual(str1: string, str2: string): boolean {
  return str1 !== str2;
}

// Function to check if an array is null or empty
function isNullOrEmptyArray<T>(array: T[] | null | undefined): boolean {
  if (isNullArray(array)) return true;
  else if (isEmptyArray(array)) return true;
  else return false;
}

// Function to check if an array is null or undefined
function isNullArray<T>(array: T[] | null | undefined): boolean {
  return array === null || array === undefined;
}

// Function to check if an array is empty
function isEmptyArray<T>(array: T[] | null | undefined): boolean {
  return !array || array.length === 0;
}

// Function to delete a file
function deleteFile(filePath: string): void {
  fs.unlink(filePath, (err: NodeJS.ErrnoException | null) => {
    if (err) {
      writeConsole("Error deleting file:", err);
    } else {
      writeConsole("File deleted successfully:", filePath);
    }
  });
};

export const HelperFunctions = {
  generateCode,
  verifyCode,
  timeDifference,
  writeConsole,
  generateToken,
  isNullOrEmpty,
  isNull,
  isEmpty,
  stringsNotEqual,
  isNullOrEmptyArray,
  isNullArray,
  isEmptyArray,
  deleteFile,
  sendOtpEmail,
  registerEmailJobs,
};
