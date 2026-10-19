type ErrorWithStatus = { response?: { status?: unknown } };

/** HTTP status of an axios-like error; undefined for network errors/timeouts. */
export const getHttpStatus = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const status = (error as ErrorWithStatus).response?.status;
  return typeof status === 'number' ? status : undefined;
};
