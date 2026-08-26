import { Request, Response } from "express";
import * as geoService from "../../service/reference/geo-service";
import { error, pagination } from "../../utility/helper/common";
import { Messages } from "../../utility/helper/constants/message";
import * as Enums from "../../utility/helper/constants/enum";

const getCountries = async (req: Request, res: Response): Promise<Response> => {
  try {
    const query = req.query as { page?: string; limit?: string; search?: string };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 20 : Number(query.limit);

    const all = geoService.getCountries(query.search);
    const startIndex = (page - 1) * limit;
    const pageItems = all.slice(startIndex, startIndex + limit);

    if (!pageItems.length) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(pagination(pageItems, all.length, page, limit));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

const getCities = async (req: Request, res: Response): Promise<Response> => {
  try {
    const query = req.query as { page?: string; limit?: string; search?: string };
    const page = !query.page || isNaN(Number(query.page)) ? 1 : Number(query.page);
    const limit = !query.limit || isNaN(Number(query.limit)) ? 20 : Number(query.limit);

    const all = geoService.getCities(req.params.isoCode, query.search);
    const startIndex = (page - 1) * limit;
    const pageItems = all.slice(startIndex, startIndex + limit);

    if (!pageItems.length) {
      return res.json(error(Messages.MSG_NO_RECORD, Enums.ErrorCode.not_exist));
    }
    return res.json(pagination(pageItems, all.length, page, limit));
  } catch (err: any) {
    return res.json(error(Messages.MSG_UNEXPECTED_ERROR, Enums.ErrorCode.exception, err.message));
  }
};

export { getCountries, getCities };
