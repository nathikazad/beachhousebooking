"use client";

import React, { useState, ChangeEvent, useEffect } from "react";
import { Event, Property } from "@/utils/lib/bookingType";
import format from "date-fns/format";

interface EditEventFormProps {
  cancelAddEvent: () => void;
  onEditEvent: () => void;
  status?: string;
  selectedEvent?: Event | null;
  className?: string;
}

const EditEventComponent: React.FC<EditEventFormProps> = ({
  cancelAddEvent,
  onEditEvent,
  status,
  selectedEvent,
  className,
}) => {
  const [event, setEvent] = useState<Event>({
    eventName: "",
    calendarIds: {},
    notes: "",
    startDateTime: "",
    endDateTime: "",
    numberOfGuests: 0,
    properties: [],
    valetService: false,
    djService: false,
    kitchenService: false,
    overNightStay: false,
    overNightGuests: 0,
    costs: [],
    finalCost: 0,
    markForDeletion: false,
  });
  useEffect(() => {
    console.log({ selectedEvent });

    selectedEvent ? setEvent(selectedEvent) : null;
  }, []);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center h-[72px] sticky z-50 bg-white top-0 ">
        <span
          className=" material-symbols-outlined cursor-pointer hover:text-selectedButton"
          onClick={cancelAddEvent}
        >
          arrow_back
        </span>
        <h1 className="text-lg font-bold leading-6 w-full text-center ">
          {selectedEvent?.eventId == undefined
            ? "Create Event"
            : selectedEvent.eventName}
        </h1>
      </div>
      {/* Name  */}
      <div className="w-full">
        <label className="title"> {event.eventName}</label>
      </div>

      {/* Dates  */}
      <div className="flex   w-full gap-4">
        <label className="label_text !font-semibold">Dates</label>
        <div className="flex  items-center gap-1">
          {event.startDateTime && (
            <label className="label_text ">
              {" "}
              {format(
                new Date(`${event.startDateTime || ""}`),
                "iii LLL d, hh:mmaa"
              )}
              {"  "}
            </label>
          )}
          {" - "}
          {event.endDateTime && (
            <label className="label_text ">
              {format(
                new Date(`${event.endDateTime || ""}`),
                "iii LLL d, hh:mmaa"
              )}
              {"  "}
            </label>
          )}
        </div>
      </div>
      {/* Numbers  */}
      <div className="flex  flex-wrap">
        <label className="label_text">
          <span className="!font-semibold">Number of Guests: </span>{" "}
          {event.numberOfGuests}
        </label>
      </div>
      {/* Notes  */}
      {event.notes && (
        <div className=" flex gap-4">
          <label className="label_text !font-semibold">Notes: </label>
          <label className="label_text ">{event.notes}</label>
        </div>
      )}
      {/* Properties  */}
      <div className=" flex gap-4 ">
        <label className="label_text !font-semibold">Properties: </label>
        <div className="flex flex-col gap-2 ">
          {event.properties &&
            event.properties.map((p, i) => (
              <label className="label_text" key={`prop-${i}`}>
                {p}
              </label>
            ))}
        </div>
      </div>

      {/* Additional services  */}
      <div className="flex-col flex gap-2">
        <label className="label_text !font-semibold">
          Additional services:{" "}
        </label>
        <div className="flex flex-col gap-2 pl-4">
          {event.djService && <label className="label_text">DJ</label>}
          {event.kitchenService && (
            <label className="label_text">Kitchen</label>
          )}
          {event.valetService && <label className="label_text">Valet</label>}
          {event.overNightStay && (
            <label className="label_text">
              Overnight Stay: {event.overNightGuests} guests
            </label>
          )}
        </div>
      </div>

      {/* Costs part */}
      <div className="flex flex-col  gap-2">
        <label className="label_text  !font-semibold ">Costs</label>
        <div className="cost-list flex flex-col gap-2">
          {event.costs.map((cost, index) => (
            <div
              className="flex items-center px-4 py-2 rounded-lg bg-typo_light-100 justify-between"
              key={`cost-${index}`}
            >
              <label className="label_text !font-medium">
                {cost.name} ({cost.property ?? "Unassigned"}):
              </label>
              <label className="label_text !font-medium">
                ₹{cost.amount.toLocaleString("en-IN")}
              </label>
            </div>
          ))}
        </div>
      </div>
      {/* Total cost */}
      <div>
        <h3 className="title w-full text-right flex items-center justify-between">
          <span>Total</span>
          <span>
            {event.finalCost
              ? `₹ ${event.finalCost.toLocaleString("en-IN")}`
              : "₹ 0"}
          </span>
        </h3>
      </div>
    </div>
  );
};

export default EditEventComponent;
