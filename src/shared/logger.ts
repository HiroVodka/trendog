export interface Logger {
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
}

function emit(level: string, message: string, extra?: Record<string, unknown>): void {
  const payload = {
    level,
    message,
    ...extra,
    timestamp: new Date().toISOString()
  };
  console.log(JSON.stringify(payload));
}

export const consoleLogger: Logger = {
  info: (message, extra) => emit("info", message, extra),
  warn: (message, extra) => emit("warn", message, extra),
  error: (message, extra) => emit("error", message, extra)
};
