import { NextApiRequest, NextApiResponse } from "next";
import { getGptBusinessMetrics } from "@/utils/lib/gptActions";
import {
  prepareGptActionRequest,
  queryInteger,
  queryValue,
  sendGptActionError,
} from "@/utils/lib/gptActionHttp";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!prepareGptActionRequest(req, res)) return;
  try {
    const result = await getGptBusinessMetrics({
      month: queryInteger(req.query.month, "month"),
      year: queryInteger(req.query.year, "year"),
      employee: queryValue(req.query.employee),
      property: queryValue(req.query.property),
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendGptActionError(res, error, "getBusinessMetrics");
  }
}
