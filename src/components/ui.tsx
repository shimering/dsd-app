import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, X } from "lucide-react";
export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "The operation could not be completed.";
export function Notice({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warning" | "error";
}) {
  return (
    <div
      className={`notice ${tone}`}
      role={tone === "error" ? "alert" : undefined}
    >
      <AlertCircle size={18} />
      <div>{children}</div>
    </div>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  unit = "mm",
  disabled = false,
  signed = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  signed?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {unit && <small> {unit}</small>}
      </label>
      <div className="number-input">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value === "" ? null : e.target.valueAsNumber;
            if (v === null || Number.isFinite(v)) onChange(v);
          }}
        />
        {(signed || (min !== undefined && min < 0)) && (
          <button
            className="icon-btn"
            type="button"
            disabled={disabled || value === null || value === 0}
            aria-label={`Set ${label} to ${value !== null && value < 0 ? "positive" : "negative"}`}
            onClick={() => {
              if (value !== null) onChange(-value);
            }}
          >
            ±
          </button>
        )}
      </div>
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    id = useId(),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      root = document.getElementById("root");
    root?.setAttribute("inert", "");
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key === "Tab") {
        const focusable = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex="0"]',
          ) ?? [],
        ).filter((element) => element.getClientRects().length > 0);
        const first = focusable[0],
          last = focusable.at(-1);
        if (!first) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      root?.removeAttribute("inert");
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div className="dialog-backdrop">
      <div
        className={`dialog ${wide ? "wide" : ""}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
      >
        <header className="dialog-header">
          <h2 id={id}>{title}</h2>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
export function useTheme() {
  const [theme, setTheme] = useState<"system" | "light" | "dark">(() => {
    const v = localStorage.getItem("dsd_theme");
    return v === "light" || v === "dark" ? v : "system";
  });
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.style.colorScheme =
        document.documentElement.dataset.theme;
    };
    apply();
    localStorage.setItem("dsd_theme", theme);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  return { theme, setTheme };
}
export function useVisibleViewport() {
  useEffect(() => {
    const resize = () => {
      document.documentElement.style.setProperty(
        "--app-height",
        `${window.visualViewport?.height ?? window.innerHeight}px`,
      );
    };
    resize();
    window.visualViewport?.addEventListener("resize", resize);
    window.addEventListener("resize", resize);
    return () => {
      window.visualViewport?.removeEventListener("resize", resize);
      window.removeEventListener("resize", resize);
    };
  }, []);
}
