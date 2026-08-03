import { BookingDB, CalendarCell, Event, Property } from "./lib/bookingType";

export const PRECONFIRMED_CALENDAR_COLOR = "#F6BF26";

export function generateHourAvailabilityMapGivenStartDate(
  availabilityMap: Record<string, Record<string, Record<string, boolean>>>,
  year: number,
  month: number,
  day: number,
  startHour: number
): Record<string, Record<string, Record<string, boolean>>> {
  let currentMonth = month;
  let currentDay = day;
  let currentHour = startHour;
  const hourAvailabilityMap: Record<string, Record<string, Record<string, boolean>>> = initializeHourAvailabilityMap(currentMonth, year, false);
  while (true) {

    const monthStr = currentMonth.toString();
    const dayStr = currentDay.toString().padStart(2, '0');
    const hourStr = currentHour.toString() //.padStart(2, '0');      
    if (availabilityMap[monthStr] == undefined ||
      availabilityMap[monthStr][dayStr] == undefined ||
      availabilityMap[monthStr][dayStr][hourStr] == undefined ||
      availabilityMap[monthStr][dayStr][hourStr] === false) {
      // We've found the next unavailable hour, so return the previous hour
      return hourAvailabilityMap;
    }

    // Move to the next hour
    currentHour++;
    if (currentHour >= 24) {
      currentHour = 0;
      currentDay++;
      // Check if we need to move to the next month
      if (!availabilityMap[monthStr][currentDay.toString().padStart(2, '0')]) {
        currentDay = 1;
        currentMonth++;
        if (currentMonth > 12) {
          // We've reached the end of the year, stop here
          return hourAvailabilityMap;
        }
      }
    }
    hourAvailabilityMap[monthStr][dayStr][hourStr] = true;
  }
}

export function initializeHourAvailabilityMap(month: number, year: number, defaultValue: boolean = true): Record<string, Record<string, Record<string, boolean>>> {
  const hourAvailabilityMap: Record<
    string,
    Record<string, Record<string, boolean>>
  > = {};

  // Ensure month is between 1 and 12
  if (month < 1 || month > 12) {
    throw new Error("Month must be between 1 and 12");
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const monthString = month.toString();

  hourAvailabilityMap[monthString] = {};

  for (let day = 1; day <= daysInMonth; day++) {
    const dayString = day.toString().padStart(2, "0");
    hourAvailabilityMap[monthString][dayString] = {};

    for (let hour = 0; hour < 24; hour++) {
      hourAvailabilityMap[monthString][dayString][hour.toString()] =
        defaultValue;
    }
  }

  return hourAvailabilityMap;
}
export function getPropertyColor(property:Property){
  switch (property.replace(/\s/g, '').toLocaleLowerCase()) {
    case "Bluehouse".toLocaleLowerCase():
      return "#4287EE";
    case "Glasshouse".toLocaleLowerCase():
      return  "#8F24AB";
    case "MeadowLane".toLocaleLowerCase():
      return  "#C1C0BE";
    case "LeChalet".toLocaleLowerCase():
      return  "#DD7F74";
    case "VillaArmati".toLocaleLowerCase():
      return  "#D50106";
    case "Castle".toLocaleLowerCase():
      return  "#127D3E";
    default:
      return  "#129CED";;
  }
}

export function getBookingCalendarColor(
  booking: BookingDB,
  property: Property
) {
  return booking.status === "Preconfirmed"
    ? PRECONFIRMED_CALENDAR_COLOR
    : getPropertyColor(property);
}

export function getEventsFromBooking(bookings:BookingDB[],filteredByProperty:Property|'all') {
  

  let calendarCells=[] as CalendarCell[];
  bookings.map(booking=>{
    let events = booking.events;
  if (booking.bookingType === 'Stay') {
    let event: Event = {
      ...booking,
      finalCost: booking.totalCost,
      djService: false,
      eventName: 'Stay',
      valetService: false,
      kitchenService: false, 
      overNightStay: false, 
      overNightGuests: 0, 
      markForDeletion: false
    };
    events = [event]
  } 

  for (let i = 0; i < events.length; i++) {
    const event: Event = events[i];
if(filteredByProperty!='all'){
  if (!event.properties.includes(filteredByProperty)) {
    continue;
  }
  let calendarCell:CalendarCell={
    booking:{...booking},
    startDateTime:event.startDateTime,
    endDateTime:event.endDateTime,
    color:getBookingCalendarColor(booking, filteredByProperty),
    propertyName:filteredByProperty.toLowerCase(),
    order:Math.floor(Math.random() * 100000) + (booking.bookingId||999)
  
  }
  calendarCells.push(calendarCell);
}else{
  const properties = event.properties;
  for (const property of properties) {
    let calendarCell:CalendarCell={
      booking:{...booking},
      startDateTime:event.startDateTime,
      endDateTime:event.endDateTime,
      color:getBookingCalendarColor(booking, property),
      propertyName:property.toLowerCase(),
      order:(Math.floor(Math.random() * 100000)  + (booking.bookingId||999))
    }
   // console.log(calendarCell);
    
    calendarCells.push(calendarCell);
  }
}
   
  }
  })

  return calendarCells;
}
