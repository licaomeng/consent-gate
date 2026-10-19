"use client";

import type { ReactNode } from "react";

export default function HelpTip({
  id,
  label,
  align = "left",
  children,
}: {
  id: string;
  label: string;
  align?: "left" | "right";
  children: ReactNode;
}) {
  return (
    <span className={`help-tip ${align === "right" ? "help-tip-right" : ""}`}>
      <button
        type="button"
        className="help-tip-button"
        aria-label={label}
        aria-describedby={`${id}-tooltip`}
        data-testid={`help-${id}`}
      >
        <span aria-hidden="true">i</span>
      </button>
      <span
        className="help-tip-content"
        role="tooltip"
        id={`${id}-tooltip`}
        data-testid={`tooltip-${id}`}
      >
        {children}
      </span>
    </span>
  );
}
