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
import SearchInput from "./ui/SearchInput";
import BookingFilter, { Filter } from "./BookingFilter";
import LoadingButton from "./ui/LoadingButton";
import { bookingSummaryFromRow } from "@/utils/lib/financials";
import { useSearchParams } from "next/navigation";
import {
  bookingListCacheKey,
  readBookingListCache,
  readPersistentBookingListCache,
  writeBookingListCache,
} from "@/utils/lib/bookingListCache";
import {
  bookingListCurrentDateBoundary,
  shouldCenterBookingListOnCurrentDate,
} from "@/utils/lib/bookingListDateWindow";
import ListViewToggle from "./ListViewToggle";
import BookingListTable from "./BookingListTable";
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
  const forwardLoaderRef = useRef<HTMLDivElement | null>(null);
  const [viewMode, setViewMode] = useListViewPreference("bookings");
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
  const [hasMore, setHasMore] = useState(true);
  const bounded =
    !state.searchText && isBoundedBookingList(filterState, "checkIn");

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
    const requestId = Date.now();
    latestRequestRef.current = requestId;
    let cachedBookings = readBookingListCache(cacheKey);
    if (!cachedBookings) {
      cachedBookings = await readPersistentBookingListCache(cacheKey);
      if (latestRequestRef.current !== requestId) return;
    }
    if (cachedBookings) {
      setState((prevState) => ({
        ...prevState,
        dbBookings: cachedBookings,
        organizedByStartDate: organizedByStartDate(cachedBookings),
      }));
      setLoading(false);
      setLoadingBackward(false);
      setLoadingForward(false);
      setHasMore(
        !dateBounds &&
          cachedBookings.length >=
            numOfBookingsBackward + numOfBookingsForward
      );
      setFilterModalOpened(false);
      setTimeout(() => {
        if (query.id) {
          document
            .getElementById(query.id.toString() + "-id")
            ?.scrollIntoView({ behavior: "smooth" });
        }
      }, 0);
    }

    setLoading(!cachedBookings);
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

    try {
      let [backwardResults, forwardResults] = await Promise.all([
        bookingsDataBackward,
        bookingsDataForward,
      ]);

      if (backwardResults.error) throw backwardResults.error;
      if (forwardResults.error) throw forwardResults.error;

      // Check if this is the latest request
      if (latestRequestRef.current !== requestId) return;

      let bookings: BookingDB[] = [];
      for (const booking of backwardResults.data ?? []) {
        bookings.unshift(bookingSummaryFromRow(booking));
      }
      for (const booking of forwardResults.data ?? []) {
        bookings.push(bookingSummaryFromRow(booking));
      }
      setHasMore(
        !dateBounds &&
          (forwardResults.data?.length ?? 0) >= numOfBookingsForward + 1
      );
      writeBookingListCache(cacheKey, bookings);

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
      setLoadingForward(false);
      setLoadingBackward(false);
    }
  }

  useEffect(() => {
    if (bounded || !hasMore || loadingForward) return;
    const loader = forwardLoaderRef.current;
    if (!loader) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || loadingForward) return;
        numOfBookingsForward += 7;
        setLoadingForward(true);
        fetchData(filterState, state.searchText || undefined);
      },
      { rootMargin: "200px" }
    );
    observer.observe(loader);
    return () => observer.disconnect();
  }, [bounded, filterState, hasMore, loadingForward, state.searchText]);

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
  const toggleFilterDisplay = () => {
    setFilterModalOpened(!filterModalOpened);
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
          bookingListDateFilterLabel(filterState) && <div className="flex gap-4 items-center rounded-xl border-[1px] border-typo_dark-300 px-4 py-1"><label className="label_text "> {bookingListDateFilterLabel(filterState)}</label>
            <span
              className=" material-symbols-outlined cursor-pointer "
              onClick={() => {
                setFilterState((current) =>
                  clearBookingListDateFilter(current)
                );
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
        {(isBoundedBookingList(filterState, "checkIn") || filterState.properties || filterState.paymentPending || filterState.starred) && <div onClick={() => {
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

      <ListViewToggle mode={viewMode} onChange={setViewMode} />
      {!bounded && !state.searchText && <LoadingButton
        className=" border-[1px] border-selectedButton text-selectedButton my-4 w-full py-2 px-4 rounded-xl"
        loading={loadingBackward}
        onClick={() => {
          numOfBookingsBackward = numOfBookingsBackward + 7;
          setLoadingBackward(true);
          fetchData(filterState, state.searchText || undefined);
        }}
      >
        Load older
      </LoadingButton>}
      {viewMode === "table" ? (
        <BookingListTable
          bookings={state.dbBookings}
          list="bookings"
          onSelect={redirectToBookingId}
        />
      ) : dates().map((date) => (
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
      {!bounded && hasMore && <LoadingButton
        className=" border-[1px] border-selectedButton text-selectedButton my-4 w-full py-2 px-4 rounded-xl"
        loading={loadingForward}
        onClick={() => {
          numOfBookingsForward = numOfBookingsForward + 7;
          setLoadingForward(true);
          fetchData(filterState, state.searchText || undefined);
        }}
      >
        Load More
      </LoadingButton>}
      {!bounded && hasMore ? (
        <div ref={forwardLoaderRef} className="h-1 w-full" />
      ) : null}
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
