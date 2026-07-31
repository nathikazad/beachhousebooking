import { useState } from "react";
import {
  DEFAULT_GST_REFERENCE_PERCENTAGE,
  MAX_GST_REFERENCE_PERCENTAGE,
  calculateGstReferenceAmount,
} from "@/utils/lib/gst";
import BaseInput from "./ui/BaseInput";

interface BookingTaxFieldsProps {
  totalCost: number;
  taxAmount: number;
  afterTaxTotal: number;
  onTaxAmountChange: (amount: number) => void;
}

function formatMoney(amount: number): string {
  return `₹ ${amount.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

export default function BookingTaxFields({
  totalCost,
  taxAmount,
  afterTaxTotal,
  onTaxAmountChange,
}: BookingTaxFieldsProps) {
  const [referencePercentage, setReferencePercentage] = useState(
    DEFAULT_GST_REFERENCE_PERCENTAGE
  );
  const referenceAmount = calculateGstReferenceAmount(
    totalCost,
    referencePercentage
  );

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">GST amount</span>
        <BaseInput
          type="number"
          name="tax"
          value={taxAmount}
          onChange={(event) =>
            onTaxAmountChange(
              event.target.value ? Number(event.target.value) : 0
            )
          }
          placeholder="GST amount"
        />
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm font-medium">
          <span>GST reference percentage</span>
          <span>{referencePercentage}%</span>
        </div>
        <input
          aria-label="GST reference percentage"
          type="range"
          min="0"
          max={MAX_GST_REFERENCE_PERCENTAGE}
          step="1"
          value={referencePercentage}
          onChange={(event) =>
            setReferencePercentage(Number(event.target.value))
          }
          className="w-full accent-primaryShade"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg bg-typo_light-100 px-4 py-3">
        <span className="text-sm font-medium">Reference amount</span>
        <span>{formatMoney(referenceAmount)}</span>
      </div>

      <div className="title flex items-center justify-between">
        <span>Total after tax</span>
        <span>{formatMoney(afterTaxTotal)}</span>
      </div>
    </div>
  );
}
