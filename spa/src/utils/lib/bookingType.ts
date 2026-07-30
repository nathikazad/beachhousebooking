import { Filter } from "@/components/BookingFilter";

// enum of colors for the calendar
export enum Property {
  Bluehouse = "Bluehouse",
  Glasshouse = "Glasshouse",
  MeadowLane = "Meadow Lane",
  LeChalet = "Le Chalet",
  VillaArmati = "Villa Armati",
  Castle = "Castle",
}

export function convertStringToProperty(property: string): Property|'all' {
 
  switch (property.replace(/\s/g, '').toLocaleLowerCase()) {
    case "Bluehouse".toLocaleLowerCase():
      return Property.Bluehouse;
    case "Glasshouse".toLocaleLowerCase():
      return Property.Glasshouse;
    case "MeadowLane".toLocaleLowerCase():
      return Property.MeadowLane;
    case "LeChalet".toLocaleLowerCase():
      return Property.LeChalet;
    case "VillaArmati".toLocaleLowerCase():
      return Property.VillaArmati;
    case "Castle".toLocaleLowerCase():
      return Property.Castle;
    case "all".toLocaleLowerCase():
      return 'all';
    default:
      throw new Error("Invalid property");
  }
}
export function convertStringOnlyToProperty(property: string): Property {
 
  switch (property.replace(/\s/g, '').toLocaleLowerCase()) {
    case "Bluehouse".toLocaleLowerCase():
      return Property.Bluehouse;
    case "Glasshouse".toLocaleLowerCase():
      return Property.Glasshouse;
    case "MeadowLane".toLocaleLowerCase():
      return Property.MeadowLane;
    case "LeChalet".toLocaleLowerCase():
      return Property.LeChalet;
    case "VillaArmati".toLocaleLowerCase():
      return Property.VillaArmati;
    case "Castle".toLocaleLowerCase():
      return Property.Castle;
    
    default:
      throw new Error("Invalid property");
  }
}
// Function to convert query string to Property array
export const parseProperties = (propertiesString: string): Property[] => {
  const propertyNames = propertiesString.split(",").map((name) => name.trim());

  // Filter out invalid properties and map to Property enum
  return propertyNames
    .map((name) =>
      Object.values(Property).find((property) => property === name)
    )
    .filter((property): property is Property => property !== undefined);
};
// Utility function to parse createdBy
export const parseCreatedBy = (
  createdByString: string
): Filter["createdBy"] => {
  const validCreators = ["Indhu", "Thejas", "Yasmeen", "Rafica"] as const;
  return validCreators.find((creator) => creator === createdByString) || null;
};
// Utility function to parse status
export const parseStatus = (statusString: string): Filter["status"] => {
  const validStatuses = ["Inquiry", "Quotation", "Confirmed"] as const;
  return validStatuses.find((status) => status === statusString) || null;
};
export const calendarKeys: { [key: string]: string } = {
  [Property.Bluehouse]: "BLUEHOUSE_CALENDAR_ID",
  [Property.Glasshouse]: "GLASSHOUSE_CALENDAR_ID",
  [Property.MeadowLane]: "MEADOWLANE_CALENDAR_ID",
  [Property.LeChalet]: "LECHALET_CALENDAR_ID",
  [Property.VillaArmati]: "ARMATI_CALENDAR_ID",
  [Property.Castle]: "CASTLE_CALENDAR_ID",
};

export function getCalendarKey(property: Property): string {
  return process.env[calendarKeys[property]]!;
}

export interface Employee {
  id: string;
  name: string;
}

export function defaultForm(): BookingForm {
  return {
    client: {
      name: "",
      phone: "",
    },
    numberOfGuests: 2,
    numberOfEvents: 1,
    paymentMethod: "Cash",
    bookingType: "Stay",
    notes: "",
    properties: [],
    status: "Inquiry",
    startDateTime: undefined,
    endDateTime: undefined,
    events: [],
    costs: [],
    totalCost: 0,
    payments: [],
    calendarIds: {},
    refferral: undefined,
    starred: false,
    outstanding: 0,
    paid: 0,
    tax: 0,
    afterTaxTotal: 0,
    securityDeposit: {
      originalSecurityAmount: 0,
      paymentMethod: "Cash",
      dateReturned: undefined,
      amountReturned: 0,
    },
    createdDateTime: undefined,
  };
}

export interface BookingForm {
  bookingId?: number | undefined;
  client: {
    name: string;
    phone: string;
  };
  bookingType: "Stay" | "Event";
  numberOfEvents?: number | undefined;
  numberOfGuests: number;
  startDateTime: string | undefined;
  endDateTime: string | undefined;
  notes: string;
  properties: Property[];
  status: "Inquiry" | "Quotation" | "Preconfirmed" | "Confirmed";
  followUpDate?: string | undefined;
  events: Event[];
  costs: Cost[];
  totalCost: number;
  payments: Payment[];
  calendarIds?: { [key: string]: string } | undefined;
  refferral?: string | undefined;
  otherRefferal?: string | undefined;
  paymentMethod: "Cash" | "Card" | "GPay" | "Bank transfert";
  starred: boolean;
  paid: number;
  outstanding: number;
  afterTaxTotal: number;
  tax: number | undefined;
  securityDeposit: {
    originalSecurityAmount: number;
    paymentMethod: "Cash" | "Card" | "GPay" | "Bank transfert";
    dateReturned: string | undefined;
    amountReturned: number;
  };
  clientViewId?: string | undefined;
  createdDateTime: string | undefined;
}

export function numOfDays(bookingForm: BookingForm): number {
  if (bookingForm.startDateTime && bookingForm.endDateTime) {
    let start = new Date(bookingForm.startDateTime);
    let end = new Date(bookingForm.endDateTime);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
  } else {
    return 0;
  }
}

export function getProperties(bookingForm: BookingForm): Property[] {
  let properties: Property[] = [];
  for (let event of bookingForm.events) {
    for (let property of event.properties) {
      properties.push(property);
    }
  }
  for (let property of bookingForm.properties) {
    properties.push(property);
  }
  // remove duplicates
  return properties.filter(
    (value, index, self) => self.indexOf(value) === index
  );
}

export function convertPropertiesForDb(properties: Property[]): string[] {
  return properties.map((property) =>
    property.toLocaleLowerCase().replace(" ", "")
  );
}

export function organizedByStartDate(bookings: BookingDB[]): {
  [key: string]: BookingDB[];
} {
  let organizedBookings: { [key: string]: BookingDB[] } = {};

  for (let booking of bookings) {
    let date = new Date(booking.startDateTime).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
    });
    if (organizedBookings[date]) {
      organizedBookings[date].push(booking);
    } else {
      organizedBookings[date] = [booking];
    }
  }
  return organizedBookings;
}

export function organizedByCreatedDate(bookings: BookingDB[]): {
  [key: string]: BookingDB[];
} {
  let organizedBookings: { [key: string]: BookingDB[] } = {};

  for (let booking of bookings) {
    let date = new Date(booking.createdDateTime).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    if (organizedBookings[date]) {
      organizedBookings[date].push(booking);
    } else {
      organizedBookings[date] = [booking];
    }
  }
  return organizedBookings;
}

export function createDateFromIndianDate(date: string): Date {
  let dateParts = date.split("-");
  return new Date(
    parseInt(dateParts[0]),
    parseInt(dateParts[1]) - 1,
    parseInt(dateParts[2])
  );
}

export function convertIndianTimeToUTC(
  indianDateTimeString: string | undefined,
  onlyTime: boolean = false
): string {
  if (!indianDateTimeString) return "";

  let indianDate: Date;

  if (indianDateTimeString.includes("T")) {
    // ISO format
    indianDate = new Date(indianDateTimeString);
  } else {
    // Custom format: 'MM/DD/YYYY, HH:MM:SS AM/PM'
    const [datePart, timePart] = indianDateTimeString.split(",");
    const [month, day, year] = datePart.trim().split("/").map(Number);
    let [time, period] = timePart.trim().split(" ");
    let [hours, minutes, seconds] = time.split(":").map(Number);

    // Convert 12-hour time to 24-hour time
    if (period === "PM" && hours !== 12) {
      hours += 12;
    } else if (period === "AM" && hours === 12) {
      hours = 0;
    }

    // Create a Date object in Indian Time (UTC+5:30)
    indianDate = new Date(year, month - 1, day, hours, minutes, seconds);
    indianDate.setMinutes(indianDate.getMinutes() - 330); // Adjust for IST offset (+5:30)
  }

  // console.log("====================================");
  // console.log({ indianDateTimeString, indianDate });
  // console.log("====================================");
  return indianDate.toISOString();
}

export function printInIndianTime(
  utcDateTimeString: string | undefined,
  onlyTime: boolean = false
) {
  if (!utcDateTimeString) return "";
  const utcDate = new Date(utcDateTimeString!);
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  };
  let ret = new Intl.DateTimeFormat("en-US", options).format(utcDate);
  if (onlyTime) {
    ret = ret.split(",")[1];
    let ampm = ret.split(" ")[2];
    ret = ret.split(":").slice(0, 2).join(":");
    ret = ret + " " + ampm;
  }
  return ret;
}

export function convertDateToIndianDate({
  date,
  addDays,
}: {
  date?: Date | undefined;
  addDays?: number | undefined;
}) {
  let indianDate = new Date();
  if (date) {
    indianDate = new Date(date);
  }
  if (addDays) {
    indianDate.setDate(indianDate.getDate() + addDays);
  }
  indianDate.setUTCHours(0, 0, 0, 0);
  // set to midnight in indian time
  indianDate.setHours(
    indianDate.getHours() - 5,
    indianDate.getMinutes() - 30,
    indianDate.getSeconds(),
    indianDate.getMilliseconds()
  );
  return indianDate.toISOString();
}

export interface BookingDB extends BookingForm {
  startDateTime: string;
  endDateTime: string;
  encodingVersion: number;
  createdDateTime: string;
  createdBy: Employee;
  updatedDateTime: string;
  updatedBy: Employee;
  confirmedDateTime?: string | undefined;
  confirmedBy?: Employee | undefined;
  clientViewId?: string | undefined;
}

export interface Refferal {
  type: "Google" | "Facebook" | "Instagram" | "Influencer";
  id?: string | undefined;
}

export interface Cost {
  costId?: number | undefined;
  name: string;
  amount: number;
  property?: Property | undefined;
  itemType?: "cost" | "tax";
}

export interface Payment {
  paymentId?: number | undefined;
  dateTime: string;
  paymentMethod: "Cash" | "Card" | "GPay" | "Bank transfert";
  amount: number;
  receivedBy?: Employee | undefined;
  details?: Record<string, string>;
}

export interface Event {
  eventId?: number | undefined;
  eventName: string;
  calendarIds?: { [key: string]: string } | undefined;
  notes: string;
  startDateTime: string;
  endDateTime: string;
  numberOfGuests: number;
  properties: Property[];
  valetService: boolean;
  djService: boolean;
  kitchenService: boolean;
  overNightStay: boolean;
  overNightGuests: number;
  markForDeletion: boolean;
  costs: Cost[];
  finalCost: number;
}

export interface CalendarCell {
  booking:BookingDB;
  startDateTime: string;
  endDateTime: string;
  color:string;
  propertyName:string;
  order:number
  
}
