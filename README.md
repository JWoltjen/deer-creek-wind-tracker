# Deer Creek Kite-Wind Tracker

Collects Barbed Wire Beach wind observations plus HRRR/ECMWF/GFS/NWS forecasts and
shows whether it's good to ride, the daily pattern, and how wrong each forecast is.

## How it works
- `collectors/` — .NET console app; GitHub Actions runs it (obs every 5 min, forecasts hourly),
  appending to `data/*.ndjson`.
- `web/` — React+Vite dashboard on GitHub Pages; fetches the raw `data/*.ndjson` at runtime.

## Local dev
- Collectors: `dotnet test collectors/Collectors.sln` and
  `dotnet run --project collectors/src/Collectors -- observations .`
- Web: `cd web && npm install && npm run dev`

## Setup notes
- Repo must be **public** and GitHub Pages set to "GitHub Actions" source.
- Set `web/src/config.ts` `dataBaseUrl` to your username's raw URL.

**Manual deploy steps (required before the site will work):**
1. In `web/src/config.ts`, replace `<user>` in `dataBaseUrl` with your GitHub username
   (e.g., `https://raw.githubusercontent.com/yourname/deer-creek-wind-tracker/main/data/`).
2. In your GitHub repo: Settings → Pages → Source → select **"GitHub Actions"**.

## Tuning "good wind"
Edit the thresholds in `web/src/config.ts` (speed band, steadiness, ideal directions).
