"use client"
import InquiriesVsConfirmed from "./InquiriesVsConfirmed";
import { useEffect, useState } from "react";
import IncomeFromReservation from "./IncomeFromReservation";
import LoadingButton from "@/components/ui/LoadingButton";
import { useRouter } from 'next/navigation'
import BaseSelect from "@/components/ui/BaseSelect";
import { supabase } from "@/utils/supabase/client";
import IncomeFromCheckin from "./IncomeFromCheckin";
import {
  readOfflineDocument,
  writeOfflineDocument,
} from "@/utils/lib/offlineBookingStore";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

type Month = (typeof MONTH_NAMES)[number];

export interface StatsState {
  filter: {
    month: Month;
    year: number;
    employee: "Thejas" | "Yasmeen" | "Rafica" | "Indhu" | null;
    referral: "Google" | "Instagram" | "Facebook" | "Other" | null;
  };
  rawReservationsResponse: any;
  rawCheckinsResponse: any;
}

const monthConvert: { [key in Month]: number } = MONTH_NAMES.reduce(
  (acc, name, i) => {
    acc[name] = i + 1;
    return acc;
  },
  {} as { [key in Month]: number }
);

function getCurrentMonth(): Month {
  return MONTH_NAMES[new Date().getMonth()];
}

function getYearSelectOptions(): { label: string; value: string }[] {
  const current = new Date().getFullYear();
  const options: { label: string; value: string }[] = [];
  for (let y = current - 5; y <= current + 1; y++) {
    options.push({ label: String(y), value: String(y) });
  }
  return options;
}


export default function StatsView() {
  const router = useRouter();

  const indianFormatter = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  });

  const fetchData = async () => {
    setLoading(true);
    const parameters = {
        month: monthConvert[formState.filter.month],
        year: formState.filter.year,
        employee: formState.filter.employee,
        referral: formState.filter.referral,
    };
    const offlineKey = `report:overview:${JSON.stringify(parameters)}`;
    const stored = await readOfflineDocument<{
      reservations: any;
      checkins: any;
    }>(offlineKey).catch(() => null);
    if (stored) {
      setFormState((prevState) => ({
        ...prevState,
        rawReservationsResponse: stored.reservations,
        rawCheckinsResponse: stored.checkins,
      }));
      setLoading(false);
    }

    const [reservations, checkins] = await Promise.all([
      supabase.rpc("get_booking_stats", parameters),
      supabase.rpc("get_checkin_stats", parameters),
    ]);
    if (reservations.error || checkins.error) {
      console.error("Unable to refresh reports", reservations.error || checkins.error);
      setLoading(false);
      return;
    }
    setFormState((prevState) => ({
      ...prevState,
      rawReservationsResponse: reservations.data,
      rawCheckinsResponse: checkins.data,
    }));
    void writeOfflineDocument(offlineKey, {
      reservations: reservations.data,
      checkins: checkins.data,
    }).catch(() => undefined);
    setLoading(false);
  };

  const [formState, setFormState] = useState<StatsState>({
    filter: {
      month: getCurrentMonth(),
      year: new Date().getFullYear(),
      employee: null,
      referral: null,
    },
    rawReservationsResponse: { daily: [], monthly: [] },
    rawCheckinsResponse: { daily: [], monthly: [] },
  });

  const dayOfMonth = new Date().getDate();
  const conversionRateForMonth =
    (formState?.rawReservationsResponse?.monthly?.confirmedCount /
      formState?.rawReservationsResponse?.monthly?.inquiriesCount) *
    100;
  const conversionRateDaily =
    (formState?.rawReservationsResponse?.daily[dayOfMonth]?.confirmedCount /
      formState?.rawReservationsResponse?.daily[dayOfMonth]?.inquiriesCount) *
    100;
  //Filter modal
  //Loading data
  const [loading, setLoading] = useState<boolean>(false);
  const [filterModalOpened, setFilterModalOpened] = useState<Boolean>(false);
  const toggleFilterModal = () => {
    setFilterModalOpened(!filterModalOpened);
  };
  const filterChange = ({
    name,
    value,
  }: {
    name: string;
    value: string | null;
  }) => {
    setFormState((prevState) => ({
      ...prevState,
      filter: {
        ...prevState.filter,
        [name]:
          prevState.filter[name as keyof typeof prevState.filter] == value
            ? null
            : value,
      },
    }));
  };
  useEffect(() => {
    setFormState((prevState) => ({
      ...prevState,
      filter: {
        month: getCurrentMonth(),
        year: new Date().getFullYear(),
        employee: null,
        referral: null,
      },
    }));
    fetchData();
  }, []);
  // **********************************************************************************************************************************************************************

  // *************************************************************************Html template********************************************************************************

  // **********************************************************************************************************************************************************************

  return (
    <div className="flex flex-col gap-5 !select-none laptop-up:px-10 laptop-up:pb-10">
      <div className="flex items-center h-[72px]">
        <span
          className=" material-symbols-outlined cursor-pointer hover:text-selectedButton"
          onClick={() => router.back()}
        >
          arrow_back
        </span>
        <h1 className="text-lg font-bold leading-6 w-full text-center ">
          Report for {formState.filter.month} {formState.filter.year}
        </h1>
        <span
          className="material-symbols-filled text-2xl cursor-pointer"
          onClick={() => toggleFilterModal()}
        >
          filter_alt
        </span>
      </div>
      <div className="flex flex-col gap-5">
        <h1 className="title-xl text-typo_dark-300 ">
          Summary for {formState.filter.month} {formState.filter.year}
        </h1>
        <div className="flex flex-col  gap-5">
          <div className="flex gap-5">
            <div className="flex-1 rounded-xl h-28 bg-typo_light-100 flex flex-col justify-center py-2 gap-2 px-6">
              <label className="label_text !p-0 !font-medium">Inquiries</label>
              <label className="title-xl text-typo_dark-300">
                {formState?.rawReservationsResponse?.monthly?.inquiriesCount}
              </label>
            </div>
            <div className="flex-1 rounded-xl h-28 bg-typo_light-100 flex flex-col justify-center py-2 gap-2 px-6">
              <label className="label_text !p-0 !font-medium">Confirmed</label>
              <label className="title-xl text-typo_dark-300">
                {formState?.rawReservationsResponse?.monthly?.confirmedCount}
              </label>
            </div>
          </div>
          <div className="flex gap-5">
            <div className="flex-1 rounded-xl h-28 bg-typo_light-100 flex flex-col justify-center py-2 gap-2 px-6">
              <label className="label_text !p-0 !font-medium">
                Conversion Rate
              </label>
              <label className="title-xl text-typo_dark-300">
                {conversionRateForMonth
                  ? (Math.trunc(conversionRateForMonth) ==
                    conversionRateForMonth
                      ? Math.trunc(conversionRateForMonth)
                      : conversionRateForMonth.toFixed(1)) + "%"
                  : 0}
              </label>
            </div>
            <div className="flex-1 rounded-xl h-28 bg-typo_light-100 flex flex-col justify-center py-2 gap-2 px-6">
              <label className="label_text !p-0 !font-medium"> Checkins</label>
              <label className="title-xl text-typo_dark-300">
                {indianFormatter.format(
                  formState?.rawCheckinsResponse?.monthly?.count
                )}
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <h1 className="title-xl text-typo_dark-300 ">Summary for Today</h1>
        <div className="flex flex-col  gap-5">
          <div className="flex gap-5">
            <div className="flex-1 rounded-xl h-28 bg-typo_light-100 flex flex-col justify-center py-2 gap-2 px-6">
              <label className="label_text !p-0 !font-medium">Inquiries</label>
              <label className="title-xl text-typo_dark-300">
                {
                  formState?.rawReservationsResponse?.daily[dayOfMonth]
                    ?.inquiriesCount
                }
              </label>
            </div>
            <div className="flex-1 rounded-xl h-28 bg-typo_light-100 flex flex-col justify-center py-2 gap-2 px-6">
              <label className="label_text !p-0 !font-medium">Confirmed</label>
              <label className="title-xl text-typo_dark-300">
                {
                  formState?.rawReservationsResponse?.daily[dayOfMonth]
                    ?.confirmedCount
                }
              </label>
            </div>
          </div>
          <div className="flex gap-5">
            <div className="flex-1 rounded-xl h-28 bg-typo_light-100 flex flex-col justify-center py-2 gap-2 px-6">
              <label className="label_text !p-0 !font-medium">
                Conversion Rate
              </label>
              <label className="title-xl text-typo_dark-300">
                {conversionRateDaily
                  ? (Math.trunc(conversionRateDaily) == conversionRateDaily
                      ? Math.trunc(conversionRateDaily)
                      : conversionRateDaily.toFixed(1)) + "%"
                  : 0}
              </label>
            </div>
            <div className="flex-1 rounded-xl h-28 bg-typo_light-100 flex flex-col justify-center py-2 gap-2 px-6">
              <label className="label_text !p-0 !font-medium"> Checkins</label>
              <label className="title-xl text-typo_dark-300">
                {indianFormatter.format(
                  formState?.rawCheckinsResponse?.daily[dayOfMonth]?.count
                )}
              </label>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h1 className="title">Inquiries vs Confirmed</h1>
        <InquiriesVsConfirmed data={formState.rawReservationsResponse} />
      </div>
      <div>
        <h1 className="title">Income from Reservations</h1>
        <IncomeFromReservation data={formState.rawReservationsResponse} />
      </div>
      <div>
        <h1 className="title">Income from Checkins</h1>
        <IncomeFromCheckin data={formState.rawCheckinsResponse} />
      </div>
      <div className="flex flex-col gap-5">
        <h1 className="title">Booking Details</h1>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="label_text !pt-0">Total Reservations Value</label>
            <label className="label_text !pt-0 !font-semibold text-typo_dark-300">
              {"₹" +
                indianFormatter.format(
                  formState?.rawReservationsResponse?.monthly?.confirmedSum
                )}
            </label>
          </div>
          <div className="flex justify-between items-center">
            <label className="label_text">Total Tax Reservations Value</label>
            <label className="label_text !font-semibold text-typo_dark-300">
              {"₹" +
                indianFormatter.format(
                  formState?.rawReservationsResponse?.monthly?.taxTotal
                )}
            </label>
          </div>
          <div className="flex justify-between items-center">
            <label className="label_text">Average Reservation Value</label>
            <label className="label_text !font-semibold text-typo_dark-300">
              {"₹" +
                indianFormatter.format(
                  formState?.rawReservationsResponse?.monthly?.confirmedAvg
                )}
            </label>
          </div>

          <div className="flex justify-between items-center">
            <label className="label_text">Total Checkin Value</label>
            <label className="label_text !font-semibold text-typo_dark-300">
              {"₹" +
                indianFormatter.format(
                  formState?.rawCheckinsResponse?.monthly?.sum
                )}
            </label>
          </div>
          <div className="flex justify-between items-center">
            <label className="label_text">Total Tax Checkin Value</label>
            <label className="label_text !font-semibold text-typo_dark-300">
              {"₹" +
                indianFormatter.format(
                  formState?.rawCheckinsResponse?.monthly?.taxTotal
                )}
            </label>
          </div>
          <div className="flex justify-between items-center">
            <label className="label_text">Average Checkin Value</label>
            <label className="label_text !font-semibold text-typo_dark-300">
              {"₹" +
                indianFormatter.format(
                  formState?.rawCheckinsResponse?.monthly?.average
                )}
            </label>
          </div>
        </div>
      </div>
      {/* Filter modal */}

      <div
        className={`${filterModalOpened ? "top-0" : "top-[9999px]"} transition-all fixed h-full w-full z-[90] top-0 left-0 flex flex-col justify-end laptop-up:w-[calc(100%-14rem)] laptop-up:left-56`}
      >
        {/* overlay background */}
        <div
          className="overlay h-full w-full bg-black/40 absolute z-10"
          onClick={toggleFilterModal}
        ></div>
        {/* Filter part  */}
        <div className="bg-white flex flex-col p-4 relative gap-5 z-20 max-h-[80vh] overflow-y-auto">
          {/* filters */}
          <label className="subheading laptop-up:!font-medium laptop-up:text-base">
            Filters
          </label>
          <BaseSelect
            value={formState.filter.month}
            data={(Object.keys(monthConvert) as Month[]).map((month) => ({
              label: month,
              value: month,
            }))}
            onChange={(value) => filterChange({ name: "month", value: value })}
            name="month"
          />

          <label className="subheading laptop-up:!font-medium laptop-up:text-base">
            Year
          </label>
          <BaseSelect
            value={String(formState.filter.year)}
            data={getYearSelectOptions()}
            onChange={(value) =>
              setFormState((prev) => ({
                ...prev,
                filter: { ...prev.filter, year: Number(value) },
              }))
            }
            name="year"
          />

          {/* Referrals */}
          <label className="subheading laptop-up:!font-medium laptop-up:text-base">
            Referrals
          </label>
          <div className="flex items-center flex-wrap gap-5">
            <div
              onClick={() =>
                filterChange({
                  name: "referral",
                  value:
                    formState.filter.referral == "Facebook" ? null : "Facebook",
                })
              }
              className={`badge badge-lg text-center w-32 ${
                formState.filter.referral == "Facebook"
                  ? "!text-white bg-selectedButton laptop-gradient"
                  : "text-black bg-inputBoxbg"
              } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}
            >
              Facebook
            </div>
            <div
              onClick={() =>
                filterChange({
                  name: "referral",
                  value:
                    formState.filter.referral == "Google" ? null : "Google",
                })
              }
              className={`badge badge-lg text-center w-32 ${
                formState.filter.referral == "Google"
                  ? "!text-white bg-selectedButton laptop-gradient"
                  : "text-black bg-inputBoxbg"
              } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}
            >
              Google
            </div>
            <div
              onClick={() =>
                filterChange({
                  name: "referral",
                  value:
                    formState.filter.referral == "Instagram"
                      ? null
                      : "Instagram",
                })
              }
              className={`badge badge-lg text-center w-32 ${
                formState.filter.referral == "Instagram"
                  ? "!text-white bg-selectedButton laptop-gradient"
                  : "text-black bg-inputBoxbg"
              } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}
            >
              Instagram
            </div>

            <div
              onClick={() =>
                filterChange({
                  name: "referral",
                  value: formState.filter.referral == "Other" ? null : "Other",
                })
              }
              className={`badge badge-lg text-center w-32 ${
                formState.filter.referral == "Other"
                  ? "!text-white bg-selectedButton laptop-gradient"
                  : "text-black bg-inputBoxbg"
              } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}
            >
              Other
            </div>
          </div>
          {/* Employees */}
          <label className="subheading laptop-up:!font-medium laptop-up:text-base">
            Employees
          </label>
          <div className="flex items-center flex-wrap gap-5">
            <div
              onClick={() => filterChange({ name: "employee", value: "Indhu" })}
              className={`badge badge-lg text-center w-32 ${
                formState.filter.employee == "Indhu"
                  ? "!text-white bg-selectedButton laptop-gradient"
                  : "text-black bg-inputBoxbg"
              } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}
            >
              Indhu
            </div>
            <div
              onClick={() =>
                filterChange({ name: "employee", value: "Thejas" })
              }
              className={`badge badge-lg text-center w-32 ${
                formState.filter.employee == "Thejas"
                  ? "!text-white bg-selectedButton laptop-gradient"
                  : "text-black bg-inputBoxbg"
              } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}
            >
              Thejas
            </div>
            <div
              onClick={() =>
                filterChange({ name: "employee", value: "Yasmeen" })
              }
              className={`badge badge-lg text-center w-32 ${
                formState.filter.employee == "Yasmeen"
                  ? "!text-white bg-selectedButton laptop-gradient"
                  : "text-black bg-inputBoxbg"
              } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}
            >
              Yasmeen
            </div>
            <div
              onClick={() =>
                filterChange({ name: "employee", value: "Rafica" })
              }
              className={`badge badge-lg text-center w-32 ${
                formState.filter.employee == "Rafica"
                  ? "!text-white bg-selectedButton laptop-gradient"
                  : "text-black bg-inputBoxbg"
              } text-base font-medium leading-normal p-4 text-typo_dark-100 h-12 rounded-[20px] cursor-pointer`}
            >
              Rafica
            </div>
          </div>
          {/* Apply filters */}
          <LoadingButton
            className=" border-[1px] border-selectedButton text-selectedButton my-4 w-full py-2 px-4 rounded-xl"
            loading={loading}
            onClick={() => {
              fetchData();
              toggleFilterModal();
            }}
          >
            Apply filters
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
