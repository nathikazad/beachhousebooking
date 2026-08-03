import { NextApiRequest, NextApiResponse } from "next";
import { getGptConflictSummary } from "@/utils/lib/gptActions";
import {
  prepareGptActionRequest,
  sendGptActionError,
} from "@/utils/lib/gptActionHttp";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!prepareGptActionRequest(req, res)) return;
  try {
    return res.status(200).json(await getGptConflictSummary());
  } catch (error) {
    return sendGptActionError(res, error, "getBookingConflicts");
  }
}
