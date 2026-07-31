import { calculateGstPercentage } from "@/utils/lib/gst";
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
  const gstPercentage = calculateGstPercentage(totalCost, taxAmount);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-2">
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
        <label className="flex w-24 shrink-0 flex-col gap-2">
          <span className="text-sm font-medium">Percentage</span>
          <BaseInput
            name="taxPercentage"
            value={`${gstPercentage}%`}
            readOnly
          />
        </label>
      </div>

      <div className="title flex items-center justify-between">
        <span>Total after tax</span>
        <span>{formatMoney(afterTaxTotal)}</span>
      </div>
    </div>
  );
}
