import { NextApiRequest, NextApiResponse } from "next";
import {
  GptActionInputError,
  searchGptBookings,
} from "@/utils/lib/gptActions";
import {
  prepareGptActionRequest,
  queryBoolean,
  queryInteger,
  queryValue,
  sendGptActionError,
} from "@/utils/lib/gptActionHttp";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!prepareGptActionRequest(req, res)) return;
  try {
    const bookingType = queryValue(req.query.bookingType);
    const dateBasis = queryValue(req.query.dateBasis);
    if (bookingType && bookingType !== "Stay" && bookingType !== "Event") {
      throw new GptActionInputError("bookingType must be Stay or Event.");
    }
    if (dateBasis && dateBasis !== "created" && dateBasis !== "checkIn") {
      throw new GptActionInputError("dateBasis must be created or checkIn.");
    }
    const result = await searchGptBookings({
      client: queryValue(req.query.client),
      employee: queryValue(req.query.employee),
      status: queryValue(req.query.status),
      bookingType:
        bookingType === "Stay" || bookingType === "Event"
          ? bookingType
          : undefined,
      property: queryValue(req.query.property),
      from: queryValue(req.query.from),
      to: queryValue(req.query.to),
      dateBasis: dateBasis as "created" | "checkIn" | undefined,
      outstandingOnly: queryBoolean(
        req.query.outstandingOnly,
        "outstandingOnly"
      ),
      limit: queryInteger(req.query.limit, "limit"),
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendGptActionError(res, error, "searchBookings");
  }
}
