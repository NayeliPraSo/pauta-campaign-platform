const API_URL = import.meta.env.PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | Record<string, unknown> | null;
}

export async function apiFetch<T>(
  endpoint: string,
  options: ApiOptions = {},
): Promise<T> {
  const { body, headers, ...rest } = options;

  const requestHeaders = new Headers(headers);

  let requestBody: BodyInit | null | undefined = body as
    | BodyInit
    | null
    | undefined;

  if (
    body !== null &&
    body !== undefined &&
    typeof body === "object" &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof URLSearchParams)
  ) {
    requestHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...rest,
      headers: requestHeaders,
      body: requestBody,
      credentials: "include",
    },
  );

  if (!response.ok) {
    let message = `Error HTTP ${response.status}`;

    try {
      const errorData = await response.json();

      if (
        typeof errorData?.message === "string"
      ) {
        message = errorData.message;
      }
    } catch {
      // La respuesta no contiene JSON válido.
    }

    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}