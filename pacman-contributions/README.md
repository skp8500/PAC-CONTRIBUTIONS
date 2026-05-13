# PAC-CONTRIBUTIONS

PAC-CONTRIBUTIONS is a production-ready Next.js 14 backend for a public GitHub contribution visualizer. It fetches real GitHub contribution data, normalizes it into a fixed 53 x 7 grid, caches responses, and exposes a frontend-safe API for the Pac-Man animation layer.

## Features

- Public GitHub contribution graph ingestion via SVG
- GraphQL fallback with optional `GITHUB_TOKEN`
- Fixed-size 371-cell normalized output
- In-memory caching with TTL and optional Upstash Redis support
- Vercel-ready Node.js API route
- Username validation, error handling, and safe server-side token usage

## Architecture Overview

The backend is organized around a simple ingestion pipeline:

1. `GET /api/contributions/[username]` validates input and checks the cache.
2. The server tries GitHub's public SVG endpoint first.
3. If SVG fetching or parsing fails, it falls back to GitHub GraphQL when `GITHUB_TOKEN` is configured.
4. Contribution cells are normalized into exactly 371 entries.
5. The payload is cached and returned to the frontend.

Core modules:

- `app/api/contributions/[username]/route.js`: main API handler
- `lib/cache.js`: in-memory cache with optional Upstash support
- `lib/fetchPublicSVG.js`: public GitHub SVG ingestion
- `lib/fetchGraphQL.js`: authenticated GitHub GraphQL fallback
- `lib/parseContributions.js`: sorting, padding, trimming, and level normalization
- `lib/validators.js`: username validation
- `lib/logger.js`: structured backend logging

## Project Structure

```text
pacman-contributions/
├── app/
│   ├── api/
│   │   └── contributions/
│   │       └── [username]/
│   │           └── route.js
│   ├── layout.jsx
│   └── page.jsx
├── lib/
│   ├── cache.js
│   ├── constants.js
│   ├── fetchGraphQL.js
│   ├── fetchPublicSVG.js
│   ├── logger.js
│   ├── parseContributions.js
│   └── validators.js
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── vercel.json
```

`app/layout.jsx` is included because Next.js App Router requires a root layout to build successfully.

## Setup

### Prerequisites

- Node.js 18.17 or newer
- npm 9 or newer

### Install

```bash
npm install
```

### Environment Variables

Create a local environment file from `.env.example`:

```bash
cp .env.example .env.local
```

Supported variables:

- `GITHUB_TOKEN`: optional GitHub token for GraphQL fallback
- `UPSTASH_REDIS_REST_URL`: optional Upstash REST URL for distributed caching
- `UPSTASH_REDIS_REST_TOKEN`: optional Upstash REST token for distributed caching

Only `GITHUB_TOKEN` is required for GraphQL fallback. The public SVG path works without authentication.

## Local Development

Start the development server:

```bash
npm run dev
```

Open the API directly:

```bash
http://localhost:3000/api/contributions/torvalds
```

## API

### Endpoint

```http
GET /api/contributions/[username]
```

Example:

```http
GET /api/contributions/torvalds
```

### Success Response

```json
{
  "username": "torvalds",
  "source": "svg",
  "cached": false,
  "generatedAt": "2026-05-13T12:00:00.000Z",
  "totalContributions": 1823,
  "contributions": [
    {
      "date": "2026-01-01",
      "count": 12,
      "level": 4
    }
  ]
}
```

### Response Notes

- `contributions` always contains exactly `371` cells.
- `source` is either `svg` or `graphql`.
- `cached` indicates whether the response body came from cache.
- `generatedAt` is the server-side generation timestamp of the cached payload.

### Error Responses

- `400`: invalid username
- `404`: GitHub user not found
- `429`: rate limited by upstream source
- `500`: contribution data could not be fetched

Every error response is JSON and the API never intentionally crashes the request.

## Cache Explanation

The backend uses a two-tier strategy:

1. An in-memory cache stores payloads for one hour.
2. If Upstash REST credentials are configured, the same payload is also stored in Redis for cross-instance reuse on Vercel.

Cache behavior:

- TTL: 1 hour
- Request cache header: `Cache-Control: public, max-age=3600`
- Cache hit header: `X-Cache: HIT`
- Cache miss header: `X-Cache: MISS`

This reduces repeated upstream requests and helps avoid GitHub abuse limits.

## Deployment

### Vercel Steps

1. Push the repository to GitHub.
2. Import the project into Vercel.
3. Set the Root Directory to `pacman-contributions` if deploying from the parent repository.
4. Add environment variables in the Vercel dashboard:
   - `GITHUB_TOKEN` for GraphQL fallback
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` if using shared cache
5. Deploy.

### Why It Works on Vercel

- Uses Next.js 14 App Router
- Forces `nodejs` runtime for Cheerio compatibility
- Keeps tokens server-side only
- Uses native `fetch` and Vercel-compatible REST calls

## Security

- GitHub tokens never leave the server
- User input is validated before any upstream request
- Invalid usernames are rejected immediately
- Responses are sanitized to contain only normalized public contribution data

## Maintenance Notes

- SVG is the primary source because it works for public users without authentication.
- GraphQL is a fallback path when SVG is unavailable and a token is configured.
- The normalizer guarantees a frontend-safe fixed-size grid, even when GitHub returns too few or too many cells.
