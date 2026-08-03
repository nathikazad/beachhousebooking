import { NextApiRequest, NextApiResponse } from "next";
import { getGptEventSchedule, GptActionInputError } from "@/utils/lib/gptActions";
import {
  prepareGptActionRequest,
  queryBoolean,
  queryValue,
  sendGptActionError,
} from "@/utils/lib/gptActionHttp";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!prepareGptActionRequest(req, res)) return;
  try {
    const date = queryValue(req.query.date);
    if (!date) throw new GptActionInputError("date is required.");
    const result = await getGptEventSchedule({
      date,
      includeStays: queryBoolean(req.query.includeStays, "includeStays"),
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendGptActionError(res, error, "getEventSchedule");
  }
}
