import { Cost, Property } from "@/utils/lib/bookingType";
import BaseInput from "./ui/BaseInput";

interface FinancialPropertySelectProps {
  value?: Property;
  properties: Property[];
  onChange: (property: Property | undefined) => void;
  className?: string;
}

export function FinancialPropertySelect({
  value,
  properties,
  onChange,
  className = "",
}: FinancialPropertySelectProps) {
  const options = Array.from(new Set(properties));

  return (
    <select
      aria-label="Property"
      className={`${className} h-14 rounded-lg bg-typo_light-100 px-3`}
      value={value ?? ""}
      onChange={(event) =>
        onChange(
          event.target.value
            ? (event.target.value as Property)
            : undefined
        )
      }
    >
      <option value="">Select property</option>
      {options.map((property) => (
        <option key={property} value={property}>
          {property}
        </option>
      ))}
    </select>
  );
}

interface FinancialItemFieldsProps {
  cost: Cost;
  properties: Property[];
  onChange: (name: "name" | "amount" | "property", value: string) => void;
  onDelete: () => void;
}

export default function FinancialItemFields({
  cost,
  properties,
  onChange,
  onDelete,
}: FinancialItemFieldsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <BaseInput
        type="text"
        name="name"
        value={cost.name}
        onChange={(event) => onChange("name", event.target.value)}
        placeholder="Type of expense"
        className="min-w-36 flex-1"
      />
      <BaseInput
        type="number"
        name="amount"
        value={cost.amount}
        onChange={(event) => onChange("amount", event.target.value)}
        placeholder="Cost"
        className="min-w-28 flex-1 pr-3"
      />
      <FinancialPropertySelect
        value={cost.property}
        properties={properties}
        onChange={(property) => onChange("property", property ?? "")}
        className="min-w-40 flex-1"
      />
      <span
        aria-label="Delete financial item"
        className="material-symbols-outlined cursor-pointer hover:text-red-500"
        onClick={onDelete}
      >
        delete
      </span>
    </div>
  );
}
