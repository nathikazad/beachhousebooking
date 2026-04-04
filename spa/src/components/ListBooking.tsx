"use client";

import {
  BookingDB,
  Property,
  convertDateToIndianDate,
  convertPropertiesForDb,
  createDateFromIndianDate,
  numOfDays,
  organizedByStartDate,
  parseProperties,
} from "@/utils/lib/bookingType";
import React, {
  useState,
  useEffect,
  ChangeEvent,
  FormEvent,
  useRef,
} from "react";
import format from "date-fns/format";
import { useRouter } from "next/router";
import { supabase } from "@/utils/supabase/client";
import SearchInput from "./ui/SearchInput";
import BookingFilter, { Filter } from "./BookingFilter";
import LoadingButton from "./ui/LoadingButton";
import { useSearchParams } from "next/navigation";

// interface BookingProps {
//   bookingsFromParent: BookingDB[];
// }

interface ListBookingsState {
  searchText: string | null;
  date: Date | null;
  dbBookings: BookingDB[];
  organizedByStartDate: { [key: string]: BookingDB[] };
}
interface ListBookingProps {
  className?: string
}
let numOfBookingsForward = 7;
let numOfBookingsBackward = 0;
export default function ListBooking({ className }: ListBookingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = router.query;
  const latestRequestRef = useRef<number>(0);
  const filterBlockRef = useRef<any>(null);
  const [state, setState] = useState<ListBookingsState>({
    searchText: null,
    date: null,
    dbBookings: [],
    organizedByStartDate: {},
  });

  const [filterState, setFilterState] = useState<Filter>({
    checkIn: null,
    properties: null,
    starred: null,
    paymentPending: null,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingForward, setLoadingForward] = useState<boolean>(false);
  const [loadingBackward, setLoadingBackward] = useState<boolean>(false);

  async function fetchData(filters: Filter, searchText?: string) {
    const requestId = new Date().getTime();
    latestRequestRef.current = requestId;
    setLoading(true);
    setLoadingForward(true);
    setLoadingBackward(true);
    let bookingsData = supabase.from("bookings").select();
    let oldBookingsData = supabase.from("bookings").select();

    if (searchText) {
      bookingsData = bookingsData.or(
        `client_name.ilike.%${searchText}%,client_phone_number.ilike.%${searchText}%`
      );
      //empty oldBookingsData
      oldBookingsData = oldBookingsData.eq(
        "check_in",
        convertDateToIndianDate({ date: new Date("2122-05-20") })
      );
    } else if (
      filters.checkIn ||
      filters.properties ||
      filters.starred ||
      filters.paymentPending
    ) {
      //empty oldBookingsData
      oldBookingsData = oldBookingsData.eq(
        "check_in",
        convertDateToIndianDate({ date: new Date("2122-05-20") })
      );
      if (filters.checkIn) {
        bookingsData = bookingsData
          .gte(
            "check_in",
            convertDateToIndianDate({ date: new Date(filters.checkIn) })
          )
          .lte(
            "check_in",
            convertDateToIndianDate({
              date: new Date(filters.checkIn),
              addDays: 1,
            })
          );
      }
      if (filters.properties) {
        bookingsData = bookingsData.contains(
          "properties",
          convertPropertiesForDb(filters.properties)
        );
      }
      if (filters.starred) {
        bookingsData = bookingsData.eq("starred", filters.starred);
      }
      if (filters.paymentPending) {
        bookingsData = bookingsData.gt("outstanding", 0);
      }
    } else {
      bookingsData = bookingsData.gte(
        "check_in",
        new Date(new Date().setDate(new Date().getDate() - 2)).toISOString()
      );
      oldBookingsData = oldBookingsData.lte(
        "check_in",
        new Date(new Date().setDate(new Date().getDate() - 2)).toISOString()
      );
    }

    let bookingsDataBackward = oldBookingsData
      .eq("status", "confirmed")
      .order("check_in", { ascending: false })
      .range(0, numOfBookingsBackward);
    let bookingsDataForward = bookingsData
      .eq("status", "confirmed")
      .order("check_in", { ascending: true })
      .range(0, numOfBookingsForward);

    try {
      let [backwardResults, forwardResults] = await Promise.all([
        bookingsDataBackward,
        bookingsDataForward,
      ]);

      // Check if this is the latest request
      if (latestRequestRef.current !== requestId) return;

      let bookings: BookingDB[] = [];
      for (const booking of backwardResults.data ?? []) {
        const lastIndex = booking.json.length - 1;
        const lastBooking = booking.json[lastIndex];
        bookings.unshift({
          ...lastBooking,
          bookingId: booking.id,
        });
      }
      for (const booking of forwardResults.data ?? []) {
        const lastIndex = booking.json.length - 1;
        const lastBooking = booking.json[lastIndex];
        bookings.push({
          ...lastBooking,
          bookingId: booking.id,
        });
      }

      setState((prevState) => ({
        ...prevState,
        dbBookings: bookings,
        organizedByStartDate: organizedByStartDate(bookings),
      }));

      setTimeout(() => {
        if (query.id) {
          document
            .getElementById(query.id.toString() + "-id")
            ?.scrollIntoView({ behavior: "smooth" });
        }
      }, 500);

      setLoading(false);
      setLoadingBackward(false);
      setLoadingForward(false);
      setFilterModalOpened(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  }

  //check if filterState is empty
  const checkEmptyFilterState = (): boolean => {
    // Use Object.values to get an array of values from the filterState object
    const values = Object.values(filterState);
    console.log(
      { checkEmptyFilterState: values },
      values.some((value) => !value)
    );

    // Check if there is at least one non-null and non-undefined value
    return values.some((value) => value);
  };
  //Refresh page queries
  const refreshPageQueries = () => {
    function removeNullProperties(filter: Filter): Filter {
      const newFilter: Partial<Filter> = {};

      (Object.keys(filter) as (keyof Filter)[]).forEach((key) => {
        const value = filter[key];
        if (value) {
          newFilter[key] = value as any; // Use type assertion to handle mixed types
        }
      });

      return newFilter as Filter;
    }

    const cleanedFilterState = removeNullProperties(filterState);

    router.push(
      {
        query: { ...cleanedFilterState },
      },
      undefined,
      { shallow: true }
    );
  };
  //Watch router query
  useEffect(() => {
    if (Object.entries(query).length == 0) {
      fetchData({
        checkIn: null,
        properties: null,
        starred: null,
        paymentPending: null,
      });
      return;
    }

    const { searchText, checkIn, properties, starred, paymentPending } = query;
    if (searchText) {
      setState((prevState) => ({
        ...prevState,
        searchText: searchText ? searchText.toString() : null,
        filter: {
          checkIn: checkIn || null,
          properties: properties || null,
          starred: starred || null,
          paymentPending: paymentPending || null,
        },
      }));
    }
    setFilterState({
      checkIn: checkIn ? checkIn.toString() : null,
      properties: properties ? parseProperties(properties?.toString()) : null,
      starred: !!starred,
      paymentPending: !!paymentPending || null,
    });
    fetchData(
      {
        checkIn: checkIn ? checkIn.toString() : null,
        properties: properties ? parseProperties(properties?.toString()) : null,
        starred: !!starred,
        paymentPending: !!paymentPending || null,
      },
      searchText ? searchText.toString() : undefined
    );
  }, [query]);

  // useEffect(() => {
  //   if (state.searchText == null) return;
  //   console.log("Search text has changed:", state);

  //   //fetchData(filterState);
  // }, [state.searchText]);

  const handleChangeSearch = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setState((prevState) => ({
      ...prevState,
      searchText: value.length > 0 ? value : "",
    }));
    let pageQuery: {
      searchText?: string;
    };
    pageQuery = { ...query, searchText: value };
    if (!value) {
      delete pageQuery.searchText;
    }

    router.push(
      {
        query: { ...pageQuery },
      },
      undefined,
      { shallow: true }
    );
  };

  const dates = (): string[] => {
    return Object.keys(state.organizedByStartDate).sort((a, b) => {
      if (a == "Invalid Date") return 1;
      if (b == "Invalid Date") return -1;
      return (
        createDateFromIndianDate(a).getTime() -
        createDateFromIndianDate(b).getTime()
      );
    });
  };

  const convertDate = (date: string) => {
    if (new Date(date).toDateString() === new Date().toDateString()) {
      return "Today";
    } else if (
      new Date(date).toDateString() ===
      new Date(new Date().setDate(new Date().getDate() - 1)).toDateString()
    ) {
      return "Yesterday";
    } else if (
      new Date(date).toDateString() ===
      new Date(new Date().setDate(new Date().getDate() + 1)).toDateString()
    ) {
      return "Tomorrow";
    } else {
      return date;
    }
  };
  //Filter modal
  const [filterModalOpened, setFilterModalOpened] = useState<boolean>(false);
  const toggleFilterDisplay = () => {
    setFilterModalOpened(!filterModalOpened);
  };
  //Print return to link
  const redirectToBookingId = (bookingId?: number) => {
    let pageQuery = {};
    if (state.searchText) {
      pageQuery = { ...pageQuery, searchText: state.searchText };
    } else if (
      filterState.checkIn ||
      filterState.properties ||
      filterState.starred ||
      filterState.paymentPending
    ) {
      //empty oldBookingsData

      if (filterState.checkIn) {
        pageQuery = { ...pageQuery, checkIn: filterState.checkIn };
      }
      if (filterState.properties) {
        pageQuery = {
          ...pageQuery,
          properties: filterState.properties,
        };
      }
      if (filterState.starred) {
        pageQuery = { ...pageQuery, starred: filterState.starred };
      }
      if (filterState.paymentPending) {
        pageQuery = {
          ...pageQuery,
          paymentPending: filterState.paymentPending,
        };
      }
    } else {
      pageQuery = {};
    }
    router.push(
      {
        pathname: `/protected/booking/${bookingId}`,
        query: { returnTo: "/protected/booking/list", ...pageQuery },
      },
      undefined,
      { shallow: true }
    );
  };
  return (
    <div className={"w-full  " + className}>
      {/* Top Nav */}
      <div className="flex items-center h-[72px]">
        <h1 className="text-lg font-bold leading-6 w-full text-center ">
          Bookings
        </h1>

        <span
          className=" material-symbols-outlined cursor-pointer hover:text-selectedButton"
          onClick={() => router.push("/protected/booking/create?returnTo=/protected/booking/list")}
        >
          add_circle
        </span>
      </div>
      {/* Top Nav */}
      <SearchInput
        value={state.searchText || undefined}
        onChange={handleChangeSearch}
        onFilterClick={toggleFilterDisplay}
        filterIsOn={checkEmptyFilterState()}
      />
      {/* Show filters if exists */}
      <div className="flex gap-3 mt-4 flex-wrap">
        {
          filterState.checkIn && <div className="flex gap-4 items-center rounded-xl border-[1px] border-typo_dark-300 px-4 py-1"><label className="label_text "> {format(new Date(filterState.checkIn), "iii LLL d")}</label>
            <span
              className=" material-symbols-outlined cursor-pointer "
              onClick={() => {
                filterBlockRef.current.handleDateChange('checkIn', null);
                setTimeout(() => {
                  filterBlockRef.current.applyFilters()
                }, 200);

              }}
            >
              close
            </span></div>
        }
        {
          filterState.properties && filterState.properties.map((p, index) => {
            return <div key={index} className="flex gap-4 items-center rounded-xl border-[1px] border-typo_dark-300 px-4 py-1"><label className="label_text "> {p}</label>
              <span
                className=" material-symbols-outlined cursor-pointer "
                onClick={() => {
                  const clearedProperties = filterState.properties ? filterState.properties.filter(proprety => { return proprety !== p }) : []
                  setFilterState(prevState => ({
                    ...prevState,
                    properties:
                      clearedProperties.length ? [...clearedProperties] : null

                  }))
                  setTimeout(() => {
                    filterBlockRef.current.applyFilters()
                  }, 200);

                }}
              >
                close
              </span></div>
          })
        }
        {
          filterState.paymentPending && <div className="flex gap-4 items-center rounded-xl border-[1px] border-typo_dark-300 px-4 py-1"><label className="label_text "> Payment pending</label>
            <span
              className=" material-symbols-outlined cursor-pointer "
              onClick={() => {
                filterBlockRef.current.handleDateChange('paymentPending', null);
                setTimeout(() => {
                  filterBlockRef.current.applyFilters()
                }, 200);

              }}
            >
              close
            </span></div>
        }
        {
          filterState.starred && <div className="flex gap-4 items-center rounded-xl border-[1px] border-typo_dark-300 px-4 py-1"><label className="label_text "> Starred</label>
            <span
              className=" material-symbols-outlined cursor-pointer "
              onClick={() => {
                filterBlockRef.current.handleDateChange('starred', null);
                setTimeout(() => {
                  filterBlockRef.current.applyFilters()
                }, 200);

              }}
            >
              close
            </span></div>
        }
        {(filterState.checkIn || filterState.properties || filterState.paymentPending || filterState.starred) && <div onClick={() => {
          setFilterState({
            checkIn: null,
            properties: null,
            starred: null,
            paymentPending: null,
          })
          setTimeout(() => {
            filterBlockRef.current.applyFilters()
          }, 200);

        }} className="flex gap-4 items-center rounded-xl border-[1px] border-typo_dark-300 px-4 py-1 cursor-pointer"><label className="label_text "> Clear All</label>
          <span
            className=" material-symbols-outlined  "

          >
            filter_list_off
          </span></div>}
      </div>

      <LoadingButton
        className=" border-[1px] border-selectedButton text-selectedButton my-4 w-full py-2 px-4 rounded-xl"
        loading={loadingBackward}
        onClick={() => {
          numOfBookingsBackward = numOfBookingsBackward + 7;
          setLoadingBackward(true);
          fetchData(filterState);
        }}
      >
        Load More
      </LoadingButton>
      {dates().map((date) => (
        <React.Fragment key={date}>
          <p className="pl-1 mt-6 text-neutral-900 text-lg font-semibold leading-6">
            {convertDate(date)}
          </p>
          {state.organizedByStartDate[date].map((booking, index) => (
            <div
              className="flex mt-3 w-full justify-between"
              key={booking.bookingId}
              id={`${booking.bookingId}-id`}
              onClick={() => redirectToBookingId(booking.bookingId)}
            >
              {/* Booking details */}
              <div className="pl-3 flex flex-col gap-0">
                <label className="flex items-center gap-1">
                  <span className="text-neutral-900 text-base font-medium leading-6">
                    {booking.client.name}
                  </span>{" "}
                  <span className="text-slate-500 text-sm font-normal leading-5">
                    {booking.status}
                  </span>
                  {booking?.starred && (
                    <span className="material-symbols-filled text-2xl">
                      star_rate
                    </span>
                  )}
                </label>
                <label className="text-slate-500 text-sm font-normal ">
                  {numOfDays(booking)} days, {booking.numberOfGuests} pax
                </label>
                {booking.properties?.length > 0 && (
                  <label className="text-slate-500 text-sm font-normal ">
                    {booking.properties.join(", ")}
                  </label>
                )}
                {
                  <div className="flex items-center gap-4 text-sm">
                    <label>
                      Rs{" "}
                      {(booking.outstanding ?? 0) == 0
                        ? (booking.paid ?? 0).toLocaleString("en-IN")
                        : (booking.outstanding ?? 0).toLocaleString("en-IN")}
                    </label>
                    {booking.status == "Confirmed" && (
                      <div
                        className={`${(booking.outstanding ?? 0) == 0 ? " bg-green-500/30" : "bg-error/20"} px-3 rounded-xl`}
                      >
                        {(booking.outstanding ?? 0) == 0 ? "Paid" : "Unpaid"}
                      </div>
                    )}
                  </div>
                }
                {booking.refferral && (
                  <label className="text-slate-500 text-sm font-normal ">
                    Referral: {booking.refferral}
                  </label>
                )}
              </div>
              {/* Booking type */}
              <div className="w-[84px] flex items-center">
                <div className="w-[74px] h-8 px-5 bg-gray-100 rounded-[19px] justify-center items-center inline-flex items-center">
                  <div className="w-11 label_text !font-medium left-[20px] top-[6px] text-center text-sky-500 text-base font-medium leading-normal">
                    {booking.bookingType}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </React.Fragment>
      ))}
      <LoadingButton
        className=" border-[1px] border-selectedButton text-selectedButton my-4 w-full py-2 px-4 rounded-xl"
        loading={loadingForward}
        onClick={() => {
          numOfBookingsForward = numOfBookingsForward + 7;
          setLoadingForward(true);
          fetchData(filterState);
        }}
      >
        Load More
      </LoadingButton>
      {/* Filter modal */}

      <BookingFilter
        isFiltersOpened={filterModalOpened}
        toggleFilterDisplay={toggleFilterDisplay}
        filtersFor="Bookings"
        filterState={filterState}
        setFilterState={setFilterState}
        loading={loading}
        applyFilters={() => refreshPageQueries()}
        ref={filterBlockRef}
      />
    </div>
  );
}
