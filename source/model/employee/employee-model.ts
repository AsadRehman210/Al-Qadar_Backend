import mongoose, { Document, Schema, Model, model } from "mongoose";

export interface IEducation {
  degree_name?: string | null;
  field_major?: string | null;
  institute_university?: string | null;
  board_university?: string | null;
  country_city?: string | null;
  end_date?: Date | null;
  percentage_cgpa?: string | null;
}

export interface ICertificate {
  certificate_name?: string | null;
  issuing_organization?: string | null;
  issue_date?: Date | null;
  expiry_date?: Date | null;
  certificate_id?: string | null;
  no_expiry?: boolean | null;
}

export interface ISkill {
  skill_name?: string | null;
  proficiency_level?: "beginner" | "intermediate" | "advanced" | "expert" | null;
  years_experience?: number | null;
  skill_type?: "technical" | "soft_skill" | "language" | null;
}

export interface IFileRef {
  name?: string | null;
  url?: string | null;
}

export interface IEmployeeDocuments {
  resume?: IFileRef | null;
  id_proof?: IFileRef | null;
  certificate_documents?: IFileRef[];
}

export type WeekDay = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export interface IWeeklyScheduleDay {
  day: WeekDay;
  isWorking?: boolean | null;
  start?: string | null;
  end?: string | null;
}

// A record of a past weekly_schedule and the date from which it was
// actually in effect — appended to whenever an employee's schedule changes,
// so the attendance calendar can show the schedule that was really live on
// a given historical date instead of retroactively applying today's schedule.
export interface IWeeklyScheduleHistoryEntry {
  schedule: IWeeklyScheduleDay[];
  effectiveFrom: Date;
}

// Sun-Thu working / Fri-Sat off matches the region's standard work week —
// same default the frontend uses. Replaces the old single company-wide
// Shift (one shift, same hours every day): each employee now has their own
// hours per day, and their own days off.
export const DEFAULT_WEEKLY_SCHEDULE: IWeeklyScheduleDay[] = [
  { day: "sun", isWorking: true, start: "09:00", end: "18:00" },
  { day: "mon", isWorking: true, start: "09:00", end: "18:00" },
  { day: "tue", isWorking: true, start: "09:00", end: "18:00" },
  { day: "wed", isWorking: true, start: "09:00", end: "18:00" },
  { day: "thu", isWorking: true, start: "09:00", end: "18:00" },
  { day: "fri", isWorking: false, start: "09:00", end: "18:00" },
  { day: "sat", isWorking: false, start: "09:00", end: "18:00" },
];

export type EmployeeStatus =
  | "probation"
  | "active"
  | "resigned"
  | "retired"
  | "terminated"
  | "absconding";

export interface IEmployeeModel extends Document {
  employeeCode?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  gender?: "male" | "female" | null;
  dob?: Date | null;
  address?: string | null;
  emergency_contact?: string | null;
  blood_group?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | null;
  marital_status?: "single" | "married" | null;
  nationality?: string | null;
  national_id?: string | null;
  national_id_expiry?: Date | null;
  nationality_type?: "Saudi" | "Expatriate" | null;
  work_permit_no?: string | null;
  work_permit_expiry?: Date | null;
  image?: string | null;

  departmentId?: mongoose.Types.ObjectId | null;
  designationId?: mongoose.Types.ObjectId | null;
  weekly_schedule?: IWeeklyScheduleDay[];
  weeklyScheduleHistory?: IWeeklyScheduleHistoryEntry[];
  joining_date?: Date | null;
  managerEmployeeId?: mongoose.Types.ObjectId | null;
  work_location?: string | null;
  employment_type?: "permanent" | "contract" | "trainee" | null;
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

  isDeleted?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const educationSchema = new Schema<IEducation>(
  {
    degree_name: { type: String, required: false },
    field_major: { type: String, required: false },
    institute_university: { type: String, required: false },
    board_university: { type: String, required: false },
    country_city: { type: String, required: false },
    end_date: { type: Date, required: false },
    percentage_cgpa: { type: String, required: false },
  },
  { _id: false }
);

const certificateSchema = new Schema<ICertificate>(
  {
    certificate_name: { type: String, required: false },
    issuing_organization: { type: String, required: false },
    issue_date: { type: Date, required: false },
    expiry_date: { type: Date, required: false },
    certificate_id: { type: String, required: false },
    no_expiry: { type: Boolean, default: false },
  },
  { _id: false }
);

const skillSchema = new Schema<ISkill>(
  {
    skill_name: { type: String, required: false },
    proficiency_level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "expert"],
      required: false,
    },
    years_experience: { type: Number, required: false },
    skill_type: {
      type: String,
      enum: ["technical", "soft_skill", "language"],
      required: false,
    },
  },
  { _id: false }
);

const fileRefSchema = new Schema<IFileRef>(
  {
    name: { type: String, required: false },
    url: { type: String, required: false },
  },
  { _id: false }
);

const documentsSchema = new Schema<IEmployeeDocuments>(
  {
    resume: { type: fileRefSchema, default: null },
    id_proof: { type: fileRefSchema, default: null },
    certificate_documents: { type: [fileRefSchema], default: [] },
  },
  { _id: false }
);

const weeklyScheduleDaySchema = new Schema<IWeeklyScheduleDay>(
  {
    day: { type: String, enum: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], required: true },
    isWorking: { type: Boolean, default: true },
    start: { type: String, default: null },
    end: { type: String, default: null },
  },
  { _id: false }
);

const weeklyScheduleHistorySchema = new Schema<IWeeklyScheduleHistoryEntry>(
  {
    schedule: { type: [weeklyScheduleDaySchema], required: true },
    effectiveFrom: { type: Date, required: true },
  },
  { _id: false }
);

const employeeSchema: Schema<IEmployeeModel> = new Schema(
  {
    employeeCode: { type: String, required: false },
    first_name: { type: String, required: true },
    last_name: { type: String, required: false },
    email: { type: String, required: false },
    phone: { type: String, required: false },
    gender: { type: String, enum: ["male", "female"], required: false },
    dob: { type: Date, required: false },
    address: { type: String, required: false },
    emergency_contact: { type: String, required: false },
    blood_group: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      required: false,
    },
    marital_status: { type: String, enum: ["single", "married"], required: false },
    nationality: { type: String, required: false },
    national_id: { type: String, required: false },
    national_id_expiry: { type: Date, required: false },
    nationality_type: { type: String, enum: ["Saudi", "Expatriate"], required: false },
    work_permit_no: { type: String, required: false },
    work_permit_expiry: { type: Date, required: false },
    image: { type: String, required: false },

    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    designationId: { type: Schema.Types.ObjectId, ref: "Designation", required: true },
    weekly_schedule: { type: [weeklyScheduleDaySchema], default: () => DEFAULT_WEEKLY_SCHEDULE },
    weeklyScheduleHistory: { type: [weeklyScheduleHistorySchema], default: [] },
    joining_date: { type: Date, required: false },
    managerEmployeeId: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    work_location: { type: String, required: false },
    employment_type: {
      type: String,
      enum: ["permanent", "contract", "trainee"],
      required: false,
    },
    probation_end: { type: Date, required: false },
    status: {
      type: String,
      enum: ["probation", "active", "resigned", "retired", "terminated", "absconding"],
      default: "probation",
    },
    resignation_date: { type: Date, default: null },
    retirement_date: { type: Date, default: null },
    termination_date: { type: Date, default: null },
    last_seen_date: { type: Date, default: null },

    education: { type: [educationSchema], default: [] },
    certificates: { type: [certificateSchema], default: [] },
    skills: { type: [skillSchema], default: [] },
    documents: { type: documentsSchema, default: null },

    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "employee",
  }
);

employeeSchema.index({ adminId: 1, merchantId: 1, employeeCode: 1 }, { unique: true, sparse: true });

// Serves employee-service.ts's getAll list (tenant-scoped, sorted _id:-1).
employeeSchema.index({ adminId: 1, merchantId: 1, _id: -1 });

export const EmployeeModel: Model<IEmployeeModel> = model<IEmployeeModel>("Employee", employeeSchema);
