import * as cheerio from "cheerio";

import {
  GITHUB_SVG_URL,
  REQUEST_TIMEOUT,
  SVG_LEVEL_TO_COUNT,
  USER_AGENT,
} from "./constants.js";
import { logger } from "./logger.js";

export async function fetchPublicSVG(username) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const url = `${GITHUB_SVG_URL}/${encodeURIComponent(username)}/contributions`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      logger.warn("SVG fetch failed.", { username, status: response.status });
      return {
        ok: false,
        status: response.status === 404 ? "not_found" : response.status === 429 ? "rate_limited" : "failed",
        contributions: null,
      };
    }

    const svgMarkup = await response.text();
    const $ = cheerio.load(svgMarkup);
    const cells = [];

    $(".ContributionCalendar-day").each((_, element) => {
      const date = $(element).attr("data-date");
      const rawLevel = Number.parseInt($(element).attr("data-level") ?? "", 10);

      if (!date || Number.isNaN(rawLevel)) {
        return;
      }

      const level = Math.min(4, Math.max(0, rawLevel));

      cells.push({
        date,
        count: SVG_LEVEL_TO_COUNT[level] ?? 0,
        level,
      });
    });

    if (!cells.length) {
      logger.warn("SVG parse returned no contribution cells.", { username });
      return {
        ok: false,
        status: "empty",
        contributions: null,
      };
    }

    return {
      ok: true,
      status: "success",
      contributions: cells,
    };
  } catch (error) {
    const isAbort = error?.name === "AbortError";
    logger.warn("SVG fetch threw an error.", { username, isAbort, error });

    return {
      ok: false,
      status: isAbort ? "timeout" : "failed",
      contributions: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}
