/**
 * Returns local calendar date in YYYY-MM-DD format.
 * Avoids UTC offset bugs (e.g., 12 AM - 6 AM in Asia/Dhaka shifting to previous day).
 */
export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
