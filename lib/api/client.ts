export type ApiFailure = {
  error?: { code?: string; message?: string };
};

export async function getApiData<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = (await response.json()) as T | ApiFailure;

  if (!response.ok) {
    const failure = payload as ApiFailure;
    throw new Error(
      failure.error?.message ?? "We could not load this right now.",
    );
  }

  return payload as T;
}
