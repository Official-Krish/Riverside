"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarDays, ChevronDownIcon, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type DatePickerTimeProps = {
  value?: Date | null;
  onChange: (value: Date | null) => void;
  className?: string;
  dateLabel?: string;
  timeLabel?: string;
};

function formatTimeValue(value?: Date | null) {
  if (!value) {
    return "";
  }

  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function DatePickerTime({
  value,
  onChange,
  className,
  dateLabel = "Date",
  timeLabel = "Time",
}: DatePickerTimeProps) {
  const [open, setOpen] = React.useState(false);
  const [timeFocused, setTimeFocused] = React.useState(false);

  const updateDate = (nextDate?: Date) => {
    if (!nextDate) {
      onChange(null);
      setOpen(false);
      return;
    }

    const current = value ?? new Date();
    const merged = new Date(nextDate);
    merged.setHours(current.getHours(), current.getMinutes(), 0, 0);
    onChange(merged);
    setOpen(false);
  };

  const updateTime = (event: React.ChangeEvent<HTMLInputElement>) => {
    const [hours, minutes] = event.target.value.split(":");
    const base = value ? new Date(value) : new Date();
    base.setHours(Number(hours || 0), Number(minutes || 0), 0, 0);
    onChange(base);
  };

  return (
    <FieldGroup className={className}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel
            htmlFor="schedule-date-picker"
            className="text-[12px] font-medium text-[#c8a870]/70"
          >
            {dateLabel}
          </FieldLabel>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                id="schedule-date-picker"
                className="h-12 w-full justify-between border-white/12 bg-white/4 font-normal text-[#fff5de] hover:bg-white/6"
              >
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="size-4 text-[#f5a623]" />
                  {value ? format(value, "PPP") : "Select date"}
                </span>
                <ChevronDownIcon className="size-4 text-[#b49650]/70" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto overflow-hidden border border-white/10 bg-[#15120d] p-0"
              align="start"
            >
              <Calendar
                mode="single"
                selected={value ?? undefined}
                captionLayout="dropdown"
                defaultMonth={value ?? undefined}
                onSelect={updateDate}
              />
            </PopoverContent>
          </Popover>
        </Field>

        <Field>
          <FieldLabel
            htmlFor="schedule-time-picker"
            className="text-[12px] font-medium text-[#c8a870]/70"
          >
            {timeLabel}
          </FieldLabel>
          <div className="relative">
            <Input
              type="time"
              id="schedule-time-picker"
              value={formatTimeValue(value)}
              onChange={updateTime}
              onFocus={() => setTimeFocused(true)}
              onBlur={() => setTimeFocused(false)}
              className={[
                "h-12 border-white/12 bg-white/4 pl-11 text-sm outline-none transition focus:border-[#f5a623]/40 focus:ring-2 focus:ring-[#f5a623]/15 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
                value || timeFocused
                  ? "text-[#fff5de]"
                  : "text-transparent caret-[#fff5de]",
              ].join(" ")}
            />
            <Clock3 className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#f5a623]" />
            {!value && !timeFocused ? (
              <span className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 text-sm text-[#b49650]/55">
                09:00 AM
              </span>
            ) : null}
          </div>
        </Field>
      </div>
    </FieldGroup>
  );
}
