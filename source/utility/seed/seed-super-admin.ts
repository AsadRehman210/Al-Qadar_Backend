// Standalone, idempotent script — run once to create the single Super Admin
// account. There is no API route to create one; this is the only way.
// Usage: yarn seed:super-admin  (reads SUPER_ADMIN_NAME/EMAIL/PASSWORD from .env)
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { AccountModel } from "../../model/account/account-model";
import { AccountRole, AccountStatus } from "../helper/constants/enum";
import { BCRYPT_SALT_ROUNDS } from "../helper/constants/security";

const run = async (): Promise<void> => {
  const dbAddress = process.env.DB_ADDRESS || "mongodb://localhost:27017/genaric_code_auth";
  await mongoose.connect(dbAddress);

  const existing = await AccountModel.findOne({ role: AccountRole.super_admin });
  if (existing) {
    console.log(`Super Admin already exists (${existing.email}). Nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  const name = process.env.SUPER_ADMIN_NAME;
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    console.error("SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in .env");
    await mongoose.disconnect();
    process.exitCode = 1;
    return;
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  await AccountModel.create({
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    role: AccountRole.super_admin,
    status: AccountStatus.active,
    code: "SA-0001",
    createdBy: null,
    adminId: null,
  });

  console.log(`Super Admin created: ${email}`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error("Failed to seed Super Admin:", err.message || err);
  await mongoose.disconnect();
  process.exitCode = 1;
});
