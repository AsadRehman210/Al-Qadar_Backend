import { HttpStatus, ErrorCode, ErrorCodeInternal } from "./constants/enum";
import * as message from "./constants/message";

// Mongoose's `timestamps: true` sets createdAt and updatedAt to the exact
// same instant on insert (a single `now` shared by both fields internally) —
// so "updatedAt still equals createdAt" is a reliable, universal signal that
// a record has never actually been updated since creation. Every controller
// in this codebase routes its response through success()/pagination()/
// successList() below, so stripping the field there (rather than in each of
// the 50+ individual mappers) fixes this app-wide in one place: a freshly
// created record's response carries only createdAt; updatedAt only appears
// once a real update has moved it away from createdAt.
const stripUnchangedUpdatedAt = (value: any, seen: Set<any> = new Set()): any => {
  if (value === null || typeof value !== "object" || value instanceof Date) {
    return value;
  }
  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) stripUnchangedUpdatedAt(item, seen);
    return value;
  }

  if (
    Object.prototype.hasOwnProperty.call(value, "createdAt") &&
    Object.prototype.hasOwnProperty.call(value, "updatedAt") &&
    value.createdAt &&
    value.updatedAt
  ) {
    const createdTime = new Date(value.createdAt).getTime();
    const updatedTime = new Date(value.updatedAt).getTime();
    if (!Number.isNaN(createdTime) && createdTime === updatedTime) {
      delete value.updatedAt;
    }
  }

  for (const key of Object.keys(value)) {
    stripUnchangedUpdatedAt(value[key], seen);
  }
  return value;
};

interface ApiResponse {
  error_code?: number | null;
  success?: boolean | null;
  status?: HttpStatus | null;
  total_records?: number | null;
  page_number?: number | null;
  total_pages?: number | null;
  message?: string | null;
  error_message?: any | null;
  result?: any | null;
}

const createApiResponsePagination = (): ApiResponse => ({
  error_code: null,
  success: null,
  status: null,
  total_records: null,
  page_number: null,
  total_pages: null,
  message: null,
  error_message: null,
  result: null,
});

const createApiResponse = (): ApiResponse => ({
  error_code: null,
  success: null,
  status: null,
  message: null,
  error_message: null,
  result: null,
});

const success = <T>(message: string, error_code: ErrorCode, data?: T): ApiResponse => {
  const response: ApiResponse = createApiResponse();
  response.error_code = error_code;
  response.success = true;
  response.status = HttpStatus.ok;
  response.message = message;
  response.result = stripUnchangedUpdatedAt(data) ?? null;
  return response;
};

const pagination = <T>(data: T, total_records: number, page: number, limit: number): ApiResponse => {
  const response: ApiResponse = createApiResponsePagination();
  response.error_code = ErrorCode.success;
  response.success = true;
  response.status = HttpStatus.ok;
  response.message = message.Messages.MSG_DATA_FOUND;
  response.total_records = total_records;
  response.page_number = page;
  response.total_pages = Math.ceil(total_records / limit);
  response.result = stripUnchangedUpdatedAt(data);
  return response;
};

const successList = <T>(list: T[] = [], message: string, error_code: ErrorCode): ApiResponse => {
  const response: ApiResponse = createApiResponse();
  response.error_code = error_code;
  response.success = true;
  response.status = HttpStatus.ok;
  response.message = message;
  response.result = stripUnchangedUpdatedAt(list);
  return response;
};

const error = (message: string, error_code: ErrorCode | ErrorCodeInternal, error?: any): ApiResponse => {
  const response: ApiResponse = createApiResponse();
  response.error_code = error_code;
  response.success = false;
  response.status = HttpStatus.ok;
  response.message = message;
  response.result = null;
  response.error_message = error || null;
  return response;
};

export { success, pagination, successList, error };
