import React, { forwardRef, useImperativeHandle } from "react";
import Properties from "../Properties";
import LoadingButton from "../ui/LoadingButton";
import BookingDatePeriodFilter from "../BookingDatePeriodFilter";
import {
  Filter,
  hasInvalidBookingListDateFilter,
} from "@/utils/lib/bookingListFilters";

export type { Filter } from "@/utils/lib/bookingListFilters";

type BookingFilterProps = {
    isFiltersOpened: boolean;
    toggleFilterDisplay: () => void;
    applyFilters: () => void;
    filtersFor: "Logs" | "Bookings";
    filterState: Filter;
    setFilterState: React.Dispatch<React.SetStateAction<Filter>>;
    loading: boolean
};

const BookingFilter = forwardRef<any, BookingFilterProps>(({ filtersFor, filterState, setFilterState, applyFilters, loading, isFiltersOpened, toggleFilterDisplay }, ref) => {
    useImperativeHandle(ref, () => ({
        filterChange,
        handleDateChange,
        applyFilters
    }));
    const filterChange = ({ name, value }: { name: string, value: string | null | boolean }) => {
        setFilterState((prevfilterState: Filter) => ({
            ...prevfilterState,
            [name]: prevfilterState[name as keyof typeof prevfilterState] == value ? null : value
        }));
    }

    const handleDateChange = (name: string, value: string | null) => {
        console.log(name, value)
        setFilterState((prevfilterState: Filter) => ({
            ...prevfilterState,
            [name]: value
        }));
    };

    return (
      <div
        className={`transition-all  h-full w-full z-30 top-0 left-0 flex flex-col justify-end`}
      >
        {/* Filter part  */}
        <div className=" flex flex-col py-4 relative gap-4 z-20 ">
          {/* filters */}
          <div className="flex items-center justify-between">
            <label className="title ">Filters</label>{" "}
            <span
              className=" material-symbols-outlined cursor-pointer"
              onClick={toggleFilterDisplay}
            >
              {isFiltersOpened ? "keyboard_arrow_up" : "keyboard_arrow_down"}
            </span>
          </div>
          <div
            className={`${isFiltersOpened ? "flex flex-col gap-4" : "hidden"}`}
          >
            <BookingDatePeriodFilter
              filterState={filterState}
              setFilterState={setFilterState}
            />
            {/* Referrals */}

            <Properties
              properties={filterState.properties ?? []}
              setFilterState={setFilterState}
            />
            {/* Booking Types */}
            {filtersFor == "Logs" && (
              <React.Fragment>
                <label className="text-base !font-medium">Booking Types</label>
                <div className="flex items-center flex-wrap gap-4">
                  <div
                    onClick={() =>
                      filterChange({ name: "status", value: "Inquiry" })
                    }
                    className={`badge badge-lg text-center w-32 ${
                      filterState.status == "Inquiry"
                        ? "!text-white bg-selectedButton laptop-gradient"
                        : "text-black bg-inputBoxbg"
                    } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}
                  >
                    Inquiries
                  </div>
                  <div
                    onClick={() =>
                      filterChange({ name: "status", value: "Quotation" })
                    }
                    className={`badge badge-lg text-center w-32 ${
                      filterState.status == "Quotation"
                        ? "!text-white bg-selectedButton laptop-gradient"
                        : "text-black bg-inputBoxbg"
                    } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}
                  >
                    Quotations
                  </div>
                  <div
                    onClick={() =>
                      filterChange({ name: "status", value: "Confirmed" })
                    }
                    className={`badge badge-lg text-center w-32 ${
                      filterState.status == "Confirmed"
                        ? "!text-white bg-selectedButton laptop-gradient"
                        : "text-black bg-inputBoxbg"
                    } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}
                  >
                    Confirmed
                  </div>
                </div>
              </React.Fragment>
            )}

            {/* Other */}
            <label className="text-base !font-medium">Other</label>
            <div className="flex items-center flex-wrap gap-4">
              <div
                onClick={() =>
                  filterChange({
                    name: "paymentPending",
                    value: !filterState.paymentPending,
                  })
                }
                className={`badge badge-lg text-center w-44 ${
                  filterState.paymentPending
                    ? "!text-white bg-selectedButton laptop-gradient"
                    : "text-black bg-inputBoxbg"
                } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}
              >
                Payment Pending
              </div>
              <div
                onClick={() =>
                  filterChange({ name: "starred", value: !filterState.starred })
                }
                className={`badge badge-lg text-center w-32 ${
                  filterState.starred
                    ? "!text-white bg-selectedButton laptop-gradient"
                    : "text-black bg-inputBoxbg"
                } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}
              >
                Starred
              </div>
            </div>
            {/* Employees */}
            {filtersFor == "Logs" && (
              <React.Fragment>
                <label className="text-base !font-medium">Employees</label>
                <div className="flex items-center flex-wrap gap-4">
                  <div
                    onClick={() =>
                      filterChange({ name: "createdBy", value: "Indhu" })
                    }
                    className={`badge badge-lg text-center w-32 ${
                      filterState.createdBy == "Indhu"
                        ? "!text-white bg-selectedButton laptop-gradient"
                        : "text-black bg-inputBoxbg"
                    } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}
                  >
                    Indhu
                  </div>
                  <div
                    onClick={() =>
                      filterChange({ name: "createdBy", value: "Thejas" })
                    }
                    className={`badge badge-lg text-center w-32 ${
                      filterState.createdBy == "Thejas"
                        ? "!text-white bg-selectedButton laptop-gradient"
                        : "text-black bg-inputBoxbg"
                    } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}
                  >
                    Thejas
                  </div>
                  <div
                    onClick={() =>
                      filterChange({ name: "createdBy", value: "Yasmeen" })
                    }
                    className={`badge badge-lg text-center w-32 ${
                      filterState.createdBy == "Yasmeen"
                        ? "!text-white bg-selectedButton laptop-gradient"
                        : "text-black bg-inputBoxbg"
                    } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}
                  >
                    Yasmeen
                  </div>
                  <div
                    onClick={() =>
                      filterChange({ name: "createdBy", value: "Rafica" })
                    }
                    className={`badge badge-lg text-center w-32 ${
                      filterState.createdBy == "Rafica"
                        ? "!text-white bg-selectedButton laptop-gradient"
                        : "text-black bg-inputBoxbg"
                    } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}
                  >
                    Rafica
                  </div>
                </div>
              </React.Fragment>
            )}
            {/* Apply filters */}
            <div className="flex items-center justify-end">
              <LoadingButton
                className=" border-[1px] border-selectedButton text-selectedButton my-4  py-2 px-4 rounded-xl w-64 disabled:opacity-50"
                disabled={hasInvalidBookingListDateFilter(filterState)}
                loading={loading}
                onClick={(e) => {
                  e.stopPropagation();
                  applyFilters();
                }}
              >
                Apply filters
              </LoadingButton>
            </div>
          </div>
        </div>
      </div>
    );
})
BookingFilter.displayName = "BookingFilter";

export default BookingFilter;
