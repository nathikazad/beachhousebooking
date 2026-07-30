"use client";

import React, { useState, ChangeEvent, useEffect, useRef } from "react";
import { Event, Property } from "@/utils/lib/bookingType";
import BaseInput from "./ui/BaseInput";
import DateTimePickerInput from "./DateTimePickerInput/DateTimePickerInput";
import Properties from "./Properties";
import ToggleButton from "./ui/ToggleButton";
import * as yup from "yup";
import moment from "moment-timezone";
import BaseModalComponent from "./ui/BaseModal";
import FinancialItemFields from "./FinancialItemFields";

const properties = Object.values(Property);

interface CreateEventFormProps {
  onAddEvent: (event: Event) => void;
  cancelAddEvent: () => void;
  deleteEvent: (event: Event) => void;
  status?: string;
  selectedEvent?: Event | null;
  className?: string;
}
interface formDataToValidate {
  name: string | undefined;
  startDateTime: string | undefined;
}

const CreateEventComponent: React.FC<CreateEventFormProps> = ({
  deleteEvent,
  onAddEvent,
  cancelAddEvent,
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
  const [edited, setEdited] = useState<boolean>(false);
  const [exitModal, setExitModal] = useState<boolean>(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });

    selectedEvent ? setEvent(selectedEvent) : null;
  }, []);
  useEffect(() => {
    // Only validate form if it has been submitted at least once
    if (isFormSubmitted) {
      validateForm();
    }
  }, [event.eventName]);
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, type, checked, value } = e.target as HTMLInputElement;

    if (
      ["djService", "kitchenService", "valetService", "overNightStay"].includes(
        name
      )
    ) {
      setEvent((prevEvent) => ({
        ...prevEvent,
        [name]: checked,
      }));
    } else {
      setEvent((prevEvent) => ({
        ...prevEvent,
        [name]: value,
      }));
    }
    setEdited(true);
  };
  // Cost params and methods
  const [openedDropDown, setOpenedDropDown] = useState<Boolean>(false);

  const handleCostsChange = (
    index: number,
    name: "name" | "amount" | "property",
    value: string
  ) => {
    const updatedCosts = [...event.costs];
    updatedCosts[index] = {
      ...updatedCosts[index],
      [name]: name === "amount" ? (value ? parseFloat(value) : 0) : value || undefined,
    };
    setEvent((prevEvent) => ({
      ...prevEvent,
      costs: updatedCosts,
      finalCost: updatedCosts.reduce((acc, cost) => acc + cost.amount, 0),
    }));
    setEdited(true);
  };

  const addCost = (name?: string) => {
    let newCosts = event.costs;
    newCosts.push({
      name: name || "",
      amount: 0,
      itemType: "cost",
      property:
        event.properties.length === 1 ? event.properties[0] : undefined,
    });
    setEvent((prevEvent) => ({
      ...prevEvent,
      costs: newCosts,
    }));
    setOpenedDropDown(false);
    setEdited(true);
  };

  const handleDateChange = (name: string, value: string | null) => {
    setEvent((prevEvent) => ({
      ...prevEvent,
      [name]: value,
    }));
    setEdited(true);
  };

  const removeEventCost = (costIndex: number) => {
    const updatedCosts = event.costs.filter((_, i) => i !== costIndex);
    setEvent((prevEvent) => ({
      ...prevEvent,
      costs: updatedCosts,
      finalCost: updatedCosts.reduce((acc, cost) => acc + cost.amount, 0),
    }));
    setEdited(true);
  };
  // Form validation
  const [formErrors, setFormErrors] = useState({} as formDataToValidate);
  const [isFormSubmitted, setIsFormSubmitted] = useState<boolean>(false);

  const validationSchema = yup.object().shape({
    name: yup
      .string()
      .required("Name is required")
      .min(2, "Name must be at least 2 characters"),
    startDateTime: yup
      .string()
      .required("Start date and time is required")
      .matches(
        /^\d{4}-[01]\d-[0-3]\d[T][0-2]\d:[0-5]\d:[0-5]\d.\d+Z$/,
        "Start date and time must be in ISO format"
      )

      .test(
        "is-before-end-date",
        "Start date and time must be before the end date and time",
        (value) => {
          if (typeof event.endDateTime === "undefined") {
            return true;
          }

          const endDate = moment(event.endDateTime);
          const startDate = moment(value);
          return startDate.isBefore(endDate);
        }
      ),
  });
  const validateForm = async () => {
    const formDataToValidate = {
      name: event.eventName,
      startDateTime: event.startDateTime,
    };

    try {
      await validationSchema.validate(formDataToValidate, {
        abortEarly: false,
      });
      setFormErrors({
        name: undefined,
        startDateTime: undefined,
      });
      return true;
    } catch (err: Error | any) {
      const validationErrors: any = {};
      err.inner.forEach((error: any) => {
        console.log("error message", error.message);
        validationErrors[error.path] = error.message;
      });
      setFormErrors(validationErrors);
      return false;
    }
  };
  const handleSubmit = async () => {
    setIsFormSubmitted(true);
    const isValid = await validateForm();
    if (isValid) {
      onAddEvent(event);
      cancelAddEvent();
    }
    setExitModal(false);
  };
  //Start and end date fetchAvailabilities
  const startDateRef = useRef<any>(null);
  const endDateRef = useRef<any>(null);

  useEffect(() => {
    let startDate = event.startDateTime ? new Date(event.startDateTime) : null;
    let endDate = event.endDateTime ? new Date(event.endDateTime) : null;
    let endIsAfterStart = moment(endDate).isAfter(startDate);

    if (startDate && !endIsAfterStart) {
      let StartPlusOne = new Date();
      StartPlusOne.setDate(startDate.getDate() + 1);
      handleDateChange("endDateTime", null);
      setTimeout(() => {
        handleDateChange("endDateTime", StartPlusOne.toISOString());
        endDateRef.current.setDate(StartPlusOne);
      }, 500);
    }
  }, [event.startDateTime]);
  // ***********************************************************************************////////////////////***********************************************************************************
  // ***********************************************************************************////////////////////***********************************************************************************
  // *************************************************************************////////////Html template///////********************************************************************************
  // ***********************************************************************************////////////////////***********************************************************************************
  // ***********************************************************************************////////////////////***********************************************************************************

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Exit modal */}
      <BaseModalComponent
        openModal={!!exitModal}
        message={
          "You have unsaved changes. Are you sure you want to leave this page without saving?"
        }
        onClose={() => setExitModal(false)}
        okText="Save"
        noText="Don't save"
        onOk={() => {
          handleSubmit();
        }}
        onNo={() => {
          cancelAddEvent();
          setExitModal(false);
        }}
      />

      <div className="flex items-center h-[72px] sticky z-50 bg-white top-0">
        <span
          className=" material-symbols-outlined cursor-pointer hover:text-selectedButton"
          onClick={() => {
            if (edited) setExitModal(true);
            else {
              cancelAddEvent();
              setExitModal(false);
            }
          }}
        >
          arrow_back
        </span>
        <h1 className="text-lg font-bold leading-6 w-full text-center ">
          {selectedEvent?.eventId == undefined
            ? "Create Event"
            : selectedEvent.eventName}
        </h1>
      </div>
      {/* name and number */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <BaseInput
            type="text"
            name="eventName"
            value={event.eventName}
            onChange={handleChange}
            className="flex-1"
            placeholder="Event Name"
          />
          {formErrors.name && (
            <div role="alert" className="text-red-500  p-1 mt-1">
              <span>Name is invalid</span>
            </div>
          )}
        </div>
        <BaseInput
          preIcon="group"
          type="number"
          name="numberOfGuests"
          value={event.numberOfGuests}
          onChange={handleChange}
          className="w-28"
        />
      </div>
      <Properties
        properties={event.properties ?? []}
        setEventState={setEvent}
      />

      {/* Start and End  Date */}
      <div className="flex gap-x-2 w-full">
        <div className="w-1/2">
          <DateTimePickerInput
            label={"Start Date"}
            name="startDateTime"
            value={event.startDateTime}
            onChange={handleDateChange}
            maxDate={
              event.endDateTime ? new Date(event.endDateTime) : undefined
            }
            ref={startDateRef}
            properties={event.properties.toString()}
            checkAvailability="start"
          />
          {formErrors.startDateTime && (
            <div role="alert" className="text-red-500 p-1 mt-1">
              <span>Dates are invalid</span>
            </div>
          )}
        </div>
        <div className="w-1/2">
          <DateTimePickerInput
            label={"End Date"}
            name="endDateTime"
            value={event.endDateTime}
            onChange={handleDateChange}
            minDate={
              event.startDateTime ? new Date(event.startDateTime) : undefined
            }
            ref={endDateRef}
            properties={event.properties.toString()}
            checkAvailability="end"
          />
        </div>
      </div>
      {/* Notes input */}
      <div>
        <label>
          <textarea
            name="notes"
            value={event.notes}
            onChange={handleChange}
            placeholder="Notes"
            className={`textarea w-full text-base h-28 font-normal leading-normal bg-inputBoxbg rounded-xl placeholder:text-placeHolderText placeholder:text-base placeholder:leading-normal placeholder:font-normal`}
          />
        </label>
      </div>

      {/* Toggle buttons group */}
      <p className="text-base font-bold leading-normal my-4">
        Additional services
      </p>
      <div className="flex gap-4 flex-wrap items-center">
        <ToggleButton
          name="djService"
          checked={event.djService}
          onChange={handleChange}
          label="DJ"
        />
        <ToggleButton
          name="kitchenService"
          checked={event.kitchenService}
          onChange={handleChange}
          label="Kitchen"
        />
        <ToggleButton
          name="valetService"
          checked={event.valetService}
          onChange={handleChange}
          label="Valet"
        />
        <ToggleButton
          name="overNightStay"
          checked={event.overNightStay}
          onChange={handleChange}
          label="Overnight"
        />
        {event.overNightStay && (
          <BaseInput
            type="number"
            name="overNightGuests"
            value={event.overNightGuests}
            onChange={handleChange}
            preIcon="group"
            className="w-24 h-10 pr-2"
          />
        )}
      </div>
      {/* Costs part */}
      <div className="flex flex-col gap-4">
        <p className="text-base font-bold leading-normal my-4">Costs</p>
        <div className="cost-list flex flex-col gap-4">
          {event.costs.map((cost, index) => (
            <FinancialItemFields
              key={`cost-${index}`}
              cost={cost}
              properties={event.properties}
              onChange={(name, value) =>
                handleCostsChange(index, name, value)
              }
              onDelete={() => removeEventCost(index)}
            />
          ))}
        </div>
        <div className="flex items-center justify-end relative">
          <button
            onClick={() => setOpenedDropDown(!openedDropDown)}
            type="button"
            className="bg-typo_light-100 text-center rounded-xl py-2 px-6 title w-20"
          >
            +
          </button>
          <div
            className={`${openedDropDown ? "flex " : "hidden "}bg-white rounded-xl shadow-lg absolute top-12  flex-col z-50 w-36`}
          >
            <label
              className="p-4 rounded-t-xl hover:bg-typo_light-100 "
              onClick={() => addCost("Rent")}
            >
              Rent
            </label>
            <label
              className="p-4 hover:bg-typo_light-100 "
              onClick={() => addCost("Eb")}
            >
              EB
            </label>
            <label
              className="p-4 rounded-b-xl hover:bg-typo_light-100 "
              onClick={() => addCost("Beach set up")}
            >
              Beach set up
            </label>
            <label
              className="p-4 rounded-b-xl hover:bg-typo_light-100 "
              onClick={() => addCost("Cleaning")}
            >
              Cleaning
            </label>
            <label
              className="p-4 rounded-b-xl hover:bg-typo_light-100 "
              onClick={() => addCost("Kitchen")}
            >
              Kitchen
            </label>
            <label
              className="p-4 rounded-b-xl hover:bg-typo_light-100 "
              onClick={() => addCost()}
            >
              Other
            </label>
          </div>
        </div>
        <h3 className="title w-full text-right">
          Total :{" "}
          {event.finalCost
            ? `₹ ${event.finalCost.toLocaleString("en-IN")}`
            : "₹ 0"}{" "}
        </h3>
      </div>
      <div className="flex items-center justify-end gap-4 flex-wrap">
        <button
          type="button"
          className="border-2 border-typo_dark-100 rounded-xl h-12 px-6 text-typo_dark-100 w-full title"
          onClick={() => cancelAddEvent()}
        >
          Cancel
        </button>
        {event.eventId && (
          <button
            type="button"
            className="border-2 border-error rounded-xl h-12 px-6 text-error w-full title"
            onClick={() => deleteEvent(event)}
          >
            Delete
          </button>
        )}
        <button
          type="button"
          className="border-2 rounded-xl h-12 px-6 text-white bg-selectedButton w-full title"
          onClick={() => handleSubmit()}
        >
          {selectedEvent?.eventId ? "Update" : "Create"}
        </button>
      </div>
    </div>
  );
};

export default CreateEventComponent;
