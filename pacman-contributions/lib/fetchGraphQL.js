import { GITHUB_GRAPHQL_URL, REQUEST_TIMEOUT, TOTAL_CELLS, USER_AGENT } from "./constants.js";
import { logger } from "./logger.js";
import { countToLevel } from "./parseContributions.js";

const QUERY = `
  query($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              color
            }
          }
        }
      }
    }
  }
`;

function getDateRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 53 * 7 * 24 * 60 * 60 * 1000);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export async function fetchGraphQL(username) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return {
      ok: false,
      status: "missing_token",
      contributions: null,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const { from, to } = getDateRange();

  try {
    const response = await fetch(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        query: QUERY,
        variables: {
          username,
          from,
          to,
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403 || response.status === 429) {
      logger.warn("GraphQL rate limit or auth failure.", { username, status: response.status });
      return {
        ok: false,
        status: response.status === 401 ? "unauthorized" : "rate_limited",
        contributions: null,
      };
    }

    if (!response.ok) {
      logger.warn("GraphQL fetch failed.", { username, status: response.status });
      return {
        ok: false,
        status: response.status === 404 ? "not_found" : "failed",
        contributions: null,
      };
    }

    const payload = await response.json();

    if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
      const errorMessage = payload.errors.map((item) => item?.message).join(" | ");
      logger.warn("GraphQL returned errors.", { username, errorMessage });

      const isRateLimited = /rate limit/i.test(errorMessage);

      return {
        ok: false,
        status: isRateLimited ? "rate_limited" : "failed",
        contributions: null,
      };
    }

    const weeks =
      payload?.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? null;

    if (!Array.isArray(weeks)) {
      if (payload?.data?.user === null) {
        return {
          ok: false,
          status: "not_found",
          contributions: null,
        };
      }

      return {
        ok: false,
        status: "failed",
        contributions: null,
      };
    }

    const contributions = weeks
      .flatMap((week) => week?.contributionDays ?? [])
      .slice(-TOTAL_CELLS)
      .map((day) => {
        const count = Number(day?.contributionCount) || 0;

        return {
          date: day?.date,
          count,
          level: countToLevel(count),
        };
      })
      .filter((day) => typeof day.date === "string");

    if (!contributions.length) {
      return {
        ok: false,
        status: "empty",
        contributions: null,
      };
    }

    return {
      ok: true,
      status: "success",
      contributions,
    };
  } catch (error) {
    const isAbort = error?.name === "AbortError";
    logger.warn("GraphQL fetch threw an error.", { username, isAbort, error });

    return {
      ok: false,
      status: isAbort ? "timeout" : "failed",
      contributions: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}
