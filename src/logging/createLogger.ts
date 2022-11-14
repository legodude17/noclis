import procLogger from "proc-log";

export type Logger = typeof procLogger;
export type LogLevel = typeof procLogger.LEVELS extends Array<infer U>
  ? U
  : never;

function createLogMethod(level: LogLevel, name: string) {
  // @ts-expect-error Doesn't understand emit
  return (...args: unknown[]) => process.emit("log", level, name, ...args);
}

export default function createLogger(name: string): Logger {
  const logger: Partial<Logger> = {};
  for (const level of procLogger.LEVELS) {
    logger[level] = createLogMethod(level, name);
  }
  return logger as Logger;
}
