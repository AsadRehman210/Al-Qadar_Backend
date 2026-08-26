import { IEducation, ICertificate, ISkill, IEmployeeDocuments, IWeeklyScheduleDay, IWeeklyScheduleHistoryEntry, EmployeeStatus } from "../../../model/employee/employee-model";

export interface employeeDto {
  id: string;
  employeeCode?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  dob?: Date | null;
  address?: string | null;
  emergency_contact?: string | null;
  blood_group?: string | null;
  marital_status?: string | null;
  nationality?: string | null;
  national_id?: string | null;
  national_id_expiry?: Date | null;
  nationality_type?: string | null;
  work_permit_no?: string | null;
  work_permit_expiry?: Date | null;
  image?: string | null;

  departmentId?: string | null;
  departmentName?: string | null;
  designationId?: string | null;
  designationName?: string | null;
  weekly_schedule?: IWeeklyScheduleDay[];
  weeklyScheduleHistory?: IWeeklyScheduleHistoryEntry[];
  joining_date?: Date | null;
  managerEmployeeId?: string | null;
  work_location?: string | null;
  employment_type?: string | null;
  probation_end?: Date | null;
  status?: EmployeeStatus | null;
  resignation_date?: Date | null;
  retirement_date?: Date | null;
  termination_date?: Date | null;
  last_seen_date?: Date | null;

  education?: IEducation[];
  certificates?: ICertificate[];
  skills?: ISkill[];
  documents?: IEmployeeDocuments | null;

  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;

  // Display-only — the employee's latest Salary record's net_salary,
  // merged in by employee-service.getAll for the listing table. Not present
  // on single-employee reads (get/create/update).
  net_salary?: number | null;
}
