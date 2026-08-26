// Mongo's Date type always carries a time component internally, but a
// payment date, a delivery/expiry date, or any other calendar-date field in
// this app is only ever meant as a plain date — normalized to midnight UTC
// here so nothing ever stores whatever wall-clock time the request happened
// to be made at. Shared by every module (Sale, Purchase, Supplier, stock
// batches, ...) that accepts a date string from the client.
export const toDateOnly = (value: string | Date): Date => {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

// The API-response side of the same idea: Mongoose Dates always serialize
// to full ISO timestamps ("...T00:00:00.000Z") over JSON even when the
// stored value is midnight UTC — which reads as "date and time" to anyone
// looking at the raw response. Mappers call this on every calendar-date
// field (never on createdAt/updatedAt, which are real timestamps) so the
// API itself only ever returns a plain "YYYY-MM-DD" string.
export const formatDateOnly = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};
