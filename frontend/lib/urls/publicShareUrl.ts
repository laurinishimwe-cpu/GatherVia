const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

/**
 * Keep backend-provided share paths, but never expose a backend development
 * origin from a deployed browser. Local development remains unchanged.
 */
export function resolvePublicShareUrl(value: string): string {
  if (typeof window === "undefined") return value;

  try {
    const suppliedUrl = new URL(value);
    const currentUrl = new URL(window.location.origin);
    if (
      LOCAL_HOSTNAMES.has(suppliedUrl.hostname) &&
      !LOCAL_HOSTNAMES.has(currentUrl.hostname)
    ) {
      return new URL(
        `${suppliedUrl.pathname}${suppliedUrl.search}${suppliedUrl.hash}`,
        currentUrl,
      ).href;
    }
  } catch {
    return new URL(value, window.location.origin).href;
  }

  return value;
}
