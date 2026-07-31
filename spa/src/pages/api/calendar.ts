import { BookingDB, BookingForm, Property, convertStringOnlyToProperty, convertStringToProperty } from '@/utils/lib/bookingType';
import { NextApiRequest, NextApiResponse } from 'next';
import { Month, TimeSlot, generateHourAvailabilityMap, getTimeSlots, monthConvert } from '@/utils/lib/availabilityMap';
import { removeSpacesAndCapitalize } from '@/utils/lib/helper';
import { fetchLatestBooking } from '@/utils/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
  case 'GET':
    await handleGet(req, res);
    break;
  default:
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  const { properties, month, year, bookingId } = req.query;
  let propertiesInternal = (properties as string).split(',').map((property) => convertStringOnlyToProperty(removeSpacesAndCapitalize(property)));
  let internalMonth = (month as string).toLocaleLowerCase() as Month
  let calendarIds: string[] = [];
  if(bookingId) {
    const { history } = await fetchLatestBooking(
      parseInt(bookingId as string)
    );
    let lastBooking: BookingDB = history[0];
    
    if(lastBooking.bookingType == "Stay") {
      let values = Object.values(lastBooking.calendarIds ?? []); 
      calendarIds.push(...values);
    } else {
        for (let event of lastBooking.events ?? []) {
          let values = Object.values(event.calendarIds ?? []); 
          calendarIds.push(...values);
        }
    }
    // console.log("bookingId", bookingId, " ", lastBooking.bookingType,", booking:", calendarIds);
  }
  
  
  let timeSlots: TimeSlot[] = await getTimeSlots(internalMonth, propertiesInternal, year as string, calendarIds);
  res.status(200).json(generateHourAvailabilityMap(timeSlots, monthConvert[internalMonth], parseInt(year as string)));
};
