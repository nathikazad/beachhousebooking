"use client";

import * as yup from "yup";
import moment from "moment-timezone";
import format from "date-fns/format";
import {
  BookingForm,
  Event,
  defaultForm,
  BookingDB,
  printInIndianTime,
} from "@/utils/lib/bookingType";
import React, { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import EventDetailsComponent from "../EventDetails";
import CreateEventComponent from "../CreateEventForm";
import EventDetailsComponentDesktop from "../desktop/EventDetails.desktop";

import Link from "next/link";
import { getLatestBookingHistory } from "@/utils/serverCommunicator";

enum Page {
  BookingPage,
  EventPage,
  EventEdit,
}

export interface CreateBookingState {
  form: BookingForm;
  bookingDB?: BookingDB | undefined;
  allData: BookingDB[];
  pageToShow: Page;
  currentIndex: number;
}

interface formDataToValidate {
  name: string | undefined;
  phone: string | undefined;
  startDateTime: string | undefined;
}

interface BookingDetailsProps {
  bookingId?: number | undefined;
  className?: string;
}

export default function BookingDetailsComponent({
  bookingId,
  className,
}: BookingDetailsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [formErrors, setFormErrors] = useState({} as formDataToValidate);
  const [isFormSubmitted, setIsFormSubmitted] = useState<boolean>(false);
  const pathname = usePathname();
  useEffect(() => {
    console.log("====================================");
    console.log("useEffect booking id", bookingId);
    console.log("====================================");
    if (bookingId) {
      getLatestBookingHistory({
        clientViewId: String(bookingId),
      }).then(({ history }) => {
          const currentIndex = history.length - 1;
          const newData = history[currentIndex];
          if (!newData) return;
          setFormState((prevState) => ({
            ...prevState,
            form: newData,
            bookingDB: newData,
            allData: history,
            currentIndex: currentIndex,
          }));
          setIsSwitchOn(newData.bookingType === "Stay" ? false : true);
        });
    }
  }, [bookingId]);

  const [formState, setFormState] = useState<CreateBookingState>({
    allData: [],
    currentIndex: 0,
    form: defaultForm(),
    pageToShow: Page.BookingPage,
  });
  const [EventStaySwitchValue, setIsSwitchOn] = useState<boolean>(
    formState.form.bookingType === "Stay" ? false : true
  );
  const [textareaHeight, setTextareaHeight] = useState<number>(120);

  const validateForm = async () => {
    const formDataToValidate = {
      name: formState.form.client.name,
      phone: formState.form.client.phone,
      startDateTime: formState.form.startDateTime,
    };

    try {
      await validationSchema.validate(formDataToValidate, {
        abortEarly: false,
      });
      setFormErrors({
        name: undefined,
        phone: undefined,
        startDateTime: undefined,
      });
      return true;
    } catch (err: Error | any) {
      console.log("err: in validateForm ");
      const validationErrors: any = {};
      err.inner.forEach((error: any) => {
        console.log("error message", error.message);
        validationErrors[error.path] = error.message;
      });
      setFormErrors(validationErrors);
      return false;
    }
  };

  useEffect(() => {
    // Only validate form if it has been submitted at least once
    if (isFormSubmitted) {
      validateForm();
    }
  }, [
    formState.form.client.name,
    formState.form.client.phone,
    formState.form.startDateTime,
    formState.form.endDateTime,
  ]);

  useEffect(() => {
    let numberOfNewlines = (formState.form.notes.match(/\n/g) || []).length + 1;
    const newHeight = Math.ceil(numberOfNewlines * 26); //formState.form.notes.length / 41) * 28 +
    setTextareaHeight(Math.max(120, newHeight));
  }, [formState.form.notes]);

  //********************** Event Params and methods **********************
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const handleAddEvent = (event: Event) => {
    setFormState((prevState) => {
      let events = [...prevState.form.events];
      if (event.eventId == null) {
        event.eventId = Math.floor(Math.random() * 1000000);
        events.push(event);
      } else {
        events = events.map((e) => (e.eventId === event.eventId ? event : e));
      }
      let totalCost = events.reduce((acc, event) => acc + event.finalCost, 0);
      return {
        ...prevState,
        form: {
          ...prevState.form,
          events: events,
          totalCost: totalCost,
          outstanding: totalCost - prevState.form.paid,
        },
      };
    });
  };
  const handleDeleteEvent = (event: Event) => {
    setFormState((prevState) => {
      let events = [...prevState.form.events];
      events = events.filter((e) => e.eventId !== event.eventId);
      let totalCost = events.reduce((acc, event) => acc + event.finalCost, 0);
      return {
        ...prevState,
        form: {
          ...prevState.form,
          events: events,
          totalCost: totalCost,
          outstanding: totalCost - prevState.form.paid,
        },
      };
    });
    handlePageChange(Page.BookingPage);
  };
  //**********************End Events settings **********************

  const handlePageChange = (showPage: Page) => {
    setFormState((prevState) => ({
      ...prevState,
      pageToShow: showPage,
    }));
    console.log(formState.form.events);
  };

  const phoneRegExp = /^\+?(?:[0-9]\s?){6,14}[0-9]$/;
  const validationSchema = yup.object().shape({
    name: yup
      .string()
      .required("Name is required")
      .min(2, "Name must be at least 2 characters"),
    phone: yup
      .string()
      .required("Phone number is required")
      .matches(phoneRegExp, "Phone number is invalid"),
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
          if (typeof formState.form.endDateTime === "undefined") {
            return true;
          }
          const endDate = moment(formState.form.endDateTime);
          const startDate = moment(value);
          return startDate.isBefore(endDate);
        }
      ),
  });
  // **********************************************************************************************************************************************************************
  // *************************************************************************Html template********************************************************************************
  // **********************************************************************************************************************************************************************

  return (
    <div className={`w-full ${className} px-10`}>
      <div className="mb-6 w-full">
        {formState.pageToShow === Page.BookingPage && (
          <div>
            <div className="flex flex-col mt-6 gap-4">
              {/* Name  */}
              <div className="w-full mb-2 flex items-center justify-between">
                <label className="title"> {formState.form.client.name}</label>
              </div>
              {/* Phone  */}
              <div className="w-full flex gap-3 items-center">
                <a
                  href={`https://api.whatsapp.com/send?phone=${formState.form.client.phone}`}
                  target="_blank"
                >
                  <svg
                    height="17"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 448 512"
                  >
                    <path
                      fill="#167F3C"
                      d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"
                    />
                  </svg>
                </a>
                <label className="label_text">
                  {formState.form.client.phone}
                </label>
              </div>
              {/* Dates  */}
              <div className="flex flex-col  w-full gap-2">
                <label className="label_text !font-semibold">Dates</label>
                <div className="flex gap-1  ">
                  <span className="material-symbols-outlined text-lg text-[#BEBEBE]">
                    calendar_month
                  </span>
                  {formState.form.startDateTime && (
                    <label className="label_text ">
                      {" "}
                      {format(
                        new Date(`${formState.form.startDateTime || ""}`),
                        "EEE LLL d, hh:mmaa"
                      )}{" "}
                      -{" "}
                    </label>
                  )}

                  {formState.form.endDateTime && (
                    <label className="label_text ">
                      {format(
                        new Date(`${formState.form.endDateTime || ""}`),
                        "EEE LLL d, hh:mmaa"
                      )}{" "}
                    </label>
                  )}
                </div>
              </div>
              {/* Type of booking */}
              <div className="flex  flex-col">
                <label className="label_text">
                  <span className="!font-semibold">Booking Type: </span>{" "}
                  {formState.form.bookingType}
                </label>
              </div>
              {/* Numbers of events */}
              {formState.form.bookingType === "Event" && (
                <div className="flex  gap-2">
                  <label className="label_text">
                    <span className="!font-semibold">Number of Events: </span>
                  </label>
                  <label className="label_text flex items-center gap-2">
                    {" "}
                    {formState.form.numberOfEvents}
                  </label>
                </div>
              )}

              {/* Numbers of Guests */}
              <div className="flex  gap-2">
                <span className="!font-semibold">Number of Guests: </span>
                <label className="label_text flex items-center gap-2">
                  {formState.form.numberOfGuests}
                </label>
              </div>
              {/* Notes  */}
              {formState.form.notes && (
                <div className="gap-2 flex">
                  <label className="label_text !font-semibold">Notes:</label>
                  <label className="label_text "> {formState.form.notes}</label>
                </div>
              )}
              {/* Properties  */}
              {formState.form.properties?.length > 0 && (
                <div className="gap-2 flex">
                  <span className="!font-semibold">Properties: </span>
                  <label className="label_text flex items-center gap-2">
                    {formState.form.properties.join(", ")}
                  </label>
                </div>
              )}
              {/* Status  */}
              <div className="flex-col gap-3">
                <label className="label_text !font-semibold">Status: </label>
                <label className="label_text">{formState.form.status}</label>
              </div>

              {/* Referral  */}
              <div className="flex-col gap-3">
                <label className="label_text !font-semibold">Referral: </label>
                <label className="label_text">
                  {formState.form.refferral == "Other"
                    ? formState.form.otherRefferal
                    : formState.form.refferral}
                </label>
              </div>

              {formState.form.status != "Inquiry" && (
                <div>
                  {/* Event option */}
                  {formState.form.bookingType == "Event" && (
                    <div className="flex flex-col gap-4">
                      <p className="text-base font-bold leading-normal ">
                        Events
                      </p>
                      {formState.form.events.map((event, index) => {
                        let startTime = !event.startDateTime
                          ? format(new Date(), "iii LLL d, hh:mmaa")
                          : format(
                              new Date(event.startDateTime),
                              "iii LLL d, hh:mmaa"
                            );
                        let endTime = !event.endDateTime
                          ? format(new Date(), "iii LLL d, hh:mmaa")
                          : format(
                              new Date(event.endDateTime),
                              "iii LLL d, hh:mmaa"
                            );

                        return (
                          !event.markForDeletion && (
                            <div
                              key={index}
                              className="flex items-center justify-between rounded-xl bg-typo_light-100 p-4 cursor-pointer "
                              onClick={() => {
                                setSelectedEvent(event);
                                handlePageChange(Page.EventPage);
                              }}
                            >
                              <div className="flex flex-col gap-2">
                                <label className="label_text p-0">{` ${event.eventName}  (${event.numberOfGuests}) (₹${event.finalCost.toLocaleString("en-IN")} ) ${startTime} - ${endTime} `}</label>
                                <label className="label_text p-0">{`${event.properties.toString()}`}</label>
                              </div>
                              <span className="material-symbols-outlined ">
                                chevron_right
                              </span>
                            </div>
                          )
                        );
                      })}

                      <label className="title w-full  !font-bold flex items-center justify-start">
                        <strong className=" w-1/2">Final cost</strong>{" "}
                        <span className="flex-1 text-right">
                          {" "}
                          ₹{formState.form.totalCost.toLocaleString("en-IN")}
                        </span>{" "}
                      </label>
                    </div>
                  )}
                  {/* Stay options */}
                  {formState.form.bookingType == "Stay" && (
                    <div className="flex flex-col gap-2">
                      <p className="text-base !font-semibold leading-normal">
                        Costs
                      </p>
                      <div className="cost-list flex flex-col gap-2">
                        {formState.form.costs &&
                          formState.form.costs
                            .filter((cost) => cost.itemType !== "tax")
                            .map((cost, index) => (
                            <div
                              className="flex items-center px-4 py-2 rounded-lg bg-typo_light-100 justify-between"
                              key={`cost-${index}`}
                            >
                              <label className="label_text !font-medium">
                                {cost.name} ({cost.property ?? "Unassigned"})
                              </label>
                              <label className="label_text">
                                ₹{cost.amount.toLocaleString("en-IN")}
                              </label>
                            </div>
                          ))}
                      </div>

                      <label className="title w-full  !font-bold flex items-center justify-start">
                        <strong className=" w-1/2">Total </strong>
                        <span className="flex-1 text-right">
                          {" "}
                          {formState.form.totalCost
                            ? `₹ ${formState.form.totalCost.toLocaleString("en-IN")}`
                            : formState.form.totalCost
                              ? `₹ ${formState.form.totalCost}`
                              : "₹ 0"}{" "}
                        </span>
                      </label>

                      <div />
                    </div>
                  )}
                  {/* Tax part */}

                  {!!formState.form.tax && (
                    <div className="flex flex-col gap-2 ">
                      <label className="title w-full  !font-bold flex items-center justify-start">
                        <strong className=" w-1/2">GST</strong>{" "}
                        <span className="flex-1 text-right">
                          {formState.form.tax
                            ? `₹ ${formState.form.tax.toLocaleString("en-IN")}`
                            : "₹ 0"}
                        </span>{" "}
                      </label>
                      <label className="title w-full  !font-bold flex items-center justify-start">
                        <strong className=" w-1/2">Total after tax </strong>{" "}
                        <span className="flex-1 text-right">
                          {formState.form.afterTaxTotal
                            ? `₹ ${formState.form.afterTaxTotal.toLocaleString("en-IN")}`
                            : "₹ 0"}{" "}
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}
              {/*Confirmed option */}
              {formState.form.status == "Confirmed" && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-4">
                    <p className="text-base font-bold leading-normal ">
                      Payments
                    </p>
                    <div className="cost-list flex flex-col gap-2 ">
                      {formState.form.payments.map((payment, index) => (
                        <div
                          className="flex items-center gap-2 bg-typo_light-100 py-2 px-4 rounded-lg"
                          key={index}
                        >
                          <label className="label_text !font-medium flex-1 text-center ">
                            {format(
                              new Date(`${payment.dateTime || ""}`),
                              "LLL d, hh:mmaa"
                            )}
                          </label>
                          <label className="label_text !font-medium justify-between flex-1 text-center">
                            {" "}
                            {payment.paymentMethod}{" "}
                          </label>
                          <label className="label_text !font-medium justify-between flex-1 text-center">
                            {" "}
                            ₹{payment.amount.toLocaleString("en-IN")}{" "}
                          </label>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div className="flex flex-col gap-2 ">
                        <label className="title w-full  !font-bold flex items-center justify-start">
                          <strong className=" w-1/2">Paid</strong>{" "}
                          <span className="flex-1 text-right">
                            ₹{formState.form.paid.toLocaleString("en-IN")}
                          </span>{" "}
                        </label>
                        <label className="title w-full  !font-bold flex items-center justify-start">
                          <strong className=" w-1/2">Outstanding</strong>{" "}
                          <span className="flex-1 text-right">
                            ₹
                            {formState.form.outstanding.toLocaleString("en-IN")}{" "}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                  {/* Security Deposit */}
                  {!!formState.form?.securityDeposit
                    ?.originalSecurityAmount && (
                    <div className="flex flex-col gap-4">
                      <p className="text-base font-bold leading-normal ">
                        Security deposit
                      </p>
                      <div className="flex  gap-4 items-center">
                        <label className="title !font-semibold w-full   flex items-center justify-start">
                          <strong className=" w-1/2">Original amount</strong>{" "}
                        </label>
                        <span className="flex-1 text-right label_text !font-semibold">
                          ₹
                          {formState.form?.securityDeposit?.originalSecurityAmount.toLocaleString(
                            "en-IN"
                          )}
                        </span>
                        <label className="label_text !font-semibold w-full  flex items-center justify-start">
                          <span className="flex-1 text-right">
                            {formState.form?.securityDeposit?.paymentMethod}{" "}
                          </span>
                        </label>
                      </div>

                      {!!formState.form?.securityDeposit?.amountReturned && (
                        <div className="flex items-center justify-between">
                          <label className="title !font-semibold w-full   flex items-center justify-start">
                            <strong className=" flex-1">Returned amount</strong>{" "}
                          </label>
                          <span className="flex-1 text-center label_text !font-semibold">
                            ₹
                            {formState.form?.securityDeposit?.amountReturned.toLocaleString(
                              "en-IN"
                            )}
                          </span>
                          <label className="label_text !font-semibold w-full   flex items-center justify-start">
                            <span className="flex-1 text-right">
                              {format(
                                new Date(
                                  `${formState.form?.securityDeposit?.dateReturned || ""}`
                                ),
                                "iii LLL d, hh:mmaa"
                              )}{" "}
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* Contact  */}
              <div className="gap-4 flex items-start justify-between bg-typo_light-100 pb-10 p-4 -m-10 ">
                {/* Phone  */}
                <div className="flex flex-col gap-2">
                  <label className="label_text !font-semibold">
                    Contact us
                  </label>

                  <div className="w-full flex gap-3 items-center">
                    <label className="label_text">+916383282186</label>
                    <a
                      href={`https://api.whatsapp.com/send?phone=+916383282186`}
                      target="_blank"
                    >
                      <svg
                        height="24"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 448 512"
                      >
                        <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
                      </svg>
                    </a>
                  </div>
                </div>
                {/* Bank  */}
                <div className="flex flex-col gap-2">
                  <label className="label_text !font-semibold">
                    Bank details
                  </label>

                  <div className="w-full flex gap-3 items-center">
                    <a
                      href="upi://pay?pa=6374473550@pz&pn=Bluehouse&mc=0000&tid=1<client view id>&tt=10&am=<outstanding>&cu=INR&url=https://bluehouseecr.com"
                      target="_blank"
                    >
                      <svg
                        className="main-header__logo-image w-16"
                        fill="#A1A1A1"
                        role="presentation"
                        viewBox="0 0 435.97 173.13"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M206.2,84.58v50.75H190.1V10h42.7a38.61,38.61,0,0,1,27.65,10.85A34.88,34.88,0,0,1,272,47.3a34.72,34.72,0,0,1-11.55,26.6q-11.2,10.68-27.65,10.67H206.2Zm0-59.15V69.18h27a21.28,21.28,0,0,0,15.93-6.48,21.36,21.36,0,0,0,0-30.63,21,21,0,0,0-15.93-6.65h-27Z"
                          fill="#5f6368"
                        />
                        <path
                          d="M309.1,46.78q17.85,0,28.18,9.54T347.6,82.48v52.85H332.2v-11.9h-.7q-10,14.7-26.6,14.7-14.17,0-23.71-8.4a26.82,26.82,0,0,1-9.54-21q0-13.31,10.06-21.17t26.86-7.88q14.34,0,23.62,5.25V81.25A18.33,18.33,0,0,0,325.54,67,22.8,22.8,0,0,0,310,61.13q-13.49,0-21.35,11.38l-14.18-8.93Q286.17,46.78,309.1,46.78Zm-20.83,62.3a12.86,12.86,0,0,0,5.34,10.5,19.64,19.64,0,0,0,12.51,4.2,25.67,25.67,0,0,0,18.11-7.52q8-7.53,8-17.67-7.53-6-21-6-9.81,0-16.36,4.73C290.46,100.52,288.27,104.41,288.27,109.08Z"
                          fill="#5f6368"
                        />
                        <path
                          d="M436,49.58,382.24,173.13H365.62l19.95-43.23L350.22,49.58h17.5l25.55,61.6h.35l24.85-61.6Z"
                          fill="#5f6368"
                        />
                        <path
                          d="M141.14,73.64A85.79,85.79,0,0,0,139.9,59H72V86.73h38.89a33.33,33.33,0,0,1-14.38,21.88v18h23.21C133.31,114.08,141.14,95.55,141.14,73.64Z"
                          fill="#4285f4"
                        />
                        <path
                          d="M72,144c19.43,0,35.79-6.38,47.72-17.38l-23.21-18C90.05,113,81.73,115.5,72,115.5c-18.78,0-34.72-12.66-40.42-29.72H7.67v18.55A72,72,0,0,0,72,144Z"
                          fill="#34a853"
                        />
                        <path
                          d="M31.58,85.78a43.14,43.14,0,0,1,0-27.56V39.67H7.67a72,72,0,0,0,0,64.66Z"
                          fill="#fbbc04"
                        />
                        <path
                          d="M72,28.5A39.09,39.09,0,0,1,99.62,39.3h0l20.55-20.55A69.18,69.18,0,0,0,72,0,72,72,0,0,0,7.67,39.67L31.58,58.22C37.28,41.16,53.22,28.5,72,28.5Z"
                          fill="#ea4335"
                        />
                      </svg>
                    </a>
                  </div>
                </div>
                {/* Caution  */}
                <div className="flex flex-col gap-2">
                  <label className="label_text !font-semibold">Caution</label>
                  <div className="flex items-center gap-3  text-orange-400 ">
                    <span className="material-symbols-outlined text-xl ">
                      warning
                    </span>
                    <p>No Refunds. No Cancellations. 50% Advance.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {formState.pageToShow === Page.EventPage && (
          <EventDetailsComponentDesktop
            onEditEvent={() => handlePageChange(Page.EventEdit)}
            cancelAddEvent={() => handlePageChange(Page.BookingPage)}
            status={formState.form.status}
            selectedEvent={selectedEvent}
          />
        )}
      </div>
    </div>
  );
}
