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
import { usePathname, useSearchParams } from "next/navigation";
import EventDetailsComponent from "./EventDetails";
import CreateEventComponent from "./CreateEventForm";

import Link from "next/link";
import { useRouter } from "next/router";
import {
  getBookingHistory,
  getLatestBookingHistory,
} from "@/utils/serverCommunicator";
import { calculateGstPercentage } from "@/utils/lib/gst";

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
  let query = router.query;
  delete query.returnTo;
  //delete query.id;

  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [formErrors, setFormErrors] = useState({} as formDataToValidate);
  const [isFormSubmitted, setIsFormSubmitted] = useState<boolean>(false);
  const [historyCount, setHistoryCount] = useState(1);
  const pathname = usePathname();
  useEffect(() => {
    if (bookingId) {
      getLatestBookingHistory({ bookingId }).then(
        ({ history, historyCount: loadedHistoryCount }) => {
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
          setHistoryCount(loadedHistoryCount);
          setIsSwitchOn(newData.bookingType === "Stay" ? false : true);
        }
      );
    }
  }, [bookingId]);

  async function moveFormState(direction: "next" | "previous") {
    if (direction === "next") {
      if (formState.currentIndex === formState.allData.length - 1) return;
      setFormState((prevState) => ({
        ...prevState,
        form: prevState.allData[prevState.currentIndex + 1],
        bookingDB: prevState.allData[prevState.currentIndex + 1],
        currentIndex: prevState.currentIndex + 1,
      }));
    } else {
      if (
        bookingId &&
        formState.allData.length === 1 &&
        historyCount > 1
      ) {
        const history = await getBookingHistory({ bookingId });
        const currentIndex = history.length - 2;
        const previousBooking = history[currentIndex];
        if (!previousBooking) return;

        setHistoryCount(history.length);
        setFormState((prevState) => ({
          ...prevState,
          form: previousBooking,
          bookingDB: previousBooking,
          allData: history,
          currentIndex,
        }));
        return;
      }
      if (formState.currentIndex === 0) return;
      setFormState((prevState) => ({
        ...prevState,
        form: prevState.allData[prevState.currentIndex - 1],
        bookingDB: prevState.allData[prevState.currentIndex - 1],
        currentIndex: prevState.currentIndex - 1,
      }));
    }
  }

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

  //Copy client link
  const [copied, setCopied] = useState<boolean>(false);
  const copyClientLink = () => {
    setCopied(true);
    let host = window.location.host;
    host = !host.includes("http") ? `http://${host}` : host;
    navigator.clipboard.writeText(
      `${host}/client?id=${formState.form.clientViewId}`
    );
    setTimeout(() => {
      setCopied(false);
    }, 200);
  };
  //********************** Event Params and methods **********************
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  //**********************End Events settings **********************

  const handlePageChange = (showPage: Page) => {
    setFormState((prevState) => ({
      ...prevState,
      pageToShow: showPage,
    }));
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

  return (
    <div className={`${className} w-full`}>
      <div className="mb-6">
        {formState.pageToShow === Page.BookingPage && (
          <div>
            <div className="flex items-center pt-2 justify-between sticky z-50 bg-white top-0 h-[72px]">
              <div className="flex items-center ">
                <button
                  type="button"
                  onClick={() => {

                    
                    if (returnTo) {
                      bookingId
                        ? router.push(
                            { pathname: `${returnTo}`, query: query },
                            undefined,
                            { shallow: true }
                          )
                        : router.push(`${returnTo}`);
                    } else {
                      router.push("/protected/booking/list");
                    }
                  }}
                >
                  <svg
                    width="18"
                    height="16"
                    viewBox="0 0 18 16"
                    fill="#fff"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      id="Vector - 0"
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M18 8C18 8.41421 17.6642 8.75 17.25 8.75H2.56031L8.03063 14.2194C8.32368 14.5124 8.32368 14.9876 8.03063 15.2806C7.73757 15.5737 7.26243 15.5737 6.96937 15.2806L0.219375 8.53063C0.0785422 8.38995 -0.000590086 8.19906 -0.000590086 8C-0.000590086 7.80094 0.0785422 7.61005 0.219375 7.46937L6.96937 0.719375C7.26243 0.426319 7.73757 0.426319 8.03063 0.719375C8.32368 1.01243 8.32368 1.48757 8.03063 1.78062L2.56031 7.25H17.25C17.6642 7.25 18 7.58579 18 8Z"
                      fill="#0D141C"
                    />
                  </svg>
                </button>
              </div>
              <h1 className="text-lg font-bold leading-6 w-full text-center">
                {bookingId ? formState.form.client.name : "Create Booking"}
              </h1>
              <Link
                href={
                  returnTo
                    ? `${pathname}/edit?returnTo=${returnTo}`
                    : `${pathname}/edit`
                }
                className="material-symbols-outlined text-2xl !no-underline !text-typo_dark-300"
              >
                edit
              </Link>
            </div>
            <div className="flex flex-col mt-6 gap-4">
              {/* Name  */}
              <div className="w-full mb-2 flex items-center justify-between">
                <label className="title"> {formState.form.client.name}</label>
                <label
                  className={`${copied ? "text-selectedButton " : ""}label_text cursor-pointer`}
                  title={copied ? "Link Copied" : "Copy client link"}
                  onClick={copyClientLink}
                >
                  {" "}
                  <span className="material-symbols-outlined text-2xl">
                    content_copy
                  </span>{" "}
                </label>
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
                <div className="flex  flex-col">
                  <label className="label_text">
                    <span className="!font-semibold">Number of Events: </span>
                  </label>
                  <label className="label_text flex items-center gap-2">
                    {" "}
                    <span className="material-symbols-filled text-lg text-[#BEBEBE]">
                      event
                    </span>
                    {formState.form.numberOfEvents}
                  </label>
                </div>
              )}

              {/* Numbers of Guests */}
              <div className="flex  flex-col">
                <label className="label_text">
                  <span className="!font-semibold">Number of Guests: </span>
                  <label className="label_text flex items-center gap-2">
                    {" "}
                    <span className="material-symbols-filled text-lg text-[#BEBEBE]">
                      group
                    </span>
                    {formState.form.numberOfGuests}
                  </label>
                </label>
              </div>
              {/* Notes  */}
              {formState.form.notes && (
                <div className="flex-col gap-2 flex">
                  <label className="label_text !font-semibold">Notes:</label>
                  <label className="label_text pl-4">
                    {" "}
                    {formState.form.notes}
                  </label>
                </div>
              )}
              {/* Properties  */}
              {formState.form.properties?.length > 0 && (
                <div className="flex-col gap-2 flex">
                  <label className="label_text">
                    <span className="!font-semibold">Properties: </span>
                    <label className="label_text flex items-center gap-2">
                      {" "}
                      <span className="material-symbols-filled text-lg text-[#BEBEBE]">
                        home
                      </span>
                      {formState.form.properties.join(", ")}
                    </label>
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
                                <label className="label_text p-0">{` ${event.eventName}  (${event.numberOfGuests}) (₹${event.finalCost.toLocaleString("en-IN")} )`}</label>
                                <label className="label_text p-0">{`${startTime} `}</label>
                                <label className="label_text p-0">{`${endTime} `}</label>
                                <label className="label_text p-0">{`${event.properties.toString()}`}</label>
                              </div>
                              <span className="material-symbols-outlined ">
                                chevron_right
                              </span>
                            </div>
                          )
                        );
                      })}

                      <label className="title w-full text-right !font-bold flex items-center justify-start">
                        <strong className=" w-1/2">Final cost:</strong>{" "}
                        <span className="flex-1">
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
                              className="flex items-center pl-4 justify-between"
                              key={`cost-${index}`}
                            >
                              <label className="label_text !font-medium">
                                {cost.name} ({cost.property ?? "Unassigned"}):{" "}
                              </label>
                              <label className="label_text">
                                ₹{cost.amount.toLocaleString("en-IN")}
                              </label>
                            </div>
                          ))}
                      </div>

                      <label className="title w-full text-right !font-bold flex items-center justify-start">
                        <strong className=" w-1/2">Total :</strong>
                        <span className="flex-1">
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
                      <label className="title w-full text-right !font-bold flex items-center justify-start">
                        <strong className=" w-1/2">GST :</strong>{" "}
                        <span className="flex-1">
                          {formState.form.tax
                            ? `(${calculateGstPercentage(
                                formState.form.totalCost,
                                formState.form.tax
                              )}%) ₹ ${formState.form.tax.toLocaleString("en-IN")}`
                            : "₹ 0"}
                        </span>{" "}
                      </label>
                      <label className="title w-full text-right !font-bold flex items-center justify-start">
                        <strong className=" w-1/2">Total after tax :</strong>{" "}
                        <span className="flex-1">
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
                    <div className="cost-list flex flex-col gap-2 pl-4">
                      {formState.form.payments.map((payment, index) => (
                        <div
                          className="flex items-center gap-2 justify-between"
                          key={index}
                        >
                          <label className="label_text !font-semibold w-1/2 text-right">
                            {format(
                              new Date(`${payment.dateTime || ""}`),
                              "LLL d, hh:mmaa"
                            )}
                            :{" "}
                          </label>
                          <label className="label_text !font-semibold justify-between flex w-1/4">
                            {" "}
                            {payment.paymentMethod}{" "}
                          </label>
                          <label className="label_text !font-semibold justify-between flex w-1/4">
                            {" "}
                            ₹{payment.amount.toLocaleString("en-IN")}{" "}
                          </label>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div className="flex flex-col gap-2 ">
                        <label className="title w-full text-right !font-bold flex items-center justify-start">
                          <strong className=" w-1/2">Paid:</strong>{" "}
                          <span className="flex-1">
                            ₹{formState.form.paid.toLocaleString("en-IN")}
                          </span>{" "}
                        </label>
                        <label className="title w-full text-right !font-bold flex items-center justify-start">
                          <strong className=" w-1/2">Outstanding:</strong>{" "}
                          <span className="flex-1">
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
                      <div className="flex flex-col gap-2 ">
                        <label className="label_text !font-semibold w-full text-right  flex items-center justify-start">
                          <strong className=" w-2/3">Original amount:</strong>{" "}
                          <span className="flex-1">
                            ₹
                            {formState.form?.securityDeposit?.originalSecurityAmount.toLocaleString(
                              "en-IN"
                            )}
                          </span>{" "}
                        </label>
                        <label className="label_text !font-semibold w-full text-right  flex items-center justify-start">
                          <strong className=" w-2/3">Payment method:</strong>{" "}
                          <span className="flex-1">
                            {formState.form?.securityDeposit?.paymentMethod}{" "}
                          </span>
                        </label>
                      </div>

                      {!!formState.form?.securityDeposit?.amountReturned && (
                        <div className="flex flex-col gap-2 ">
                          <label className="label_text !font-semibold w-full text-right  flex items-center justify-start">
                            <strong className=" w-2/3">Returned amount:</strong>{" "}
                            <span className="flex-1">
                              ₹
                              {formState.form?.securityDeposit?.amountReturned.toLocaleString(
                                "en-IN"
                              )}
                            </span>{" "}
                          </label>
                          <label className="label_text !font-semibold w-full text-right  flex items-center justify-start">
                            <strong className=" w-2/3">Returned date:</strong>{" "}
                            <span className="flex-1">
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
            </div>
          </div>
        )}
        {formState.pageToShow === Page.EventPage && (
          <EventDetailsComponent
            onEditEvent={() => handlePageChange(Page.EventEdit)}
            cancelAddEvent={() => handlePageChange(Page.BookingPage)}
            status={formState.form.status}
            selectedEvent={selectedEvent}
          />
        )}

        {/* Version History  */}
        {bookingId && formState.pageToShow === Page.BookingPage && (
          <div className="my-4">
            <div className="flex items-center justify-between ">
              {(formState.currentIndex != 0 ||
                historyCount > formState.allData.length) && (
                <button
                  className="text-selectedButton bg-transparent flex items-center justify-center"
                  onClick={() => moveFormState("previous")}
                  disabled={
                    formState.currentIndex === 0 &&
                    historyCount <= formState.allData.length
                  }
                  type="button"
                >
                  <span className="material-symbols-outlined cursor-pointer">
                    arrow_back
                  </span>
                </button>
              )}
              {formState.currentIndex == 0 &&
                historyCount <= formState.allData.length && <p></p>}
              <div className="small-text">
                {" "}
                <p>
                  Created by{" "}
                  <strong>{formState.bookingDB?.createdBy.name}</strong> on{" "}
                  <strong>
                    {printInIndianTime(formState.bookingDB?.createdDateTime)}
                  </strong>
                </p>
                <p>
                  Updated by{" "}
                  <strong>{formState.bookingDB?.updatedBy.name}</strong> on{" "}
                  <strong>
                    {printInIndianTime(formState.bookingDB?.updatedDateTime)}
                  </strong>{" "}
                </p>
              </div>
              {formState.currentIndex != formState.allData.length - 1 && (
                <button
                  className={`${formState.currentIndex !== formState.allData.length - 1 && "text-selectedButton"} bg-transparent flex items-center justify-center`}
                  onClick={() => moveFormState("next")}
                  disabled={
                    formState.currentIndex === formState.allData.length - 1
                  }
                  type="button"
                >
                  <span className="material-symbols-outlined cursor-pointer">
                    arrow_forward
                  </span>
                </button>
              )}
              {formState.currentIndex == formState.allData.length - 1 && (
                <p></p>
              )}
            </div>
          </div>
        )}
        {/* End Version History */}
      </div>
    </div>
  );
}
