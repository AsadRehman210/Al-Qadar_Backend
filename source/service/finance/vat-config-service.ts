import { VatConfigModel } from "../../model/finance/vat-config-model";
import { TenantScope } from "../../utility/helper/tenant-scope";

export interface vatConfigDto {
  id: string | null;
  rate: number;
  registrationNumber: string | null;
}

const mapDbToDto = (dbModel: { _id?: unknown; rate?: number | null; registrationNumber?: string | null } | null): vatConfigDto => {
  if (!dbModel) return { id: null, rate: 0, registrationNumber: null };
  return {
    id: dbModel._id ? String(dbModel._id) : null,
    rate: dbModel.rate || 0,
    registrationNumber: dbModel.registrationNumber || null,
  };
};

// No config yet just means a 0% rate — every invoice/bill still posts
// correctly, VAT amounts are simply zero until the tenant sets a real rate.
const get = async (filter: Record<string, unknown>): Promise<vatConfigDto> => {
  const data = await VatConfigModel.findOne(filter).lean();
  return mapDbToDto(data);
};

const upsert = async (
  data: { rate: number; registrationNumber?: string },
  scope: TenantScope,
  createdBy: string
): Promise<vatConfigDto> => {
  const updated = await VatConfigModel.findOneAndUpdate(
    { adminId: scope.adminId, merchantId: scope.merchantId },
    {
      $set: { rate: data.rate, registrationNumber: data.registrationNumber || null },
      $setOnInsert: { adminId: scope.adminId, merchantId: scope.merchantId, createdBy },
    },
    { new: true, upsert: true }
  ).lean();
  return mapDbToDto(updated);
};

export { get, upsert };
