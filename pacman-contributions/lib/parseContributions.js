import { EMPTY_CELL_DATE, TOTAL_CELLS } from "./constants.js";

export function countToLevel(count) {
  if (count <= 0) {
    return 0;
  }

  if (count <= 3) {
    return 1;
  }

  if (count <= 6) {
    return 2;
  }

  if (count <= 9) {
    return 3;
  }

  return 4;
}

function createEmptyCell() {
  return {
    date: EMPTY_CELL_DATE,
    count: 0,
    level: 0,
  };
}

export function normalizeContributions(contributions = []) {
  const normalized = Array.isArray(contributions)
    ? contributions
        .filter((item) => item && typeof item.date === "string")
        .map((item) => {
          const count = Number.isFinite(item.count) ? Math.max(0, item.count) : 0;
          const level = Number.isFinite(item.level)
            ? Math.min(4, Math.max(0, item.level))
            : countToLevel(count);

          return {
            date: item.date,
            count,
            level,
          };
        })
        .sort((left, right) => left.date.localeCompare(right.date))
    : [];

  if (normalized.length > TOTAL_CELLS) {
    return normalized.slice(normalized.length - TOTAL_CELLS);
  }

  if (normalized.length < TOTAL_CELLS) {
    return Array.from({ length: TOTAL_CELLS - normalized.length }, createEmptyCell).concat(
      normalized,
    );
  }

  return normalized;
}
