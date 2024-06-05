
export interface BookingForm {
    bookingId?: number | undefined
    client: {
        name: string
        email: string
        phone: string
    }
    bookingName: string
    bookingType: "Stay" | "Event"
    paymentMethod: string
    notes: string
    status: "Pending" | "Confirmed" | "Cancelled" | "Completed"
    followUpDate: string
    events: Event[]
    costs:  Cost[]
    finalCost: number
    payments: Payments[]
    refferral?: Refferal | undefined
}


export interface BookingDB extends BookingForm {
    encodingVersion: number
    createdDateTime: string
    createdBy: string
    updatedDateTime: string
    updatedBy: string
    confirmedDateTime?: string | undefined
    confirmedBy?: string | undefined
}

export interface Refferal {
    type: "Google" | "Facebook" | "Instagram" | "Influencer"
    id?: string | undefined
}

export interface Cost {
    name: string
    amount: number
}

export interface Payments {
    dateTime: string
    paymentMethod: string
    amount: number
    receivedBy?: string | undefined
}

export interface Event {
    eventName: string
    calendarId?: string | undefined
    notes: string
    startDateTime: string
    endDateTime: string
    numberOfGuests: number
    properties: string[]
    valetService: boolean
    djService: boolean
    kitchenService: boolean
    overNightStay: boolean
    overNightGuests: number
}