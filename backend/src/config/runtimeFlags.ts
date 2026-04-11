/**
 * API_PERF_LOG is dev-friendly; production needs an explicit opt-in so deploy envs
 * don’t accidentally ship verbose timing for every request.
 */
export function isApiPerfLoggingEnabled(): boolean {
  const want =
    process.env.API_PERF_LOG === '1' || process.env.API_PERF_LOG === 'true';
  const allowInProduction =
    process.env.API_PERF_IN_PRODUCTION === '1' ||
    process.env.API_PERF_IN_PRODUCTION === 'true';
  return (
    want && (process.env.NODE_ENV !== 'production' || allowInProduction)
  );
}
