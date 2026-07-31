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
      <div
        className="flex min-w-0 items-center gap-3"
        aria-label="GST reference calculator"
      >
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
          className="min-w-0 flex-1 accent-primaryShade"
        />
        <span className="shrink-0 text-sm font-medium">
          {referencePercentage}%
        </span>
        <span className="shrink-0 text-sm font-medium">
          {formatMoney(referenceAmount)}
        </span>
      </div>

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

      <div className="title flex items-center justify-between">
        <span>Total after tax</span>
        <span>{formatMoney(afterTaxTotal)}</span>
      </div>
    </div>
  );
}
