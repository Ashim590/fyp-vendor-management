/** Escape a string for safe use inside a RegExp. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive exact email match (handles legacy mixed-case rows in MongoDB). */
export function emailMatchFilter(normalizedLowerEmail: string) {
  return {
    email: {
      $regex: new RegExp(`^${escapeRegex(normalizedLowerEmail)}$`, "i"),
    },
  };
}
