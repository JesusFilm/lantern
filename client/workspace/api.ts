export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method,
    signal,
    cache: "no-store",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
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
    throw new Error(message?.error ?? "The request failed. Please try again.");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
