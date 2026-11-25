export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const response = await fetch(path, {
    method,
    signal,
    cache: "no-store",
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      window.dispatchEvent(
        new CustomEvent("lantern-access-changed", {
          detail: { status: response.status },
        }),
      );
    const message = await response.json().catch(() => null);
    throw new ApiError(message?.error ?? "The request failed. Please try again.", response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
