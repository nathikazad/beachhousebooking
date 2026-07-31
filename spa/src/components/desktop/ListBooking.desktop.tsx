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
import { useRouter } from "next/router";
import { supabase } from "@/utils/supabase/client";
import SearchInput from "../ui/SearchInput";
import BookingFilterDesktop, { Filter } from "./BookingFilter.desktop";
import LoadingButton from "../ui/LoadingButton";
import { bookingSummaryFromRow } from "@/utils/lib/financials";
import { useSearchParams } from "next/navigation";
import eventEmitter from "@/utils/eventEmitter";
import {
  bookingListCacheKey,
  readBookingListCache,
  writeBookingListCache,
} from "@/utils/lib/bookingListCache";
import {
  bookingListCurrentDateBoundary,
  shouldCenterBookingListOnCurrentDate,
} from "@/utils/lib/bookingListDateWindow";
import ListViewToggle from "../ListViewToggle";
import BookingListTable from "../BookingListTable";
import { useListViewPreference } from "@/utils/useListViewPreference";
import {
  bookingListDateBounds,
  bookingListDateFilterLabel,
  clearBookingListDateFilter,
  isBoundedBookingList,
} from "@/utils/lib/bookingListFilters";

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
  className?: string;
}
let numOfBookingsForward = 7;
let numOfBookingsBackward = 0;
export default function ListBooking({ className }: ListBookingProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useListViewPreference("bookings");
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
    dateMode: null,
    dateFrom: null,
    dateTo: null,
    dateMonth: null,
    dateYear: null,
    properties: null,
    starred: null,
    paymentPending: null,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingForward, setLoadingForward] = useState<boolean>(false);
  const [loadingBackward, setLoadingBackward] = useState<boolean>(false);
  const forwardLoaderRef = useRef<HTMLDivElement | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true); // Indicates if more items can be loaded
  const bounded =
    !state.searchText && isBoundedBookingList(filterState, "checkIn");
  useEffect(() => {
    // Subscribe to the layout button click event
    eventEmitter.on("filterBtnClicked", toggleFilterDisplay);
    eventEmitter.on("searchTextChanged", handleChangeSearch);

    // Cleanup subscription on unmount
    return () => {
      eventEmitter.off("filterBtnClicked", toggleFilterDisplay);
      eventEmitter.off("searchTextChanged", handleChangeSearch);
    };
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !loadingForward &&
          hasMore &&
          !bounded
        ) {
          numOfBookingsForward = numOfBookingsForward + 7;
          setLoadingForward(true);
          fetchData(filterState, state.searchText || undefined);
        }
      },
      { rootMargin: "200px" }
    );

    if (forwardLoaderRef.current) {
      observer.observe(forwardLoaderRef.current);
    }

    return () => {
      if (forwardLoaderRef.current) {
        observer.unobserve(forwardLoaderRef.current);
      }
    };
  }, [bounded, filterState, hasMore, loadingForward, state.searchText]);
  async function fetchData(filters: Filter, searchText?: string) {
    const dateBounds = searchText
      ? null
      : bookingListDateBounds(filters, "checkIn");
    const cacheKey = bookingListCacheKey("bookings", {
      filters,
      searchText: searchText ?? "",
      numOfBookingsBackward,
      numOfBookingsForward,
    });
    const cachedBookings = readBookingListCache(cacheKey);
    if (cachedBookings) {
      setState((prevState) => ({
        ...prevState,
        dbBookings: cachedBookings,
        organizedByStartDate: organizedByStartDate(cachedBookings),
      }));
      setHasMore(
        !dateBounds &&
          cachedBookings.length >=
            numOfBookingsBackward + numOfBookingsForward
      );
      setLoading(false);
      setLoadingBackward(false);
      setLoadingForward(false);
      setFilterModalOpened(false);
      setTimeout(() => {
        if (query.id) {
          document
            .getElementById(query.id.toString() + "-id")
            ?.scrollIntoView({ behavior: "smooth" });
        }
      }, 0);
      return;
    }

    const requestId = new Date().getTime();
    latestRequestRef.current = requestId;
    setLoading(true);
    setLoadingForward(true);
    setLoadingBackward(true);
    setHasMore(false);
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
    } else {
      const centerOnCurrentDate =
        shouldCenterBookingListOnCurrentDate(filters);
      if (dateBounds) {
        oldBookingsData = oldBookingsData.eq(
          "check_in",
          convertDateToIndianDate({ date: new Date("2122-05-20") })
        );
        bookingsData = bookingsData
          .gte("check_in", dateBounds.start)
          .lt("check_in", dateBounds.end);
      } else {
        const boundary = bookingListCurrentDateBoundary();
        bookingsData = bookingsData.gte("check_in", boundary);
        oldBookingsData = oldBookingsData.lt("check_in", boundary);
      }
      if (filters.properties) {
        bookingsData = bookingsData.contains(
          "properties",
          convertPropertiesForDb(filters.properties)
        );
        if (centerOnCurrentDate) {
          oldBookingsData = oldBookingsData.contains(
            "properties",
            convertPropertiesForDb(filters.properties)
          );
        }
      }
      if (filters.starred) {
        bookingsData = bookingsData.eq("starred", filters.starred);
        if (centerOnCurrentDate) {
          oldBookingsData = oldBookingsData.eq("starred", filters.starred);
        }
      }
      if (filters.paymentPending) {
        bookingsData = bookingsData.gt("outstanding", 0);
        if (centerOnCurrentDate) {
          oldBookingsData = oldBookingsData.gt("outstanding", 0);
        }
      }
    }

    let bookingsDataBackward = oldBookingsData
      .eq("status", "confirmed")
      .order("check_in", { ascending: false })
      .range(0, numOfBookingsBackward);
    let bookingsDataForward = bookingsData
      .eq("status", "confirmed")
      .order("check_in", { ascending: true });
    if (!dateBounds) {
      bookingsDataForward = bookingsDataForward.range(
        0,
        numOfBookingsForward
      );
    }
    console.log(
      requestId,
      " of ",
      filters,
      " request id :",
      latestRequestRef.current
    );

    try {
      let [backwardResults, forwardResults] = await Promise.all([
        bookingsDataBackward,
        bookingsDataForward,
      ]);

      // Check if this is the latest request
      if (latestRequestRef.current !== requestId) return;
      console.log(requestId, "Backward Results:", backwardResults.data);
      console.log(requestId, "Forward Results:", forwardResults.data);

      let bookings: BookingDB[] = [];
      for (const booking of backwardResults.data ?? []) {
        bookings.unshift(bookingSummaryFromRow(booking));
      }
      for (const booking of forwardResults.data ?? []) {
        bookings.push(bookingSummaryFromRow(booking));
      }
      writeBookingListCache(cacheKey, bookings);

      console.log("Combined Bookings:", bookings);

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
      setHasMore(
        !dateBounds &&
          (forwardResults.data?.length ?? 0) >= numOfBookingsForward + 1
      );
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
        dateMode: null,
        dateFrom: null,
        dateTo: null,
        dateMonth: null,
        dateYear: null,
        properties: null,
        starred: null,
        paymentPending: null,
      });
      return;
    }
    console.log("query changed: ", query);

    const {
      searchText,
      checkIn,
      dateMode,
      dateFrom,
      dateTo,
      dateMonth,
      dateYear,
      properties,
      starred,
      paymentPending,
    } = query;
    const queryFilters: Filter = {
      checkIn: checkIn ? checkIn.toString() : null,
      dateMode:
        dateMode === "range" || dateMode === "month" ? dateMode : null,
      dateFrom: dateFrom ? dateFrom.toString() : null,
      dateTo: dateTo ? dateTo.toString() : null,
      dateMonth: dateMonth ? Number(dateMonth) : null,
      dateYear: dateYear ? Number(dateYear) : null,
      properties: properties ? parseProperties(properties.toString()) : null,
      starred: !!starred,
      paymentPending: !!paymentPending || null,
    };
    if (searchText) {
      setState((prevState) => ({
        ...prevState,
        searchText: searchText ? searchText.toString() : null,
        filter: {
          ...queryFilters,
        },
      }));
      eventEmitter.emit("searchTextChangedFromChild", {
        target: {
          name: "searchText",
          value: searchText ? searchText.toString() : null,
        },
      });
    }
    setFilterState(queryFilters);
    fetchData(
      queryFilters,
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
  const toggleFilterDisplay = (e?: boolean) => {
    setFilterModalOpened(typeof e == "boolean" ? e : !filterModalOpened);
  };
  //Print return to link
  const redirectToBookingId = (bookingId?: number) => {
    let pageQuery = {};
    if (state.searchText) {
      pageQuery = { ...pageQuery, searchText: state.searchText };
    } else if (
      isBoundedBookingList(filterState, "checkIn") ||
      filterState.properties ||
      filterState.starred ||
      filterState.paymentPending
    ) {
      //empty oldBookingsData

      if (isBoundedBookingList(filterState, "checkIn")) {
        pageQuery = {
          ...pageQuery,
          dateMode: filterState.dateMode,
          dateFrom: filterState.dateFrom,
          dateTo: filterState.dateTo,
          dateMonth: filterState.dateMonth,
          dateYear: filterState.dateYear,
        };
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
  // **********************************************************************************************************************************************************************
  // *************************************************************************Html template********************************************************************************
  // **********************************************************************************************************************************************************************
  return (
    <div className={"w-full px-10 pb-4 " + className}>
      {/* Filters */}
      <BookingFilterDesktop
        isFiltersOpened={filterModalOpened}
        toggleFilterDisplay={toggleFilterDisplay}
        filtersFor="Bookings"
        filterState={filterState}
        setFilterState={setFilterState}
        loading={loading}
        applyFilters={() => refreshPageQueries()}
        ref={filterBlockRef}
      />
      {/* Show filters if exists */}
      <div className="flex gap-3 mt-4 flex-wrap">
        {bookingListDateFilterLabel(filterState) && (
          <div className="flex gap-4 items-center rounded-xl border-[1px] border-typo_dark-300 px-4 py-1">
            <label className="label_text ">
              {" "}
              {bookingListDateFilterLabel(filterState)}
            </label>
            <span
              className=" material-symbols-outlined cursor-pointer "
              onClick={() => {
                setFilterState((current) =>
                  clearBookingListDateFilter(current)
                );
                setTimeout(() => {
                  filterBlockRef.current.applyFilters();
                }, 200);
              }}
            >
              close
            </span>
          </div>
        )}
        {filterState.properties &&
          filterState.properties.map((p, index) => {
            return (
              <div
                key={index}
                className="flex gap-4 items-center rounded-xl border-[1px] border-typo_dark-300 px-4 py-1"
              >
                <label className="label_text "> {p}</label>
                <span
                  className=" material-symbols-outlined cursor-pointer "
                  onClick={() => {
                    const clearedProperties = filterState.properties
                      ? filterState.properties.filter((proprety) => {
                        return proprety !== p;
                      })
                      : [];
                    setFilterState((prevState) => ({
                      ...prevState,
                      properties: clearedProperties.length
                        ? [...clearedProperties]
                        : null,
                    }));
                    setTimeout(() => {
                      filterBlockRef.current.applyFilters();
                    }, 200);
                  }}
                >
                  close
                </span>
              </div>
            );
          })}
        {filterState.paymentPending && (
          <div className="flex gap-4 items-center rounded-xl border-[1px] border-typo_dark-300 px-4 py-1">
            <label className="label_text "> Payment pending</label>
            <span
              className=" material-symbols-outlined cursor-pointer "
              onClick={() => {
                filterBlockRef.current.handleDateChange("paymentPending", null);
                setTimeout(() => {
                  filterBlockRef.current.applyFilters();
                }, 200);
              }}
            >
              close
            </span>
          </div>
        )}
        {filterState.starred && (
          <div className="flex gap-4 items-center rounded-xl border-[1px] border-typo_dark-300 px-4 py-1">
            <label className="label_text "> Starred</label>
            <span
              className=" material-symbols-outlined cursor-pointer "
              onClick={() => {
                filterBlockRef.current.handleDateChange("starred", null);
                setTimeout(() => {
                  filterBlockRef.current.applyFilters();
                }, 200);
              }}
            >
              close
            </span>
          </div>
        )}
        {(isBoundedBookingList(filterState, "checkIn") ||
          filterState.properties?.length ||
          filterState.paymentPending ||
          filterState.starred) && (
            <div
              onClick={() => {
                setFilterState({
                  checkIn: null,
                  dateMode: null,
                  dateFrom: null,
                  dateTo: null,
                  dateMonth: null,
                  dateYear: null,
                  properties: null,
                  starred: null,
                  paymentPending: null,
                });
                setTimeout(() => {
                  filterBlockRef.current.applyFilters();
                }, 200);
              }}
              className="flex gap-4 items-center rounded-xl border-[1px] border-typo_dark-300 px-4 py-1 cursor-pointer"
            >
              <label className="label_text "> Clear All</label>
              <span className=" material-symbols-outlined  ">
                filter_list_off
              </span>
            </div>
          )}
      </div>

      <div className="flex items-center justify-end gap-4">
        <ListViewToggle mode={viewMode} onChange={setViewMode} />
        {!bounded && !state.searchText && <LoadingButton
          className=" border-[1px] border-selectedButton text-selectedButton my-4  py-3 px-4 w-64 rounded-lg h-12"
          loading={loadingBackward}
          onClick={() => {
            numOfBookingsBackward = numOfBookingsBackward + 7;
            setLoadingBackward(true);
            fetchData(filterState, state.searchText || undefined);
          }}
        >
          Load older data
        </LoadingButton>}
        <button
          className="flex items-center gap-3 p-3 text-white bg-selectedButton rounded-lg text-sm h-12"
          onClick={() =>
            router.push(
              "/protected/booking/create?returnTo=/protected/booking/list"
            )
          }
        >
          <span className=" material-symbols-outlined cursor-pointer hover:text-selectedButton">
            add
          </span>
          <span>Create booking</span>
        </button>
      </div>
      {viewMode === "table" ? (
        <BookingListTable
          bookings={state.dbBookings}
          list="bookings"
          onSelect={redirectToBookingId}
        />
      ) : dates().map((date) => (
        <React.Fragment key={date}>
          <p className="pl-1 mt-6 text-neutral-900 text-lg font-semibold leading-6 ">
            {convertDate(date)}
          </p>
          <div className="flex flex-wrap gap-4 mt-3">
            {state.organizedByStartDate[date].map((booking, index) => (
              <div
                className="flex  justify-between w-[calc(25%-12px)] laptop-only:w-[calc(33%-12px)] max-w-72 bg-white p-4 shadow-[0_0_100px_0px_rgba(0,0,0,0.07)] rounded-xl cursor-pointer"
                key={booking.bookingId}
                id={`${booking.bookingId}-id`}
                onClick={() => redirectToBookingId(booking.bookingId)}
              >
                {/* Booking details */}
                <div className=" flex flex-col gap-0 w-full justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="flex items-center gap-1">
                        <span className="text-neutral-900 text-base  leading-6 font-semibold">
                          {booking.client.name}
                        </span>{" "}
                        {booking?.starred && (
                          <span className="material-symbols-filled text-xl">
                            star_rate
                          </span>
                        )}
                      </label>
                      <label className="text-neutral-900 text-sm font-normal leading-5">
                        {booking.status}
                      </label>
                    </div>
                    {/* Booking type */}
                    <div className="w-[69px] h-7 px-5 bg-gray-100 rounded-[5px] justify-center  inline-flex items-center">
                      <div className="w-11 label_text !font-semibold left-[20px] top-[6px] text-center text-sky-500 text-base  leading-normal">
                        {booking.bookingType}
                      </div>
                    </div>
                  </div>

                  <label className="text-selectedButton text-sm font-normal ">
                    {numOfDays(booking)} days, {booking.numberOfGuests} pax
                  </label>
                  {booking.properties?.length > 0 && (
                    <label className="text-slate-500 text-sm font-normal ">
                      {booking.properties.join(", ")}
                    </label>
                  )}
                  {booking.refferral && (
                    <label className="text-slate-500 text-sm font-normal ">
                      Referral: {booking.refferral}
                    </label>
                  )}
                  {
                    <div className="flex items-center gap-4 text-sm mt-3">
                      <label>
                        Rs{" "}
                        {(booking.outstanding ?? 0) == 0
                          ? (booking.paid ?? 0).toLocaleString("en-IN")
                          : (booking.outstanding ?? 0).toLocaleString("en-IN")}
                      </label>
                      {booking.status == "Confirmed" && (
                        <div
                          className={`${(booking.outstanding ?? 0) == 0 ? " bg-[#DEF8E0] text-[#09DC44]" : "bg-error/20 text-error"} px-[18px] rounded-[5px] py-1 font-semibold`}
                        >
                          {(booking.outstanding ?? 0) == 0 ? "Paid" : "Unpaid"}
                        </div>
                      )}
                    </div>
                  }
                </div>
              </div>
            ))}
          </div>
        </React.Fragment>
      ))}
      {!bounded && hasMore ? <LoadingButton
        className=" border-[1px] border-selectedButton text-selectedButton my-4 w-full py-2 px-4 rounded-xl"
        loading={loadingForward}
        onClick={() => {
          numOfBookingsForward = numOfBookingsForward + 7;
          setLoadingForward(true);
          fetchData(filterState, state.searchText || undefined);
        }}
      >
        Load More
      </LoadingButton> : null}
      {/* Filter modal */}

      {!bounded && hasMore ? <div className="flex items-center justify-center">
        <div
          ref={forwardLoaderRef}
          className={`h-1 w-full ${loadingForward ? "loading" : ""}`}
        ></div>
      </div> : null}
    </div>
  );
}
