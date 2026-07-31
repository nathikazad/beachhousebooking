import React, { forwardRef, useImperativeHandle } from "react";
import Properties from "./Properties";
import LoadingButton from "./ui/LoadingButton";
import BookingDatePeriodFilter from "./BookingDatePeriodFilter";
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
    setFilterState((prevfilterState: Filter) => ({
      ...prevfilterState,
      [name]: value,
    }));
  };

  return (

    <div className={`${isFiltersOpened ? 'top-0' : 'top-[9999px]'} transition-all fixed h-full w-full z-30 top-0 left-0 flex flex-col justify-end`}>
      {/* overlay background */}
      <div className="overlay h-full w-full bg-black/40 absolute z-10"
        onClick={(e) => {
          e.stopPropagation();
          toggleFilterDisplay();
        }}>
      </div>
      {/* Filter part  */}
      <div className='bg-white flex flex-col p-4 relative gap-4 z-20 max-h-[80vh] overflow-y-auto'>
        {/* filters */}
        <label className='subheading'>Filters</label>
        <BookingDatePeriodFilter
          filterState={filterState}
          setFilterState={setFilterState}
        />
        {/* Referrals */}

        <Properties properties={filterState.properties ?? []} setFilterState={setFilterState} />
        {/* Booking Types */}
        {filtersFor == 'Logs' && (
          <div>
            <label className='subheading'>Booking Types</label>
            <div className='flex items-center flex-wrap gap-4' >
              <div onClick={() => filterChange({ name: 'status', value: 'Inquiry' })} className={`badge badge-lg text-center w-32 ${filterState.status == 'Inquiry' ? '!text-white bg-selectedButton' : 'text-black bg-inputBoxbg'
                } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}>Inquiries</div>
              <div onClick={() => filterChange({ name: 'status', value: 'Quotation' })} className={`badge badge-lg text-center w-32 ${filterState.status == 'Quotation' ? '!text-white bg-selectedButton' : 'text-black bg-inputBoxbg'
                } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}>Quotations</div>
              <div onClick={() => filterChange({ name: 'status', value: 'Confirmed' })} className={`badge badge-lg text-center w-32 ${filterState.status == 'Confirmed' ? '!text-white bg-selectedButton' : 'text-black bg-inputBoxbg'
                } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}>Confirmed</div>
            </div>
          </div>
        )}

        {/* Other */}
        <label className='subheading'>Other</label>
        <div className='flex items-center flex-wrap gap-4' >
          <div onClick={() => filterChange({ name: 'paymentPending', value: !filterState.paymentPending })} className={`badge badge-lg text-center w-44 ${filterState.paymentPending ? '!text-white bg-selectedButton' : 'text-black bg-inputBoxbg'
            } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}>Payment Pending</div>
          <div onClick={() => filterChange({ name: 'starred', value: !filterState.starred })} className={`badge badge-lg text-center w-32 ${filterState.starred ? '!text-white bg-selectedButton' : 'text-black bg-inputBoxbg'
            } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}>Starred</div>


        </div>
        {/* Employees */}
        {filtersFor == 'Logs' && (
          <div>
            <label className='subheading'>Employees</label>
            <div className='flex items-center flex-wrap gap-4' >
              <div onClick={() => filterChange({ name: 'createdBy', value: 'Indhu' })} className={`badge badge-lg text-center w-32 ${filterState.createdBy == 'Indhu' ? '!text-white bg-selectedButton' : 'text-black bg-inputBoxbg'
                } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}>Indhu</div>
              <div onClick={() => filterChange({ name: 'createdBy', value: 'Thejas' })} className={`badge badge-lg text-center w-32 ${filterState.createdBy == 'Thejas' ? '!text-white bg-selectedButton' : 'text-black bg-inputBoxbg'
                } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}>Thejas</div>
              <div onClick={() => filterChange({ name: 'createdBy', value: 'Yasmeen' })} className={`badge badge-lg text-center w-32 ${filterState.createdBy == 'Yasmeen' ? '!text-white bg-selectedButton' : 'text-black bg-inputBoxbg'
                } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}>Yasmeen</div>
              <div onClick={() => filterChange({ name: 'createdBy', value: 'Rafica' })} className={`badge badge-lg text-center w-32 ${filterState.createdBy == 'Rafica' ? '!text-white bg-selectedButton' : 'text-black bg-inputBoxbg'
                } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}>Rafica</div>
            </div>
          </div>
        )}
        {/* Apply filters */}
        <LoadingButton
          className=" border-[1px] border-selectedButton text-selectedButton my-4 w-full py-2 px-4 rounded-xl disabled:opacity-50"
          disabled={hasInvalidBookingListDateFilter(filterState)}
          loading={loading}
          onClick={(e) => {
            e.stopPropagation();
            applyFilters()
          }} >Apply filters</LoadingButton>
      </div>

    </div>

  );
})
BookingFilter.displayName = "BookingFilter";

export default BookingFilter;
