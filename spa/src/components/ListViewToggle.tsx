import { ListViewMode } from "@/utils/lib/listViewPreference";

interface ListViewToggleProps {
  mode: ListViewMode;
  onChange: (mode: ListViewMode) => void;
}

export default function ListViewToggle({
  mode,
  onChange,
}: ListViewToggleProps) {
  return (
    <div
      className="my-4 ml-auto flex w-fit rounded-xl border border-typo_dark-300 p-1"
      aria-label="List view"
    >
      {(["cell", "table"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={mode === option}
          onClick={() => onChange(option)}
          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm capitalize ${
            mode === option
              ? "bg-selectedButton text-white"
              : "text-slate-600 hover:bg-gray-100"
          }`}
        >
          <span className="material-symbols-outlined text-lg">
            {option === "cell" ? "grid_view" : "table_rows"}
          </span>
          {option}
        </button>
      ))}
    </div>
  );
}
