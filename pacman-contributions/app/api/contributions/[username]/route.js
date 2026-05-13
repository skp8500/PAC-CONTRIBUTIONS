import { CACHE_TTL } from "../../../../lib/constants.js";
import { getCache, setCache } from "../../../../lib/cache.js";
import { fetchGraphQL } from "../../../../lib/fetchGraphQL.js";
import { fetchPublicSVG } from "../../../../lib/fetchPublicSVG.js";
import { logger } from "../../../../lib/logger.js";
import { normalizeContributions } from "../../../../lib/parseContributions.js";
import { validateUsername } from "../../../../lib/validators.js";

export const runtime = "nodejs";

function buildHeaders(cacheState) {
  return {
    "Cache-Control": `public, max-age=${Math.floor(CACHE_TTL / 1000)}`,
    "Content-Type": "application/json; charset=utf-8",
    "X-Cache": cacheState,
  };
}

function jsonResponse(body, status, cacheState = "MISS") {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildHeaders(cacheState),
  });
}

function buildErrorPayload(message) {
  return { error: message };
}

function pickFailureStatus(svgResult, graphqlResult) {
  const statuses = [svgResult?.status, graphqlResult?.status];

  if (statuses.includes("not_found")) {
    return 404;
  }

  if (statuses.includes("rate_limited")) {
    return 429;
  }

  return 500;
}

export async function GET(_, { params }) {
  const username = params?.username;

  if (!validateUsername(username)) {
    return jsonResponse(buildErrorPayload("Invalid GitHub username."), 400);
  }

  const cacheKey = `contributions:${username.toLowerCase()}`;
  const cachedPayload = await getCache(cacheKey);

  if (cachedPayload) {
    return jsonResponse(
      {
        ...cachedPayload,
        cached: true,
      },
      200,
      "HIT",
    );
  }

  let source = null;
  let rawContributions = null;

  const svgResult = await fetchPublicSVG(username);

  if (svgResult.ok) {
    source = "svg";
    rawContributions = svgResult.contributions;
  } else {
    logger.info("Falling back to GraphQL contribution fetch.", {
      username,
      svgStatus: svgResult.status,
    });

    const graphqlResult = await fetchGraphQL(username);

    if (graphqlResult.ok) {
      source = "graphql";
      rawContributions = graphqlResult.contributions;
    } else {
      const status = pickFailureStatus(svgResult, graphqlResult);
      const message =
        status === 404
          ? "GitHub user not found."
          : status === 429
            ? "GitHub rate limit exceeded."
            : "Failed to fetch contributions.";

      return jsonResponse(buildErrorPayload(message), status);
    }
  }

  try {
    const contributions = normalizeContributions(rawContributions);
    const totalContributions = contributions.reduce((sum, item) => sum + item.count, 0);
    const payload = {
      username,
      source,
      cached: false,
      generatedAt: new Date().toISOString(),
      totalContributions,
      contributions,
    };

    await setCache(cacheKey, payload);

    return jsonResponse(payload, 200);
  } catch (error) {
    logger.error("Contribution route failed during normalization.", {
      username,
      error,
    });

    return jsonResponse(buildErrorPayload("Failed to fetch contributions."), 500);
  }
}
