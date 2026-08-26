import mongoose from 'mongoose';
import { ActivityFlag } from "../../utility/helper/constants/enum";
import { userModel } from "../../model/user/user-model";
import { userDto } from "../../utility/dtos/user/user-dto";
import { boolRM } from "../../utility/response_model/bool-rm";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/user/user-mapper";
import * as Enums from "../../utility/helper/constants/enum";
import { TenantScope } from "../../utility/helper/tenant-scope";
import moment from 'moment';
// import {
//   get,
// } from "../../apis/subscriber/subscriber"

const post = async (model: any, scope: TenantScope): Promise<{ result: userDto | null; errorCode: number }> => {
  let data;
  let errorCode: number = Number.MIN_SAFE_INTEGER;

  // If no ID or ID is 0, create a new user
  if (model.id == 0 || model.id === undefined) {
    if (model.email) {
      const existing = await userModel.findOne({
        email: model.email,
        adminId: scope.adminId,
        merchantId: scope.merchantId,
        action_type: { $ne: Enums.ActivityFlag.delete },
      }).select("_id").lean();
      if (existing) {
        return { result: null, errorCode: Enums.ErrorCode.duplicate_entry };
      }
    }

    // Create a new ObjectId for the user
    model._id = new mongoose.Types.ObjectId();
    model.action_type = ActivityFlag.add;
    model.adminId = scope.adminId;
    model.merchantId = scope.merchantId;
    // Generate a code and set generation time
    model.code_generation_time = moment().format("YYYY MM DD HH:mm:ss");
    model.is_verified = Enums.ErrorCode.not_verified;

    // Save the new user to the database
    data = await userModel.create(model);
    errorCode = Enums.ErrorCode.success;
  } else if (model.id) {
    if (model.email) {
      const existing = await userModel.findOne({
        email: model.email,
        adminId: scope.adminId,
        merchantId: scope.merchantId,
        _id: { $ne: model.id },
        action_type: { $ne: Enums.ActivityFlag.delete },
      }).select("_id").lean();
      if (existing) {
        return { result: null, errorCode: Enums.ErrorCode.duplicate_entry };
      }
    }

    // Update existing user — scoped so one tenant can never edit another
    // tenant's record even if it guesses/leaks an _id.
    model.action_type = ActivityFlag.edit;
    delete model.adminId;
    delete model.merchantId;
    data = await userModel.findOneAndUpdate(
      { _id: model.id, adminId: scope.adminId, merchantId: scope.merchantId },
      model,
      { new: true }
    ).lean();
    errorCode = Enums.ErrorCode.updated;
  }

  // Return the result and error code
  if (data) {
    return { result: mapDbToDto(data), errorCode: errorCode };
  } else {
    return { result: null, errorCode: Enums.ErrorCode.failed };
  }
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number
): Promise<{ totalCount: number; result: userDto[] | null }> => {
  const startIndex = (page - 1) * limit;
  const query = { ...filter, action_type: { $ne: Enums.ActivityFlag.delete } };

  // Fetch paginated user data
  const data = await userModel.find(query).skip(startIndex).limit(limit).sort({ _id: -1 }).lean();

  // Count total number of users excluding deleted
  const count = await userModel.countDocuments(query);

  return {
    totalCount: count,
    result: mapDbListToDtoList(data),
  };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<userDto | null> => {
  // Fetch user by ID, excluding deleted ones, scoped to the caller's tenant
  const data = await userModel.findOne({ _id: id, ...filter, action_type: { $ne: Enums.ActivityFlag.delete } }).lean();

  if (data) {
    return mapDbToDto(data);
  } else {
    return null;
  }
};

const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<boolRM | null> => {
  // Mark user as deleted, scoped to the caller's tenant
  const data = await userModel.findOneAndUpdate(
    { _id: id, ...filter, action_type: { $ne: Enums.ActivityFlag.delete } },
    { $set: { action_type: ActivityFlag.delete } },
    {
      new: true,
      select: 'action_type',
    }
  ).lean();

  let result: boolRM = {
    trueOrFalse: false
  };

  // If the update was successful, set result to true
  if (data) {
    result.trueOrFalse = true;
  }
  return result;
};



export {
  post,
  getAll,
  get,
  deleteByID
};
