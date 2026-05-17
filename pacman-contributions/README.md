# PAC-CONTRIBUTIONS

PAC-CONTRIBUTIONS turns a GitHub contribution graph into an animated Pac-Man experience. It combines a Next.js frontend, a production-ready contribution ingestion API, caching, normalization, and a GitHub Actions workflow path for profile README automation.

![License](https://img.shields.io/github/license/skp8500/PAC-CONTRIBUTIONS)
![Stars](https://img.shields.io/github/stars/skp8500/PAC-CONTRIBUTIONS)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000)

## Preview / Demo

Live demo:

- [pac-contributions.vercel.app](https://pac-contributions.vercel.app/)

Suggested visual section for the repository root:

```md
![Preview](assets/demo.gif)
```

You can also use screenshots from the live app UI to showcase:

- animated Pac-Man movement
- ghost-eating contribution cells
- README embed workflow

## Features

- Animated Pac-Man contribution graph based on real GitHub data
- Public GitHub contributions ingestion with GraphQL fallback
- Dark and light mode support
- Fixed 53 x 7 normalized contribution grid
- Frontend-ready JSON API for external consumers
- Vercel-ready Next.js 14 deployment
- In-memory cache with optional Upstash Redis support
- GitHub profile README workflow support
- Daily automation support through GitHub Actions
- Custom pixel-art Pac-Man animation and ghost-eat effects

## Installation

1. Clone the repository.

```bash
git clone https://github.com/skp8500/PAC-CONTRIBUTIONS.git
cd PAC-CONTRIBUTIONS/pacman-contributions
```

2. Install dependencies.

```bash
npm install
```

3. Create a local environment file.

```bash
cp .env.example .env.local
```

4. Add your optional environment variables.

```env
GITHUB_TOKEN=ghp_your_token_here
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

5. Start the development server.

```bash
npm run dev
```

6. Open the app in your browser.

```text
http://localhost:3000
```

## Usage

Enter any public GitHub username in the UI and generate a live Pac-Man visualization of that user’s contribution graph.

The app will:

- fetch contribution data from GitHub
- normalize it into a 371-cell grid
- animate Pac-Man across the board
- expose the same data through the backend API

Example API request:

```http
GET /api/contributions/torvalds
```

Example response:

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

## Configuration

Environment variables:

- `GITHUB_TOKEN`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Notes:

- `GITHUB_TOKEN` enables GitHub GraphQL fallback when the public contribution page is unavailable or changes format.
- Upstash variables are optional and only needed if you want shared cache across serverless instances.
- The API always returns exactly `371` contribution cells.

Vercel settings:

- Root Directory: `pacman-contributions`
- Framework Preset: `Next.js`
- Output Directory: leave empty

## Tech Stack

- Next.js 14
- JavaScript
- React
- Node.js runtime
- Cheerio
- GitHub public contribution markup
- GitHub GraphQL API
- Vercel
- GitHub Actions

## Project Structure

```text
pacman-contributions/
├── app/
│   ├── api/
│   │   └── contributions/
│   │       └── [username]/
│   │           └── route.js
│   ├── globals.css
│   ├── icon.svg
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
├── package.json
├── README.md
└── vercel.json
```

## GitHub README Automation

If you want to use this project for a GitHub profile README animation workflow, create this file in your profile repository:

```text
.github/workflows/pacman.yml
```

Use this workflow:

```yaml
name: Generate Pac-Man

on:
  schedule:
    - cron: "17 3 * * *"
    - cron: "47 15 * * *"

  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: generate-pacman-svg
  cancel-in-progress: true

jobs:
  generate:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v5

      - uses: skp8500/PAC-CONTRIBUTIONS@main
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

Then enable:

```text
Repository → Settings → Actions → General → Read and write permissions
```

The action now writes a tiny heartbeat file to the `output` branch on every scheduled run, which helps keep the repository active so GitHub is less likely to disable the schedule for inactivity.

## Deployment

Deploy on Vercel:

1. Push your code to GitHub.
2. Import the repository into Vercel.
3. Set the Root Directory to `pacman-contributions`.
4. Confirm the Framework Preset is `Next.js`.
5. Leave Output Directory empty.
6. Add environment variables.
7. Deploy.

After deployment, test both:

```text
/
/api/contributions/skp8500
```

## Contributing

Pull requests are welcome.

For major changes, please open an issue first to discuss what you would like to change.

When contributing:

- keep the API response shape stable
- preserve the fixed 371-cell normalization rule
- avoid exposing secrets to the client
- test both the UI and the API route

## License

MIT License

## References

- [GitHub README Guide](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)
- [Awesome README Examples](https://github.com/matiassingers/awesome-readme)
- [Shields.io Badges](https://shields.io/)
