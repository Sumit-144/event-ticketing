/** class-transformer helper: trims strings, leaves other types for the validators to reject. */
export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;