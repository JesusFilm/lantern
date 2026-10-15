export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const message = await response.json().catch(() => null);
    throw new Error(message?.error ?? "The request failed. Please try again.");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
