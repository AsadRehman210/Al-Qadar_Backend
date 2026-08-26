import { AnnouncementModel } from "../../model/announcement/announcement-model";
import { announcementDto } from "../../utility/dtos/announcement/announcement-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/announcement/announcement-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";

export interface AnnouncementListOptions {
  search?: string;
  category?: string;
}

interface CreateAnnouncementInput {
  title: string;
  body: string;
  category?: string;
  pinned?: boolean;
}

const create = async (
  data: CreateAnnouncementInput,
  scope: TenantScope,
  createdBy: string
): Promise<announcementDto> => {
  const announcement = await AnnouncementModel.create({
    title: data.title,
    body: data.body,
    category: data.category || "General",
    pinned: data.pinned ?? false,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return mapDbToDto(announcement);
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: AnnouncementListOptions = {}
): Promise<{ totalCount: number; result: announcementDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    isDeleted: { $ne: true },
    ...buildSearchCondition(options.search, ["title", "body"]),
    ...buildExactFilters(options as Record<string, unknown>, { category: "category" }),
  };

  const data = await AnnouncementModel.find(query)
    .skip(startIndex)
    .limit(limit)
    .sort({ pinned: -1, createdAt: -1 })
    .lean();
  const count = await AnnouncementModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<boolean> => {
  const result = await AnnouncementModel.findOneAndUpdate(
    { _id: id, ...filter, isDeleted: { $ne: true } },
    { $set: { isDeleted: true } },
    { new: true }
  ).select("_id").lean();
  return Boolean(result);
};

export { create, getAll, deleteByID };
