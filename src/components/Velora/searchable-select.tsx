"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  keywords?: readonly string[];
  disabled?: boolean;
}

interface SearchableSelectProps {
  options: readonly SearchableSelectOption[];
  value?: string;
  onValueChange: (value: string | undefined) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  clearLabel: string;
  openLabel: string;
  disabled?: boolean;
  className?: string;
}

export function searchableSelectOptionMatches(
  option: SearchableSelectOption,
  query: string
): boolean {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const searchableText = [option.label, option.description, ...(option.keywords ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();

  return terms.every((term) => searchableText.includes(term));
}

/** Accessible, reusable single-value picker with client-side keyword search. */
export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  clearLabel,
  openLabel,
  disabled = false,
  className,
}: SearchableSelectProps) {
  const selectedOption = options.find((option) => option.value === value) ?? null;

  return (
    <Combobox.Root<SearchableSelectOption>
      items={options}
      value={selectedOption}
      onValueChange={(option, details) => {
        if (option) {
          onValueChange(option.value);
          return;
        }
        if (details.reason === "clear-press") onValueChange(undefined);
      }}
      itemToStringLabel={(option) => option.label}
      isItemEqualToValue={(option, selected) => option.value === selected.value}
      filter={(option, query) => searchableSelectOptionMatches(option, query)}
      autoHighlight
      disabled={disabled}
    >
      <Combobox.InputGroup
        className={cn(
          "relative flex min-h-11 w-full items-center rounded-[var(--mds-radius-md)] border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 sm:min-h-9",
          className
        )}
      >
        <Combobox.Input
          placeholder={placeholder}
          aria-label={searchPlaceholder}
          className="h-full min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        <div className="flex shrink-0 items-center pe-1">
          {selectedOption ? (
            <Combobox.Clear
              className="inline-flex size-9 items-center justify-center rounded-[var(--mds-radius-md)] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={clearLabel}
            >
              <X className="size-4" />
            </Combobox.Clear>
          ) : null}
          <Combobox.Trigger
            className="inline-flex size-9 items-center justify-center rounded-[var(--mds-radius-md)] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={openLabel}
          >
            <ChevronsUpDown className="size-4" />
          </Combobox.Trigger>
        </div>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner
          sideOffset={4}
          align="start"
          className="z-[var(--mds-z-dropdown)] outline-none"
        >
          <Combobox.Popup className="w-[var(--anchor-width)] min-w-64 max-w-[var(--available-width)] origin-[var(--transform-origin)] overflow-hidden rounded-[var(--mds-radius-lg)] border border-border bg-popover text-popover-foreground shadow-[var(--mds-elevation-2)] transition-[transform,opacity] duration-[var(--mds-motion-fast)] data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0">
            <Combobox.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto overscroll-contain p-1 outline-none">
              {(option: SearchableSelectOption) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  disabled={option.disabled}
                  className="grid cursor-default grid-cols-[1rem_minmax(0,1fr)] items-center gap-x-2 rounded-[var(--mds-radius-md)] px-2 py-2 text-sm outline-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <Combobox.ItemIndicator className="col-start-1">
                    <Check className="size-4" />
                  </Combobox.ItemIndicator>
                  <span className="col-start-2 min-w-0 truncate font-medium">
                    {option.label}
                  </span>
                  {option.description ? (
                    <span className="col-start-2 min-w-0 truncate text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
