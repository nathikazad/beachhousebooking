import { NextApiRequest, NextApiResponse } from "next";
import { getGptBookingDetails } from "@/utils/lib/gptActions";
import {
  prepareGptActionRequest,
  queryInteger,
  sendGptActionError,
} from "@/utils/lib/gptActionHttp";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!prepareGptActionRequest(req, res)) return;
  try {
    const bookingId = queryInteger(req.query.bookingId, "bookingId");
    const result = await getGptBookingDetails(bookingId ?? 0);
    return res.status(200).json(result);
  } catch (error) {
    return sendGptActionError(res, error, "getBookingDetails");
  }
}
