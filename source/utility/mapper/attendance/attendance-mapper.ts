import { attendanceDto } from "../../dtos/attendance/attendance-dto";
import { IAttendanceModel } from "../../../model/attendance/attendance-model";
import { populatedEmployeeFields } from "../../helper/list-query";

const mapDbToDto = (dbModel: IAttendanceModel): attendanceDto => {
  const emp = populatedEmployeeFields(dbModel.employeeId);
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    employeeId: emp.id,
    employeeName: emp.name,
    employeeCode: emp.code,
    date: dbModel.date || null,
    status: dbModel.status || null,
    checkIn: dbModel.checkIn || null,
    checkOut: dbModel.checkOut || null,
    shiftType: dbModel.shiftType || null,
    overtimeHours: dbModel.overtimeHours ?? 0,
    lateMinutes: dbModel.lateMinutes ?? 0,
    earlyLeaveMinutes: dbModel.earlyLeaveMinutes ?? 0,
    notes: dbModel.notes || null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IAttendanceModel[]): attendanceDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
