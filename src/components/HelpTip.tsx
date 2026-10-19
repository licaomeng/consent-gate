"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const visible = !suppressed && (pinned || hovered || focused);

  useEffect(() => {
    if (!visible) return;

    function dismiss(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPinned(false);
        setSuppressed(true);
      }
    }

    function closeOnOutsidePress(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setPinned(false);
        setSuppressed(true);
      }
    }

    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", closeOnOutsidePress);
    };
  }, [visible]);

  return (
    <span
      ref={rootRef}
      className={`help-tip ${align === "right" ? "help-tip-right" : ""}`}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        setSuppressed(false);
      }}
    >
      <button
        type="button"
        className="help-tip-button"
        aria-label={label}
        aria-describedby={`${id}-tooltip`}
        data-testid={`help-${id}`}
        onClick={() => {
          setPinned((current) => !current);
          setSuppressed(false);
        }}
        onFocus={() => {
          setFocused(true);
          setSuppressed(false);
        }}
        onBlur={() => {
          setFocused(false);
          setSuppressed(false);
        }}
      >
        <span aria-hidden="true">i</span>
      </button>
      <span
        className={`help-tip-content ${visible ? "help-tip-open" : ""}`}
        role="tooltip"
        id={`${id}-tooltip`}
        data-testid={`tooltip-${id}`}
        data-open={visible ? "true" : "false"}
      >
        {children}
      </span>
    </span>
  );
}
