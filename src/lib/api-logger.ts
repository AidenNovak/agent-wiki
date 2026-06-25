/**
 * Lightweight server-side logger for API routes.
 * Writes to stderr (captured by launchd → /tmp/agent-explorer.log).
 */

type Level = "info" | "warn" | "error";

function log(level: Level, msg: string, ctx?: object) {
  const ts = new Date().toISOString();
  const line = ctx
    ? `${ts} [${level.toUpperCase()}] ${msg} ${JSON.stringify(ctx)}`
    : `${ts} [${level.toUpperCase()}] ${msg}`;
  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  info: (msg: string, ctx?: object) => log("info", msg, ctx),
  warn: (msg: string, ctx?: object) => log("warn", msg, ctx),
  error: (msg: string, ctx?: object) => log("error", msg, ctx),
};

/** Wrap an async route handler with try/catch + logging. */
export function withErrorHandling<T>(
  handler: () => Promise<T>,
  label: string
): Promise<T | Response> {
  return handler().catch((e: unknown) => {
    logger.error(`${label} failed`, {
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split("\n")[1]?.trim() : undefined,
    });
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    ) as unknown as T;
  });
}
