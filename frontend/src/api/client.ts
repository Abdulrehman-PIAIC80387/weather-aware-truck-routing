export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorBody {
  detail?: string;
  [field: string]: unknown;
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response));
  }
  return (await response.json()) as T;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody;
    if (body.detail) return body.detail;
    return Object.entries(body)
      .map(([field, messages]) => `${field}: ${([] as unknown[]).concat(messages).join(" ")}`)
      .join("; ");
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}
