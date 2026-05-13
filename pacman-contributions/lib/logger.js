const PREFIX = "[PAC-BACKEND]";

function log(level, ...args) {
  const upperLevel = String(level || "INFO").toUpperCase();
  console[upperLevel === "ERROR" ? "error" : upperLevel === "WARN" ? "warn" : "log"](
    `${PREFIX}[${upperLevel}]`,
    ...args,
  );
}

export const logger = {
  info: (...args) => log("INFO", ...args),
  warn: (...args) => log("WARN", ...args),
  error: (...args) => log("ERROR", ...args),
};
