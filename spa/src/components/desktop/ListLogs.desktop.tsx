"use client";
import {
  BookingDB,
  Property,
  convertDateToIndianDate,
  convertPropertiesForDb,
  printInIndianTime,
  numOfDays,
  organizedByCreatedDate,
  parseProperties,
  parseCreatedBy,
  parseStatus,
} from "@/utils/lib/bookingType";
import React, {
  useState,
  useEffect,
  ChangeEvent,
  FormEvent,
  useRef,
} from "react";
import { useRouter } from "next/router";
import format from "date-fns/format";
import SearchInput from "../ui/SearchInput";
import LoadingButton from "../ui/LoadingButton";
import DateTimePickerInput from "../DateTimePickerInput/DateTimePickerInput";
import { bookingSummaryFromRow } from "@/utils/lib/financials";
import Properties from "../Properties";
import BookingFilterDesktop, { Filter } from "./BookingFilter.desktop";
import { supabase } from "@/utils/supabase/client";
import eventEmitter from "@/utils/eventEmitter";

export interface ListLogsState {
  searchText: string | null;
  date: Date | null;
  dbBookings: BookingDB[];
}

let numOfBookings = 7;
interface ListLogsProps {
  className?: string;
}
export default function ListLogs({ className }: ListLogsProps) {
  const router = useRouter();
  const query = router.query;
  const latestRequestRef = useRef<number>(0);
  const filterBlockRef = useRef<any>(null);

  //Scroll smoothely to page section

  const [state, setState] = useState<ListLogsState>({
    searchText: null,
    date: null,
    dbBookings: [],
  });

  const [filterState, setFilterState] = useState<Filter>({
    status: null,
    createdTime: null,
    properties: null,
    starred: null,
    paymentPending: null,
    createdBy: null,
  });

  //Loading data
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingForward, setLoadingForward] = useState<boolean>(false);
  const forwardLoaderRef = useRef<HTMLDivElement | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true); // Indicates if more items can be loaded
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
        if (entries[0].isIntersecting && !loadingForward && hasMore) {
          numOfBookings = numOfBookings + 7;
          setLoadingForward(true);
          fetchData(filterState);
        }
      },
      { threshold: 1.0 }
    );

    if (forwardLoaderRef.current) {
      observer.observe(forwardLoaderRef.current);
    }

    return () => {
      if (forwardLoaderRef.current) {
        observer.unobserve(forwardLoaderRef.current);
      }
    };
  }, [loadingForward]);
  async function fetchData(filters: Filter, searchText?: string) {
    setLoading(true);
    setLoadingForward(true);
    setHasMore(false);

    const requestId = new Date().getTime();
    latestRequestRef.current = requestId;
    let bookingsData = supabase.from("bookings").select();

    if (searchText) {
      bookingsData = bookingsData.or(
        `client_name.ilike.%${searchText}%,client_phone_number.ilike.%${searchText}%`
      );
    } else if (
      filters.createdTime ||
      filters.status ||
      (filters.properties?.length ?? 0) > 0 ||
      filters.starred ||
      filters.paymentPending ||
      filters.createdBy
    ) {
      if (filters.createdTime) {
        bookingsData = bookingsData
          .gte(
            "created_at",
            convertDateToIndianDate({ date: new Date(filters.createdTime) })
          )
          .lte(
            "created_at",
            convertDateToIndianDate({
              date: new Date(filters.createdTime),
              addDays: 1,
            })
          );
      }
      if (filters.status) {
        bookingsData = bookingsData.eq(
          "status",
          filters.status.toLocaleLowerCase()
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
      if (filters.createdBy) {
        bookingsData = bookingsData.eq("email", filters.createdBy);
      }
    }

    bookingsData = bookingsData
      .order("created_at", { ascending: false })
      .range(0, numOfBookings);
    let { data: result } = await bookingsData;
    // Check if this is the latest request
    if (latestRequestRef.current !== requestId) return;

    let bookings: BookingDB[] = [];
    result?.forEach((booking: any) => {
      bookings.unshift(bookingSummaryFromRow(booking));
    });
    setState((prevState) => ({
      ...prevState,
      dbBookings: bookings,
    }));
    //Scroll smoothely to page section
    setTimeout(() => {
      if (query.id) {
        document
          .getElementById(query.id.toString() + "-id")
          ?.scrollIntoView({ behavior: "smooth" });
      }
    }, 500);
    if (bookings.length < numOfBookings) {
      setHasMore(false);
    } else {
      setHasMore(true);
    }
    setLoading(false);
    setLoadingForward(false);
    setFilterModalOpened(false);
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
        status: null,
        createdTime: null,
        properties: null,
        starred: null,
        paymentPending: null,
        createdBy: null,
      });
      return;
    }
    console.log("query changed: ", query);

    const {
      searchText,
      createdTime,
      status,
      createdBy,
      properties,
      starred,
      paymentPending,
    } = query;
    if (searchText) {
      setState((prevState) => ({
        ...prevState,
        searchText: searchText ? searchText.toString() : null,
        filter: {
          createdTime: createdTime || null,
          status: status || null,
          createdBy: createdBy || null,
          properties: properties || null,
          starred: starred || null,
          paymentPending: paymentPending || null,
        },
      }));
      eventEmitter.emit("searchTextChangedFromChild", {
        target: {
          name: "searchText",
          value: searchText ? searchText.toString() : null,
        },
      });
    }

    setFilterState({
      createdTime: createdTime ? createdTime.toString() : null,
      createdBy: createdBy ? parseCreatedBy(createdBy.toString()) : null,
      status: status ? parseStatus(status.toString()) : null,
      properties: properties ? parseProperties(properties?.toString()) : null,
      starred: !!starred,
      paymentPending: !!paymentPending || null,
    });
    fetchData(
      {
        createdTime: createdTime ? createdTime.toString() : null,
        createdBy: createdBy ? parseCreatedBy(createdBy.toString()) : null,
        status: status ? parseStatus(status.toString()) : null,
        properties: properties ? parseProperties(properties?.toString()) : null,
        starred: !!starred,
        paymentPending: !!paymentPending || null,
      },
      searchText ? searchText.toString() : undefined
    );
  }, [query]);

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
    return Object.keys(organizedByCreatedDate(state.dbBookings))
      .sort((a, b) => {
        if (a == "Invalid Date") return 1;
        if (b == "Invalid Date") return -1;
        return new Date(a).getTime() - new Date(b).getTime();
      })
      .reverse();
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

  const convertTimeToDateTime = (time: string) => {
    // 2024-06-28T18:30:00.000Z to Jun 28, 24
    const date = new Date(time);
    return (
      date.toDateString().slice(4, 10) +
      ", " +
      date.toDateString().slice(11, 15)
    );
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
        query: { returnTo: "/protected/logs", ...pageQuery },
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
        filtersFor="Logs"
        filterState={filterState}
        setFilterState={setFilterState}
        loading={loading}
        applyFilters={() => refreshPageQueries()}
        ref={filterBlockRef}
      />
      {/* Show filters if exists */}
      <div className="flex gap-3 mt-4 flex-wrap">
        {filterState.checkIn && (
          <div className="flex gap-4 items-center rounded-xl border-[1px] border-typo_dark-300 px-4 py-1">
            <label className="label_text ">
              {" "}
              {format(new Date(filterState.checkIn), "iii LLL d")}
            </label>
            <span
              className=" material-symbols-outlined cursor-pointer "
              onClick={() => {
                filterBlockRef.current.handleDateChange("checkIn", null);
                setTimeout(() => {
                  filterBlockRef.current.applyFilters();
                }, 200);
              }}
            >
              close
            </span>
          </div>
        )}
        {filterState.createdTime && (
          <div className="flex gap-4 items-center rounded-xl border-[1px] border-typo_dark-300 px-4 py-1">
            <label className="label_text ">
              {" "}
              {format(new Date(filterState.createdTime), "iii LLL d")}
            </label>
            <span
              className=" material-symbols-outlined cursor-pointer "
              onClick={() => {
                filterBlockRef.current.handleDateChange("createdTime", null);
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
        {filterState.createdBy && (
          <div className="flex gap-4 items-center rounded-xl border-[1px] border-typo_dark-300 px-4 py-1">
            <label className="label_text ">
              {" "}
              Created By : {filterState.createdBy}
            </label>
            <span
              className=" material-symbols-outlined cursor-pointer "
              onClick={() => {
                filterBlockRef.current.handleDateChange("createdBy", null);
                setTimeout(() => {
                  filterBlockRef.current.applyFilters();
                }, 200);
              }}
            >
              close
            </span>
          </div>
        )}
        {filterState.status && (
          <div className="flex gap-4 items-center rounded-xl border-[1px] border-typo_dark-300 px-4 py-1">
            <label className="label_text "> {filterState.status}</label>
            <span
              className=" material-symbols-outlined cursor-pointer "
              onClick={() => {
                filterBlockRef.current.handleDateChange("status", null);
                setTimeout(() => {
                  filterBlockRef.current.applyFilters();
                }, 200);
              }}
            >
              close
            </span>
          </div>
        )}
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
        {(filterState.checkIn ||
          filterState.properties?.length ||
          filterState.paymentPending ||
          filterState.starred ||
          filterState.createdBy ||
          filterState.createdTime ||
          filterState.status) && (
            <div
              onClick={() => {
                setFilterState({
                  checkIn: null,
                  properties: null,
                  starred: null,
                  paymentPending: null,
                });
                setTimeout(() => {
                  filterBlockRef.current.applyFilters();
                }, 200);
              }}
              className="flex gap-4 items-center rounded-xl border-[1px] border-error px-4 py-1 cursor-pointer"
            >
              <label className="label_text !text-error"> Clear All</label>
              <span className=" material-symbols-outlined  text-error">
                filter_list_off
              </span>
            </div>
          )}
      </div>
      <div className="flex items-center justify-end gap-4">
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

      {dates().map((date) => (
        <React.Fragment key={date}>
          <p className="pl-1 mt-6 text-neutral-900 text-lg font-semibold leading-6 ">
            {convertDate(date)}
          </p>
          <div className="flex flex-wrap gap-4 mt-3">
            {organizedByCreatedDate(state.dbBookings)[date].map(
              (booking, index) => (
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
                    {
                      <label className="text-slate-500 text-sm font-normal ">
                        Referral: {booking.refferral || 'No referral'}
                      </label>
                    }
                    {
                      <div className="flex items-center gap-4 text-sm mt-3">
                        <label>
                          Rs{" "}
                          {(booking.outstanding ?? 0) == 0
                            ? (booking.paid ?? 0).toLocaleString("en-IN")
                            : (booking.outstanding ?? 0).toLocaleString(
                                "en-IN"
                              )}
                        </label>
                        {booking.status == "Confirmed" && (
                          <div
                            className={`${(booking.outstanding ?? 0) == 0 ? " bg-[#DEF8E0] text-[#09DC44]" : "bg-error/20 text-error"} px-[18px] rounded-[5px] py-1 font-semibold`}
                          >
                            {(booking.outstanding ?? 0) == 0
                              ? "Paid"
                              : "Unpaid"}
                          </div>
                        )}
                      </div>
                    }
                    {booking.updatedBy.name && (
                      <label className="text-slate-500 text-sm font-normal pt-3">
                        @{booking.createdBy.name}{" "}
                        {printInIndianTime(booking.createdDateTime, true)}
                      </label>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </React.Fragment>
      ))}
      <div className="flex items-center justify-center">
        <div
          ref={forwardLoaderRef}
          className={`${loadingForward ? "loading" : ""}`}
        ></div>
      </div>
    </div>
  );
}
