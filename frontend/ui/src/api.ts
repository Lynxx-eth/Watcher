/**
 * Shared fetch wrapper. All authentication decisions happen on the backend;
 * the frontends never compare IDs, PINs or passwords themselves.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function createApi(base: string) {
  return async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        ...init,
        credentials: "include", // httpOnly session cookie set by the backend
        // X-Watcher-Request is required by the backend's CSRF check on state-changing requests.
        // FormData sets its own multipart Content-Type (with boundary), so don't override it.
        headers: {
          ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
          "X-Watcher-Request": "1",
          ...(init.headers ?? {}),
        },
      });
    } catch {
      throw new ApiError(0, "AUTH SERVICE UNREACHABLE");
    }
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const body = (await res.json()) as { detail?: string | Array<{ msg: string; loc?: unknown[] }> };
        if (typeof body.detail === "string") msg = body.detail;
        // FastAPI validation errors: surface the first message, minus pydantic's "Value error, " prefix.
        else if (Array.isArray(body.detail) && body.detail[0]?.msg) msg = body.detail[0].msg.replace(/^Value error, /, "");
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(res.status, msg);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  };
}
