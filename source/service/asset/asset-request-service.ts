import { AssetRequestModel } from "../../model/asset/asset-request-model";
import { EmployeeModel } from "../../model/employee/employee-model";
import { AssetCategoryModel } from "../../model/asset/asset-category-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { assetRequestDto } from "../../utility/dtos/asset/asset-request-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/asset/asset-request-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { toDateOnly } from "../../utility/helper/date-only";
import * as assetService from "./asset-service";

const POPULATE: [string, string][] = [
  ["employeeId", "first_name last_name"],
  ["categoryId", "name"],
];

const populateAll = async (doc: any) => {
  for (const [field, select] of POPULATE) await doc.populate(field, select);
  return doc;
};

export interface AssetRequestListOptions {
  search?: string;
  status?: string;
  priority?: string;
  employeeId?: string;
}

interface CreateAssetRequestInput {
  employeeId: string;
  categoryId?: string;
  justification?: string;
  priority?: string;
  requestedDate?: string;
}

type AssetRequestErrorCode =
  | "success"
  | "not_found"
  | "employee_not_found"
  | "category_not_found"
  | "already_decided"
  | "invalid_status"
  | "asset_not_found"
  | "already_assigned"
  | "already_disposed";

interface AssetRequestResult {
  errorCode: AssetRequestErrorCode;
  result: assetRequestDto | null;
}

const create = async (
  data: CreateAssetRequestInput,
  scope: TenantScope,
  createdBy: string
): Promise<AssetRequestResult> => {
  const employee = await EmployeeModel.findOne({ _id: data.employeeId, adminId: scope.adminId, merchantId: scope.merchantId }).lean();
  if (!employee) {
    return { errorCode: "employee_not_found", result: null };
  }
  if (data.categoryId) {
    const category = await AssetCategoryModel.findOne({ _id: data.categoryId, adminId: scope.adminId, merchantId: scope.merchantId }).lean();
    if (!category) {
      return { errorCode: "category_not_found", result: null };
    }
  }

  const request = await AssetRequestModel.create({
    employeeId: data.employeeId,
    categoryId: data.categoryId || null,
    justification: data.justification || null,
    priority: data.priority || "Normal",
    status: "Pending",
    requestedDate: data.requestedDate ? toDateOnly(data.requestedDate) : new Date(),
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  await populateAll(request);
  return { errorCode: "success", result: mapDbToDto(request) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: AssetRequestListOptions = {}
): Promise<{ totalCount: number; result: assetRequestDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["justification"]),
    ...buildExactFilters(options as Record<string, unknown>, {
      status: "status",
      priority: "priority",
      employeeId: "employeeId",
    }),
  };

  let cursor = AssetRequestModel.find(query).skip(startIndex).limit(limit).sort({ createdAt: -1 });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  const count = await AssetRequestModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<assetRequestDto | null> => {
  let cursor = AssetRequestModel.findOne({ _id: id, ...filter });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  return data ? mapDbToDto(data) : null;
};

interface DecideAssetRequestInput {
  status: "Approved" | "Rejected";
  decisionNotes?: string;
}

const decide = async (
  id: string,
  data: DecideAssetRequestInput,
  filter: Record<string, unknown>,
  decidedBy: string
): Promise<AssetRequestResult> => {
  const request = await AssetRequestModel.findOne({ _id: id, ...filter });
  if (!request) {
    return { errorCode: "not_found", result: null };
  }
  if (request.status !== "Pending") {
    return { errorCode: "already_decided", result: null };
  }

  request.status = data.status;
  request.decidedBy = decidedBy as any;
  request.decidedDate = new Date();
  request.decisionNotes = data.decisionNotes || null;
  await request.save();
  await populateAll(request);
  return { errorCode: "success", result: mapDbToDto(request) };
};

// Fulfilling an already-Approved request assigns the chosen asset straight
// to the requesting employee — reuses asset-service's own assign() so the
// two flows can never drift out of sync (e.g. one crediting assignmentHistory
// and the other not).
const fulfill = async (
  id: string,
  assetId: string,
  filter: Record<string, unknown>,
  actingUserId: string
): Promise<AssetRequestResult> => {
  const request = await AssetRequestModel.findOne({ _id: id, ...filter });
  if (!request) {
    return { errorCode: "not_found", result: null };
  }
  if (request.status !== "Approved") {
    return { errorCode: "invalid_status", result: null };
  }

  const assignResult = await assetService.assign(
    assetId,
    { employeeId: String(request.employeeId), notes: `Fulfilled asset request ${request._id}` },
    { adminId: request.adminId, merchantId: request.merchantId },
    actingUserId
  );
  if (assignResult.errorCode !== "success") {
    return { errorCode: assignResult.errorCode === "not_found" ? "asset_not_found" : assignResult.errorCode as AssetRequestErrorCode, result: null };
  }

  request.status = "Fulfilled";
  request.fulfilledAssetId = assetId as any;
  await request.save();
  await populateAll(request);
  return { errorCode: "success", result: mapDbToDto(request) };
};

export { create, getAll, get, decide, fulfill };
