// The one place that talks to the backend: base URL, timeout, JSON parsing, error mapping.

import type {
  ErrorCode,
  ErrorResponse,
  FeatureValue,
  FieldError,
  MetaResponse,
  PredictResponse,
  SamplesResponse,
} from "./types";

const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "/api";
export const TIMEOUT_MS = 10_000;

export type ApiErrorCode = ErrorCode | "NETWORK_ERROR";

/** Every failure of an API call is one of these; a raw Response or fetch error never escapes. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly details?: FieldError[];

  constructor(code: ApiErrorCode, message: string, details?: FieldError[]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

function isErrorResponse(body: unknown): body is ErrorResponse {
  const error = (body as ErrorResponse | null)?.error;
  return typeof error?.code === "string" && typeof error?.message === "string";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  let body: unknown;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      credentials: "omit",
      signal: controller.signal,
    });
    body = await response.json().catch(() => undefined);
  } catch {
    const message = controller.signal.aborted
      ? "The model service took too long to answer."
      : "The model service could not be reached.";
    throw new ApiError("NETWORK_ERROR", message);
  } finally {
    clearTimeout(timer);
  }

  if (isErrorResponse(body)) {
    throw new ApiError(body.error.code, body.error.message, body.error.details);
  }
  if (!response.ok || body === undefined) {
    // Not our API's envelope, so the answer came from something in between (a proxy, a gateway).
    throw new ApiError("NETWORK_ERROR", `The model service did not answer (HTTP ${response.status}).`);
  }
  return body as T;
}

export function getMeta(): Promise<MetaResponse> {
  return request<MetaResponse>("/meta");
}

export function getSamples(): Promise<SamplesResponse> {
  return request<SamplesResponse>("/samples");
}

export function predict(features: Record<string, FeatureValue>): Promise<PredictResponse> {
  return request<PredictResponse>("/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ features }),
  });
}

/** Anything thrown while calling the API, as an ApiError. */
export function toApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError("NETWORK_ERROR", "The model service could not be reached.");
}
