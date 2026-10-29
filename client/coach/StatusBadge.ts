import { createElement } from "react";

export type ReviewBadgeStatus =
  | "review-requested"
  | "confirmed"
  | "new-notes"
  | "unsent-changes";

const labels: Record<ReviewBadgeStatus, string> = {
  "review-requested": "Review requested",
  confirmed: "Confirmed",
  "new-notes": "New notes",
  "unsent-changes": "Newer changes not sent",
};

export function StatusBadge({ status }: { status: ReviewBadgeStatus }) {
  return createElement(
    "span",
    { className: `review-status review-status--${status}` },
    labels[status],
  );
}
