export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: { field: string; message: string }[];

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: { field: string; message: string }[],
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function errorJson(error: unknown, requestId: string): { status: number; body: unknown } {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        code: error.code,
        message: error.message,
        request_id: requestId,
        field_errors: error.fieldErrors,
      },
    };
  }
  console.error(
    JSON.stringify({
      request_id: requestId,
      code: "internal_error",
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 6) : undefined,
    }),
  );
  return {
    status: 500,
    body: {
      code: "internal_error",
      message: "Something went wrong. Try again.",
      request_id: requestId,
    },
  };
}

export function jsonError(error: unknown, requestId = crypto.randomUUID()): Response {
  const result = errorJson(error, requestId);
  return Response.json(result.body, { status: result.status });
}

export function assertSameOrigin(request: Request): void {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "none") return;
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) {
    throw new AppError(403, "origin_required", "This action must come from the Pikajobs site.");
  }
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError(403, "origin_required", "This action must come from the Pikajobs site.");
  }
  if (originHost !== host) {
    throw new AppError(403, "origin_mismatch", "This action must come from the Pikajobs site.");
  }
}

export function safeReturnPath(value: string | null | undefined): string {
  if (!value) return "/feed";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://") || value.includes("\\")) {
    return "/feed";
  }
  return value;
}
