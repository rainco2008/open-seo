import { AppError } from "@/server/lib/errors";

export type GoogleAdsErrorKind =
  | "authentication"
  | "permission"
  | "rate_limit"
  | "validation"
  | "upstream";

export class GoogleAdsApiError extends Error {
  constructor(
    public readonly kind: GoogleAdsErrorKind,
    message: string,
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "GoogleAdsApiError";
  }
}

export function toGoogleAdsAppError(error: unknown) {
  if (!(error instanceof GoogleAdsApiError)) return error;

  const details = error.requestId ? { requestId: error.requestId } : undefined;
  switch (error.kind) {
    case "authentication":
      return new AppError("UNAUTHENTICATED", error.message, details);
    case "permission":
      return new AppError("FORBIDDEN", error.message, details);
    case "rate_limit":
      return new AppError("RATE_LIMITED", error.message, details);
    case "validation":
      return new AppError("VALIDATION_ERROR", error.message, details);
    default:
      return new AppError("UPSTREAM_UNAVAILABLE", error.message, details);
  }
}
