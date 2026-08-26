/**
 * Shared helpers for building server-side search + filter conditions on
 * list (`getAll`) endpoints, so search/filtering never has to happen
 * client-side.
 */

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Builds a case-insensitive `$or` regex condition across the given fields.
 * Returns `{}` (no-op) when `search` is empty, so it can always be spread
 * into a query object safely.
 */
export const buildSearchCondition = (
  search: string | undefined | null,
  fields: string[]
): Record<string, unknown> => {
  if (!search || !search.trim()) return {};
  const regex = new RegExp(escapeRegex(search.trim()), "i");
  return { $or: fields.map((field) => ({ [field]: regex })) };
};

/**
 * Builds an exact-match condition for a set of `{queryField: dbField}`
 * pairs, skipping any that are absent/empty on the incoming query object.
 * Keeps controller/service getAll functions from repeating the same
 * `if (query.x) filter.x = query.x` boilerplate per field.
 */
/**
 * Extracts display fields from a `.populate("employeeId", "first_name last_name employeeCode")`
 * result. Works transparently against the unpopulated (plain ObjectId) case
 * too, returning nulls — so mappers can call this unconditionally.
 */
export const populatedEmployeeFields = (
  value: unknown
): { id: string | null; name: string | null; code: string | null } => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return { id: value ? String(value) : null, name: null, code: null };
  if (!("first_name" in doc)) return { id: String(value), name: null, code: null };
  const name = `${doc.first_name || ""} ${doc.last_name || ""}`.toString().trim();
  return { id: doc._id ? String(doc._id) : null, name: name || null, code: (doc.employeeCode as string) || null };
};

export const buildExactFilters = (
  query: Record<string, unknown>,
  fieldMap: Record<string, string>
): Record<string, unknown> => {
  const conditions: Record<string, unknown> = {};
  Object.entries(fieldMap).forEach(([queryField, dbField]) => {
    const value = query[queryField];
    if (value !== undefined && value !== null && value !== "") {
      conditions[dbField] = value;
    }
  });
  return conditions;
};
