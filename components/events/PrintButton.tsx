"use client";

import Icon from "@/components/events/Icon";

export default function PrintButton() {
  return (
    <button className="btn" onClick={() => window.print()}>
      <Icon name="print" />
      Print roster
    </button>
  );
}
