import type { ComponentProps, ReactNode } from "react";

type FieldProps = Omit<ComponentProps<"input">, "id" | "className"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

/** Labelled text input with optional hint and error, wired up for screen readers. */
export function Field({ id, label, hint, error, ...input }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-label text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-11 rounded-md border bg-card px-3 text-body text-ink ${error ? "border-danger" : "border-border-strong"}`}
        {...input}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-body-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-body-sm text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body-sm text-danger-ink">
      <span className="font-semibold">Fehler: </span>
      {children}
    </p>
  );
}

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-body font-semibold disabled:cursor-not-allowed disabled:opacity-60";

export const buttonStyles = {
  primary: `${buttonBase} bg-primary text-on-primary hover:bg-primary-hover`,
  secondary: `${buttonBase} border border-border-strong bg-card text-ink hover:bg-sunken`,
} as const;

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof buttonStyles }) {
  return <button className={`${buttonStyles[variant]} ${className ?? ""}`} {...props} />;
}
