import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

type Props = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number;
  onChange: (v: number) => void;
};

/**
 * Numeric input that holds the raw typed string locally so the user can
 * freely clear the field, type a leading "0", a decimal separator, etc.
 * Commits a Number to the parent on every valid change and on blur.
 */
export function NumberInput({ value, onChange, onBlur, ...rest }: Props) {
  const [text, setText] = useState<string>(() => (value === 0 ? "" : String(value)));

  // Sync from outside when the numeric value really changes
  useEffect(() => {
    const parsed = text.replace(",", ".").trim();
    const current = parsed === "" || parsed === "-" ? 0 : Number(parsed);
    if (!Number.isNaN(current) && current === value) return;
    setText(value === 0 ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        // allow empty, minus, digits, one decimal separator (. or ,)
        if (raw !== "" && !/^-?\d*([.,]\d*)?$/.test(raw)) return;
        setText(raw);
        const normalized = raw.replace(",", ".");
        if (normalized === "" || normalized === "-" || normalized === "." || normalized === "-.") {
          onChange(0);
        } else {
          const n = Number(normalized);
          if (!Number.isNaN(n)) onChange(n);
        }
      }}
      onBlur={(e) => {
        if (text === "" || text === "-" || text === "." || text === "-.") {
          setText("");
          onChange(0);
        }
        onBlur?.(e);
      }}
    />
  );
}
