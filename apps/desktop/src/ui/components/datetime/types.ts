import type { JSX } from "solid-js";

export type Locale = "fr" | "en";

export type GroupPosition = "left" | "right" | "middle" | undefined;

export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  locale?: Locale;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  position?: GroupPosition;
  style?: JSX.CSSProperties;
}

export interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  step?: number;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  position?: GroupPosition;
  style?: JSX.CSSProperties;
}

export interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  locale?: Locale;
  timeStep?: number;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  positionStart?: GroupPosition;
  positionEnd?: GroupPosition;
  style?: JSX.CSSProperties;
}

export interface DateRangePickerProps {
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  isAllDay?: boolean;
  locale?: Locale;
  timeStep?: number;
  disabled?: boolean;
  style?: JSX.CSSProperties;
}
