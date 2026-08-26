import moment from "moment";
import { SalaryModel, ISalaryAllowances, ISalaryDeductions } from "../../model/salary/salary-model";
import { EmployeeModel } from "../../model/employee/employee-model";
import { salaryDto } from "../../utility/dtos/salary/salary-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/salary/salary-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";

interface CreateSalaryInput {
  employeeId: string;
  basic_salary: number;
  allowances?: ISalaryAllowances;
  deductions?: ISalaryDeductions;
  tax_percentage?: number;
  pf_percentage?: number;
  bank_name?: string;
  branch_name?: string;
  branch_code?: string;
  account_no?: string;
  ifsc?: string;
  pf_number?: string;
  payment_status?: string;
  payment_date?: string;
  effective_from: string;
  effective_to?: string | null;
  salary_notes?: string;
}

type SalaryErrorCode = "success" | "not_found" | "invalid_employee" | "invalid_amount" | "invalid_effective_date";

interface SalaryResult {
  errorCode: SalaryErrorCode;
  result: salaryDto | null;
}

const sumOf = (values?: ISalaryAllowances | ISalaryDeductions | null): number => {
  if (!values) return 0;
  return Object.values(values).reduce((sum: number, v) => sum + (Number(v) || 0), 0);
};

const computeTotals = (basic_salary: number, allowances?: ISalaryAllowances, deductions?: ISalaryDeductions) => {
  const gross_salary = Number(basic_salary || 0) + sumOf(allowances);
  const net_salary = gross_salary - sumOf(deductions);
  return { gross_salary, net_salary };
};

const employeeExists = async (employeeId: string, scope: TenantScope): Promise<boolean> => {
  const employee = await EmployeeModel.findOne({
    _id: employeeId,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    isDeleted: { $ne: true },
  }).select("_id").lean();
  return Boolean(employee);
};

const create = async (
  data: CreateSalaryInput,
  scope: TenantScope,
  createdBy: string
): Promise<SalaryResult> => {
  if (!(await employeeExists(data.employeeId, scope))) {
    return { errorCode: "invalid_employee", result: null };
  }
  if (!(data.basic_salary > 0)) {
    return { errorCode: "invalid_amount", result: null };
  }

  const { gross_salary, net_salary } = computeTotals(data.basic_salary, data.allowances, data.deductions);

  // Auto-close the employee's current record so there's only ever one row
  // with effective_to: null per employee — the client never has to remember
  // to do this itself. The new record's effective_from must be strictly
  // after the current one's own start, or `dayBefore` lands before it,
  // producing an inverted effective_to < effective_from window on the row
  // being closed (a backdated-correction / fat-finger case previously let
  // through unvalidated).
  const current = await SalaryModel.findOne({
    employeeId: data.employeeId,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    effective_to: null,
  });
  if (current) {
    if (!moment(data.effective_from).isAfter(moment(current.effective_from), "day")) {
      return { errorCode: "invalid_effective_date", result: null };
    }
    const dayBefore = moment(data.effective_from).subtract(1, "day").toDate();
    current.effective_to = dayBefore;
    await current.save();
  }

  const salary = await SalaryModel.create({
    ...data,
    gross_salary,
    net_salary,
    effective_to: null,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapDbToDto(salary) };
};

const getCurrent = async (employeeId: string, filter: Record<string, unknown>): Promise<salaryDto | null> => {
  const data = await SalaryModel.findOne({ employeeId, ...filter, effective_to: null }).lean();
  return data ? mapDbToDto(data) : null;
};

const getHistory = async (employeeId: string, filter: Record<string, unknown>): Promise<salaryDto[]> => {
  const data = await SalaryModel.find({ employeeId, ...filter }).sort({ effective_from: -1 }).lean();
  return mapDbListToDtoList(data);
};

const update = async (
  id: string,
  data: Partial<CreateSalaryInput>,
  filter: Record<string, unknown>
): Promise<SalaryResult> => {
  const existing = await SalaryModel.findOne({ _id: id, ...filter }).select("basic_salary allowances deductions").lean();
  if (!existing) {
    return { errorCode: "not_found", result: null };
  }

  const basic_salary = data.basic_salary ?? existing.basic_salary ?? 0;
  const allowances = data.allowances ?? existing.allowances ?? undefined;
  const deductions = data.deductions ?? existing.deductions ?? undefined;
  const { gross_salary, net_salary } = computeTotals(basic_salary, allowances, deductions);

  const updated = await SalaryModel.findOneAndUpdate(
    { _id: id, ...filter },
    { $set: { ...data, gross_salary, net_salary } },
    { new: true }
  ).lean();

  if (!updated) {
    return { errorCode: "not_found", result: null };
  }
  return { errorCode: "success", result: mapDbToDto(updated) };
};

export { create, getCurrent, getHistory, update };
