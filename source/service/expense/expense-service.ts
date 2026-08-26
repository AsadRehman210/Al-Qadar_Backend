import mongoose from "mongoose";
import { ExpenseModel, IExpenseModel } from "../../model/expense/expense-model";
import { EmployeeModel } from "../../model/employee/employee-model";
import { expenseDto } from "../../utility/dtos/expense/expense-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/expense/expense-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { postAutoJournal } from "../finance/journal-service";
import { EXPENSE_TYPE_ACCOUNT_CODE, DEFAULT_EXPENSE_ACCOUNT_CODE } from "../../utility/helper/default-chart-of-accounts";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { getTenantCurrency } from "../account/account-service";

export interface ExpenseListOptions {
  search?: string;
  approvalStatus?: string;
  expenseType?: string;
  employeeId?: string;
  paymentStatus?: string;
}

interface CreateExpenseInput {
  employeeId: string;
  expenseType: string;
  expenseDate: string | Date;
  amount: number;
  paymentMethod?: string;
  description?: string;
  receiptUrl?: string;
  notes?: string;
  appliedVia: "employee" | "hr";
}

type ExpenseErrorCode =
  | "success"
  | "not_found"
  | "invalid_employee"
  | "invalid_status"
  | "invalid_amount"
  | "already_reimbursed";

interface ExpenseResult {
  errorCode: ExpenseErrorCode;
  result: expenseDto | null;
}

const inTenant = (scope: TenantScope) => ({
  adminId: scope.adminId,
  merchantId: scope.merchantId,
  isDeleted: { $ne: true },
});

const employeeExists = async (employeeId: string, scope: TenantScope): Promise<boolean> => {
  const employee = await EmployeeModel.findOne({ _id: employeeId, ...inTenant(scope) }).select("_id").lean();
  return Boolean(employee);
};

const generateExpenseNumber = async (scope: TenantScope): Promise<string> => {
  const count = await ExpenseModel.countDocuments({ adminId: scope.adminId, merchantId: scope.merchantId });
  return `EXP-${String(count + 1).padStart(4, "0")}`;
};

const findExpense = async (id: string, filter: Record<string, unknown>): Promise<IExpenseModel | null> => {
  return ExpenseModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } });
};

const tenantOfExpense = (expense: IExpenseModel): TenantScope => ({
  adminId: expense.adminId ? String(expense.adminId) : null,
  merchantId: expense.merchantId ? String(expense.merchantId) : null,
});

const apply = async (data: CreateExpenseInput, scope: TenantScope, createdBy: string): Promise<ExpenseResult> => {
  if (!(await employeeExists(data.employeeId, scope))) {
    return { errorCode: "invalid_employee", result: null };
  }
  if (!(data.amount > 0)) {
    return { errorCode: "invalid_amount", result: null };
  }

  const expenseNumber = await generateExpenseNumber(scope);
  const isSelfService = data.appliedVia === "employee";
  const approvalStatus = isSelfService ? "Pending Manager" : "Approved";
  const managerApproval = isSelfService ? { status: "Pending" as const } : { status: "Skipped" as const };

  const currency = await getTenantCurrency(scope);
  const expense = await ExpenseModel.create({
    expenseNumber,
    employeeId: data.employeeId,
    expenseType: data.expenseType,
    expenseDate: data.expenseDate,
    amount: data.amount,
    currency,
    paymentMethod: data.paymentMethod || "Bank",
    description: data.description || null,
    receiptUrl: data.receiptUrl || null,
    notes: data.notes || null,
    appliedVia: data.appliedVia,
    managerApproval,
    approvalStatus,
    paymentStatus: "Pending",
    approvalHistory: [
      {
        status: approvalStatus,
        date: new Date(),
        by: new mongoose.Types.ObjectId(createdBy),
        comments: isSelfService ? "Submitted, awaiting manager approval." : "Created by HR — auto-approved.",
      },
    ],
    paymentHistory: [],
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapDbToDto(expense) };
};

const managerApprove = async (
  id: string,
  filter: Record<string, unknown>,
  approverId: string,
  comments?: string
): Promise<ExpenseResult> => {
  const expense = await findExpense(id, filter);
  if (!expense) return { errorCode: "not_found", result: null };
  if (expense.approvalStatus !== "Pending Manager") return { errorCode: "invalid_status", result: null };

  expense.managerApproval = {
    status: "Approved",
    approvedBy: new mongoose.Types.ObjectId(approverId),
    approvedOn: new Date(),
    comments: comments || null,
  };
  expense.approvalStatus = "Pending HR";
  expense.approvalHistory = [
    ...(expense.approvalHistory || []),
    { status: "Pending HR", date: new Date(), by: new mongoose.Types.ObjectId(approverId), comments: comments || null },
  ];
  await expense.save();
  return { errorCode: "success", result: mapDbToDto(expense) };
};

const managerReject = async (
  id: string,
  filter: Record<string, unknown>,
  approverId: string,
  comments?: string
): Promise<ExpenseResult> => {
  const expense = await findExpense(id, filter);
  if (!expense) return { errorCode: "not_found", result: null };
  if (expense.approvalStatus !== "Pending Manager") return { errorCode: "invalid_status", result: null };

  expense.managerApproval = {
    status: "Rejected",
    approvedBy: new mongoose.Types.ObjectId(approverId),
    approvedOn: new Date(),
    comments: comments || null,
  };
  expense.approvalStatus = "Rejected";
  expense.approvalHistory = [
    ...(expense.approvalHistory || []),
    { status: "Rejected", date: new Date(), by: new mongoose.Types.ObjectId(approverId), comments: comments || null },
  ];
  await expense.save();
  return { errorCode: "success", result: mapDbToDto(expense) };
};

const hrApprove = async (
  id: string,
  filter: Record<string, unknown>,
  approverId: string,
  comments?: string
): Promise<ExpenseResult> => {
  const expense = await findExpense(id, filter);
  if (!expense) return { errorCode: "not_found", result: null };
  if (expense.approvalStatus !== "Pending HR") return { errorCode: "invalid_status", result: null };

  expense.approvalStatus = "Approved";
  expense.approvalHistory = [
    ...(expense.approvalHistory || []),
    { status: "Approved", date: new Date(), by: new mongoose.Types.ObjectId(approverId), comments: comments || null },
  ];
  await expense.save();
  return { errorCode: "success", result: mapDbToDto(expense) };
};

const hrReject = async (
  id: string,
  filter: Record<string, unknown>,
  approverId: string,
  comments?: string
): Promise<ExpenseResult> => {
  const expense = await findExpense(id, filter);
  if (!expense) return { errorCode: "not_found", result: null };
  if (expense.approvalStatus !== "Pending HR") return { errorCode: "invalid_status", result: null };

  expense.approvalStatus = "Rejected";
  expense.approvalHistory = [
    ...(expense.approvalHistory || []),
    { status: "Rejected", date: new Date(), by: new mongoose.Types.ObjectId(approverId), comments: comments || null },
  ];
  await expense.save();
  return { errorCode: "success", result: mapDbToDto(expense) };
};

const markReimbursed = async (
  id: string,
  filter: Record<string, unknown>,
  actorId: string
): Promise<ExpenseResult> => {
  const expense = await findExpense(id, filter);
  if (!expense) return { errorCode: "not_found", result: null };
  if (expense.approvalStatus !== "Approved") return { errorCode: "invalid_status", result: null };
  if (expense.paymentStatus === "Reimbursed") return { errorCode: "already_reimbursed", result: null };

  const amount = expense.amount || 0;

  expense.paymentStatus = "Reimbursed";
  expense.paymentHistory = [
    ...(expense.paymentHistory || []),
    { date: new Date(), amount, method: expense.paymentMethod || "Bank", status: "Reimbursed" },
  ];
  await expense.save();

  const debitAccountCode = EXPENSE_TYPE_ACCOUNT_CODE[expense.expenseType || ""] || DEFAULT_EXPENSE_ACCOUNT_CODE;

  await postAutoJournal({
    tenant: tenantOfExpense(expense),
    createdBy: actorId,
    date: new Date(),
    debitAccountCode,
    creditAccountCode: "1010",
    amount,
    ref: expense.expenseNumber || "",
    source: "Expense Reimbursement",
  });

  return { errorCode: "success", result: mapDbToDto(expense) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: ExpenseListOptions = {}
): Promise<{ totalCount: number; result: expenseDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    isDeleted: { $ne: true },
    ...buildSearchCondition(options.search, ["expenseNumber"]),
    ...buildExactFilters(options as Record<string, unknown>, {
      approvalStatus: "approvalStatus",
      expenseType: "expenseType",
      employeeId: "employeeId",
      paymentStatus: "paymentStatus",
    }),
  };

  const data = await ExpenseModel.find(query)
    .populate({
      path: "employeeId",
      select: "first_name last_name employeeCode departmentId",
      populate: { path: "departmentId", select: "name" },
    })
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await ExpenseModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<expenseDto | null> => {
  const data = await findExpense(id, filter);
  return data ? mapDbToDto(data) : null;
};

const getByEmployee = async (employeeId: string, filter: Record<string, unknown>): Promise<expenseDto[]> => {
  const data = await ExpenseModel.find({ employeeId, ...filter, isDeleted: { $ne: true } }).sort({ _id: -1 }).lean();
  return mapDbListToDtoList(data);
};

export {
  apply,
  managerApprove,
  managerReject,
  hrApprove,
  hrReject,
  markReimbursed,
  getAll,
  get,
  getByEmployee,
};
