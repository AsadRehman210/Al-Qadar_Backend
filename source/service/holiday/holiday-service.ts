import { HolidayModel } from "../../model/holiday/holiday-model";
import { holidayDto } from "../../utility/dtos/holiday/holiday-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/holiday/holiday-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";

export interface HolidayListOptions {
  search?: string;
  type?: string;
  recurring?: string;
}

interface CreateHolidayInput {
  name: string;
  date: string;
  type?: string;
  recurring?: boolean;
}

interface HolidayResult {
  errorCode: "success" | "not_found";
  result: holidayDto | null;
}

const create = async (
  data: CreateHolidayInput,
  scope: TenantScope,
  createdBy: string
): Promise<HolidayResult> => {
  const holiday = await HolidayModel.create({
    name: data.name,
    date: new Date(data.date),
    type: data.type || "Public",
    recurring: data.recurring ?? true,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapDbToDto(holiday) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: HolidayListOptions = {}
): Promise<{ totalCount: number; result: holidayDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query: Record<string, unknown> = {
    ...filter,
    isDeleted: { $ne: true },
    ...buildSearchCondition(options.search, ["name"]),
    ...buildExactFilters(options as Record<string, unknown>, { type: "type" }),
  };
  if (options.recurring !== undefined && options.recurring !== "") {
    query.recurring = options.recurring === "true";
  }

  const data = await HolidayModel.find(query).skip(startIndex).limit(limit).sort({ date: 1 }).lean();
  const count = await HolidayModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

interface HolidaySummary {
  total: number;
  upcoming: number;
  next: holidayDto | null;
}

// Tenant-wide totals independent of pagination/search — used for the list
// page's stat cards ("total", "upcoming", "next holiday").
const getSummary = async (filter: Record<string, unknown>): Promise<HolidaySummary> => {
  const base = { ...filter, isDeleted: { $ne: true } };
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [total, upcoming, nextDoc] = await Promise.all([
    HolidayModel.countDocuments(base),
    HolidayModel.countDocuments({ ...base, date: { $gte: todayStart } }),
    HolidayModel.findOne({ ...base, date: { $gte: todayStart } }).sort({ date: 1 }).lean(),
  ]);

  return { total, upcoming, next: nextDoc ? mapDbToDto(nextDoc) : null };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<holidayDto | null> => {
  const data = await HolidayModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } }).lean();
  return data ? mapDbToDto(data) : null;
};

const update = async (
  id: string,
  data: Partial<CreateHolidayInput>,
  filter: Record<string, unknown>
): Promise<HolidayResult> => {
  const updatePayload: Record<string, unknown> = { ...data };
  if (data.date) updatePayload.date = new Date(data.date);

  const updated = await HolidayModel.findOneAndUpdate(
    { _id: id, ...filter, isDeleted: { $ne: true } },
    { $set: updatePayload },
    { new: true }
  ).lean();

  if (!updated) return { errorCode: "not_found", result: null };
  return { errorCode: "success", result: mapDbToDto(updated) };
};

const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<boolean> => {
  const result = await HolidayModel.findOneAndUpdate(
    { _id: id, ...filter, isDeleted: { $ne: true } },
    { $set: { isDeleted: true } },
    { new: true }
  ).select("_id").lean();
  return Boolean(result);
};

/**
 * Used by Attendance marking to auto-detect a holiday for a given date —
 * `recurring` holidays match on month+day across any year, others match
 * the exact stored date.
 */
const getForDate = async (dateStr: string, filter: Record<string, unknown>): Promise<holidayDto | null> => {
  const target = new Date(dateStr);
  const month = target.getUTCMonth();
  const day = target.getUTCDate();

  const query = { ...filter, isDeleted: { $ne: true } };
  const candidates = await HolidayModel.find(query).lean();

  const match = candidates.find((h) => {
    if (!h.date) return false;
    if (h.recurring) {
      return h.date.getUTCMonth() === month && h.date.getUTCDate() === day;
    }
    return (
      h.date.getUTCFullYear() === target.getUTCFullYear() &&
      h.date.getUTCMonth() === month &&
      h.date.getUTCDate() === day
    );
  });

  return match ? mapDbToDto(match) : null;
};

export { create, getAll, getSummary, get, update, deleteByID, getForDate };
