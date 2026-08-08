# Deer Creek Kite-Wind Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A free, no-server website that continuously logs Barbed Wire Beach wind observations plus multiple forecasts, and shows whether it's good to ride now, the multi-day pattern, and how wrong each forecast is for Deer Creek.

**Architecture:** C#/.NET console collectors run on a GitHub Actions cron, parse the aggregator page and forecast APIs, and append raw rows to NDJSON files committed to the repo. A React+Vite static site on GitHub Pages fetches those NDJSON files at runtime and computes all analytics (classification, hour-of-day pattern, forecast-vs-actual, model scoreboard) in the browser. Collectors stay "dumb"; all interpretation is config-driven in the web app.

**Tech Stack:** .NET 8 (C#, xUnit, HtmlAgilityPack, System.Text.Json), React 18 + Vite + TypeScript, Vitest + React Testing Library, Recharts, GitHub Actions, GitHub Pages.

## Global Constraints

- **.NET version:** net8.0 (LTS; available on GitHub Actions `ubuntu-latest`).
- **Node version:** 20.x (matches `actions/setup-node@v4` and local nvm `v20.19.3`).
- **Timezone:** all observation/forecast times normalized to `America/Denver`.
- **Data files are append-only NDJSON.** Never rewrite or reorder history. On any fetch/parse failure, write nothing.
- **Location:** latitude `40.4471`, longitude `-111.4776`; NWS grid `SLC 113,159`.
- **Observations source:** `http://65.130.252.76:90/fastDC.htm` — parse the FIRST `<table>` (header text contains "Barbed Wire Beach").
- **Repo is public** (free unlimited Actions minutes; data is non-sensitive).
- **Commit style:** small, frequent commits; conventional-commit prefixes (`feat:`, `test:`, `chore:`, `ci:`).
- **NDJSON schemas (verbatim):**
  - observations: `{"time":"<iso±offset>","tempF":<int>,"dir":"<compass>","low":<int>,"high":<int>}`
  - forecasts: `{"fetchedAt":"<iso±offset>","source":"<open-meteo|nws>","model":"<hrrr|ecmwf|gfs|nws>","validTime":"<iso>","windMph":<number>,"gustMph":<number|null>,"dirDeg":<int|null>}`

---

## File Structure

```
collectors/                         # .NET solution
  Collectors.sln
  src/Collectors/Collectors.csproj   # console app, entry: Program.cs
    Program.cs                       # dispatch on argv[0]: "observations"|"forecasts"
    BeachObservation.cs              # record + parser (HTML -> rows)
    TimeNormalizer.cs                # MT + year-rollover -> DateTimeOffset
    NdjsonStore.cs                   # generic append-with-dedup
    ForecastRow.cs                   # record
    OpenMeteoParser.cs               # JSON -> ForecastRow[]
    NwsParser.cs                     # JSON -> ForecastRow[]
    CompassDegrees.cs                # "SW" -> 225
  test/Collectors.Tests/Collectors.Tests.csproj   # xUnit
    fixtures/fastDC.htm              # captured sample page
    fixtures/openmeteo.json          # captured sample response
    fixtures/nws-hourly.json         # captured sample response
    BeachObservationTests.cs
    TimeNormalizerTests.cs
    NdjsonStoreTests.cs
    OpenMeteoParserTests.cs
    NwsParserTests.cs
web/                                # React + Vite + TS
  package.json, vite.config.ts, tsconfig.json, index.html, vitest.config.ts
  public/data/observations.ndjson   # dev-only sample copies
  public/data/forecasts.ndjson
  src/
    config.ts                       # location + tunable thresholds
    types.ts                        # Observation, Forecast types
    ndjson.ts                       # parse ndjson text -> objects
    dataLoader.ts                   # fetch + parse both files
    classify.ts                     # category + direction rating
    analytics.ts                    # hour pattern, forecast-vs-actual, scoreboard
    components/{Verdict,HistoryChart,HourPattern,ForecastVsActual,ModelScoreboard,DataTable}.tsx
    App.tsx, main.tsx
data/                               # produced by Actions (committed)
  observations.ndjson
  forecasts.ndjson
.github/workflows/
  collect.yml
  deploy-web.yml
README.md
```

---

## Stage 0 — Collector scaffold & fixtures

### Task 1: .NET solution, project, and captured fixtures

**Files:**
- Create: `collectors/Collectors.sln`, `collectors/src/Collectors/Collectors.csproj`, `collectors/test/Collectors.Tests/Collectors.Tests.csproj`
- Create: `collectors/src/Collectors/Program.cs`
- Create fixtures: `collectors/test/Collectors.Tests/fixtures/{fastDC.htm,openmeteo.json,nws-hourly.json}`

**Interfaces:**
- Produces: a buildable solution with an xUnit test project referencing the app project; `Program.Main(string[])` exists.

- [ ] **Step 1: Scaffold solution and projects**

```bash
cd collectors
dotnet new sln -n Collectors
dotnet new console -n Collectors -o src/Collectors -f net8.0
dotnet new xunit -n Collectors.Tests -o test/Collectors.Tests -f net8.0
dotnet sln add src/Collectors/Collectors.csproj test/Collectors.Tests/Collectors.Tests.csproj
dotnet add test/Collectors.Tests/Collectors.Tests.csproj reference src/Collectors/Collectors.csproj
dotnet add src/Collectors/Collectors.csproj package HtmlAgilityPack --version 1.11.61
```

- [ ] **Step 2: Make the app class-visible to tests and set a minimal Program**

Replace `collectors/src/Collectors/Program.cs`:

```csharp
namespace Collectors;

public static class Program
{
    public static async Task<int> Main(string[] args)
    {
        var mode = args.Length > 0 ? args[0] : "";
        var repoRoot = args.Length > 1 ? args[1] : Directory.GetCurrentDirectory();
        return mode switch
        {
            "observations" => await ObservationsRunner.RunAsync(repoRoot),
            "forecasts"    => await ForecastRunner.RunAsync(repoRoot),
            _ => Fail($"unknown mode '{mode}', expected 'observations' or 'forecasts'"),
        };
    }

    private static int Fail(string msg)
    {
        Console.Error.WriteLine(msg);
        return 2;
    }
}
```

> `ObservationsRunner` / `ForecastRunner` are added in Tasks 5 and 8. Until then the project will not compile a runner; that is expected — early tasks build and test the library classes directly, and Task 5/8 wire the runners. To keep Stage 0 green, add temporary stubs now:

Create `collectors/src/Collectors/Runners.cs`:

```csharp
namespace Collectors;

public static class ObservationsRunner
{
    public static Task<int> RunAsync(string repoRoot) => Task.FromResult(0);
}

public static class ForecastRunner
{
    public static Task<int> RunAsync(string repoRoot) => Task.FromResult(0);
}
```

- [ ] **Step 3: Capture fixtures**

Save the current live responses as test fixtures (run once; commit the files):

```bash
curl -s "http://65.130.252.76:90/fastDC.htm" -o test/Collectors.Tests/fixtures/fastDC.htm
curl -s "https://api.open-meteo.com/v1/forecast?latitude=40.4471&longitude=-111.4776&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=mph&timezone=America%2FDenver&models=gfs_hrrr,ecmwf_ifs025,gfs_seamless" -o test/Collectors.Tests/fixtures/openmeteo.json
curl -s -H "User-Agent: kite-wind-tracker (Jeff.Woltjen@gmail.com)" "https://api.weather.gov/gridpoints/SLC/113,159/forecast/hourly" -o test/Collectors.Tests/fixtures/nws-hourly.json
```

- [ ] **Step 4: Mark fixtures to copy to test output**

In `collectors/test/Collectors.Tests/Collectors.Tests.csproj`, inside `<Project>`:

```xml
<ItemGroup>
  <Content Include="fixtures/**/*" CopyToOutputDirectory="PreserveNewest" />
</ItemGroup>
```

- [ ] **Step 5: Build and commit**

Run: `dotnet build collectors/Collectors.sln`
Expected: Build succeeded.

```bash
git add collectors
git commit -m "chore: scaffold .NET collectors solution and fixtures"
```

---

## Stage 1 — Observations collector

### Task 2: Parse the Barbed Wire Beach table

**Files:**
- Create: `collectors/src/Collectors/BeachObservation.cs`
- Test: `collectors/test/Collectors.Tests/BeachObservationTests.cs`

**Interfaces:**
- Produces: `public record RawBeachRow(string RawTime, int TempF, string Dir, int Low, int High);`
- Produces: `public static IReadOnlyList<RawBeachRow> BeachParser.Parse(string html)` — parses the FIRST table only, skips the header row, returns newest-first as on the page.

- [ ] **Step 1: Write the failing test**

```csharp
using Collectors;
using Xunit;

public class BeachObservationTests
{
    private static string Html() =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "fixtures", "fastDC.htm"));

    [Fact]
    public void Parses_ten_rows_from_first_table()
    {
        var rows = BeachParser.Parse(Html());
        Assert.Equal(10, rows.Count);
    }

    [Fact]
    public void Parses_range_and_single_value()
    {
        var rows = BeachParser.Parse(
            "<table><tr><td colspan='5'>Barbed Wire Beach 0 ft</td></tr>" +
            "<tr><td>08/08  02:44 PM</td><td>95</td><td>SW</td><td>15-20</td></tr>" +
            "<tr><td>08/08  02:42 PM</td><td>93</td><td>SW</td><td>18</td></tr></table>" +
            "<table><tr><td>ignored</td></tr></table>");
        Assert.Equal(2, rows.Count);
        Assert.Equal(15, rows[0].Low);
        Assert.Equal(20, rows[0].High);
        Assert.Equal(18, rows[1].Low);
        Assert.Equal(18, rows[1].High);   // single value -> low==high
        Assert.Equal("SW", rows[0].Dir);
        Assert.Equal(95, rows[0].TempF);
    }

    [Fact]
    public void Skips_rows_with_empty_speed()
    {
        var rows = BeachParser.Parse(
            "<table><tr><td colspan='5'>Barbed Wire Beach</td></tr>" +
            "<tr><td>08/08  02:44 PM</td><td>95</td><td></td><td></td></tr></table>");
        Assert.Empty(rows);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test collectors/Collectors.sln --filter BeachObservationTests`
Expected: FAIL (BeachParser / RawBeachRow not defined).

- [ ] **Step 3: Implement**

```csharp
using System.Globalization;
using HtmlAgilityPack;

namespace Collectors;

public record RawBeachRow(string RawTime, int TempF, string Dir, int Low, int High);

public static class BeachParser
{
    public static IReadOnlyList<RawBeachRow> Parse(string html)
    {
        var doc = new HtmlDocument();
        doc.LoadHtml(html);
        var table = doc.DocumentNode.SelectSingleNode("//table");
        var result = new List<RawBeachRow>();
        if (table is null) return result;

        foreach (var tr in table.SelectNodes(".//tr") ?? Enumerable.Empty<HtmlNode>())
        {
            var tds = tr.SelectNodes("./td");
            if (tds is null || tds.Count < 4) continue; // header/spacer rows

            var time = Clean(tds[0].InnerText);
            var speed = Clean(tds[3].InnerText);
            if (string.IsNullOrWhiteSpace(speed)) continue;

            if (!int.TryParse(Clean(tds[1].InnerText), NumberStyles.Integer,
                    CultureInfo.InvariantCulture, out var temp)) continue;

            var (low, high) = ParseRange(speed);
            if (low < 0) continue;

            result.Add(new RawBeachRow(time, temp, Clean(tds[2].InnerText), low, high));
        }
        return result;
    }

    private static (int low, int high) ParseRange(string s)
    {
        var parts = s.Split('-', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 2
            && int.TryParse(parts[0], out var lo) && int.TryParse(parts[1], out var hi))
            return (lo, hi);
        if (parts.Length == 1 && int.TryParse(parts[0], out var v))
            return (v, v);
        return (-1, -1);
    }

    private static string Clean(string s) =>
        System.Net.WebUtility.HtmlDecode(s).Replace(" ", " ").Trim();
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `dotnet test collectors/Collectors.sln --filter BeachObservationTests`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add collectors
git commit -m "feat: parse Barbed Wire Beach wind table"
```

---

### Task 3: Normalize timestamps to Mountain Time with year rollover

**Files:**
- Create: `collectors/src/Collectors/TimeNormalizer.cs`
- Test: `collectors/test/Collectors.Tests/TimeNormalizerTests.cs`

**Interfaces:**
- Produces: `public static DateTimeOffset TimeNormalizer.Normalize(string rawMonthDayTime, DateTimeOffset nowUtc)` — parses `MM/dd  hh:mm tt` (variable spaces), attaches `America/Denver` offset and a year, handling Dec→Jan rollover (a parsed date more than 2 days in the future is treated as the prior year).

- [ ] **Step 1: Write the failing test**

```csharp
using Collectors;
using Xunit;

public class TimeNormalizerTests
{
    private static readonly TimeZoneInfo Mt = TimeZoneInfo.FindSystemTimeZoneById("America/Denver");

    [Fact]
    public void Attaches_year_and_mountain_offset_in_summer()
    {
        var now = new DateTimeOffset(2026, 8, 8, 21, 0, 0, TimeSpan.Zero); // 3pm MDT
        var t = TimeNormalizer.Normalize("08/08  02:44 PM", now);
        Assert.Equal(2026, t.Year);
        Assert.Equal(8, t.Month);
        Assert.Equal(14, t.Hour);
        Assert.Equal(TimeSpan.FromHours(-6), t.Offset); // MDT
    }

    [Fact]
    public void Handles_variable_whitespace()
    {
        var now = new DateTimeOffset(2026, 8, 8, 21, 0, 0, TimeSpan.Zero);
        var t = TimeNormalizer.Normalize("08/08 2:44 pm", now);
        Assert.Equal(14, t.Hour);
    }

    [Fact]
    public void Rolls_back_a_year_across_new_year()
    {
        var now = new DateTimeOffset(2026, 1, 1, 8, 0, 0, TimeSpan.Zero); // 1am MST Jan 1 2026
        var t = TimeNormalizer.Normalize("12/31  11:50 PM", now);
        Assert.Equal(2025, t.Year);
        Assert.Equal(TimeSpan.FromHours(-7), t.Offset); // MST
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test collectors/Collectors.sln --filter TimeNormalizerTests`
Expected: FAIL (TimeNormalizer not defined).

- [ ] **Step 3: Implement**

```csharp
using System.Globalization;

namespace Collectors;

public static class TimeNormalizer
{
    private static readonly TimeZoneInfo Mt = TimeZoneInfo.FindSystemTimeZoneById("America/Denver");
    private static readonly string[] Formats = { "MM/dd h:mm tt", "MM/dd hh:mm tt" };

    public static DateTimeOffset Normalize(string rawMonthDayTime, DateTimeOffset nowUtc)
    {
        var s = System.Text.RegularExpressions.Regex.Replace(rawMonthDayTime.Trim(), @"\s+", " ");
        var nowMt = TimeZoneInfo.ConvertTime(nowUtc, Mt);

        var md = DateTime.ParseExact(s, Formats, CultureInfo.InvariantCulture, DateTimeStyles.None);
        var year = nowMt.Year;
        var candidate = new DateTime(year, md.Month, md.Day, md.Hour, md.Minute, 0, DateTimeKind.Unspecified);

        // If the timestamp lands clearly in the future, it belongs to the previous year.
        if (candidate > nowMt.DateTime.AddDays(2))
            candidate = candidate.AddYears(-1);

        var offset = Mt.GetUtcOffset(candidate);
        return new DateTimeOffset(candidate, offset);
    }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `dotnet test collectors/Collectors.sln --filter TimeNormalizerTests`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add collectors
git commit -m "feat: normalize beach timestamps to Mountain Time"
```

---

### Task 4: NDJSON append-with-dedup store

**Files:**
- Create: `collectors/src/Collectors/NdjsonStore.cs`
- Test: `collectors/test/Collectors.Tests/NdjsonStoreTests.cs`

**Interfaces:**
- Produces: `public record Observation(DateTimeOffset time, int tempF, string dir, int low, int high);`
- Produces: `public static class NdjsonStore` with
  `int AppendNewObservations(string path, IEnumerable<Observation> candidates)` — reads existing lines, appends only observations with `time` strictly newer than the max existing `time`, returns count appended. Serializes each object compactly on one line with camelCase keys and ISO-8601 `time`.

- [ ] **Step 1: Write the failing test**

```csharp
using Collectors;
using Xunit;

public class NdjsonStoreTests
{
    private static Observation Obs(string iso, int low, int high) =>
        new(DateTimeOffset.Parse(iso), 90, "SW", low, high);

    [Fact]
    public void Appends_only_newer_and_dedups()
    {
        var path = Path.GetTempFileName();
        try
        {
            var first = NdjsonStore.AppendNewObservations(path, new[]
            {
                Obs("2026-08-08T14:44:00-06:00", 15, 20),
                Obs("2026-08-08T14:42:00-06:00", 14, 19),
            });
            Assert.Equal(2, first);

            // Overlapping fetch: one old (dup) + one new
            var second = NdjsonStore.AppendNewObservations(path, new[]
            {
                Obs("2026-08-08T14:44:00-06:00", 15, 20),  // not newer -> skip
                Obs("2026-08-08T14:46:00-06:00", 16, 21),  // newer -> keep
            });
            Assert.Equal(1, second);

            var lines = File.ReadAllLines(path);
            Assert.Equal(3, lines.Length);
            Assert.Contains("\"low\":16", lines[2]);
            Assert.DoesNotContain("\n\n", File.ReadAllText(path));
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void Empty_input_writes_nothing()
    {
        var path = Path.GetTempFileName();
        try
        {
            File.WriteAllText(path, "");
            Assert.Equal(0, NdjsonStore.AppendNewObservations(path, Array.Empty<Observation>()));
            Assert.Equal("", File.ReadAllText(path));
        }
        finally { File.Delete(path); }
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test collectors/Collectors.sln --filter NdjsonStoreTests`
Expected: FAIL (types not defined).

- [ ] **Step 3: Implement**

```csharp
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Collectors;

public record Observation(DateTimeOffset time, int tempF, string dir, int low, int high);

public static class NdjsonStore
{
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public static int AppendNewObservations(string path, IEnumerable<Observation> candidates)
    {
        DateTimeOffset max = DateTimeOffset.MinValue;
        if (File.Exists(path))
        {
            foreach (var line in File.ReadLines(path))
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                var existing = JsonSerializer.Deserialize<Observation>(line, Json);
                if (existing is not null && existing.time > max) max = existing.time;
            }
        }

        var fresh = candidates
            .Where(o => o.time > max)
            .OrderBy(o => o.time)
            .ToList();
        if (fresh.Count == 0) return 0;

        var sb = new StringBuilder();
        foreach (var o in fresh)
            sb.Append(JsonSerializer.Serialize(o, Json)).Append('\n');

        File.AppendAllText(path, sb.ToString());
        return fresh.Count;
    }
}
```

> Note: the ISO string in tests uses `-06:00`; `DateTimeOffset` round-trips with `"O"` format via System.Text.Json by default, preserving the offset.

- [ ] **Step 4: Run to verify it passes**

Run: `dotnet test collectors/Collectors.sln --filter NdjsonStoreTests`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add collectors
git commit -m "feat: append-only NDJSON store with dedup"
```

---

### Task 5: Wire the observations runner end-to-end

**Files:**
- Modify: `collectors/src/Collectors/Runners.cs` (replace the `ObservationsRunner` stub)
- Test: `collectors/test/Collectors.Tests/BeachObservationTests.cs` (add integration test using the fixture through the full pipeline)

**Interfaces:**
- Consumes: `BeachParser.Parse`, `TimeNormalizer.Normalize`, `NdjsonStore.AppendNewObservations`.
- Produces: `Task<int> ObservationsRunner.RunAsync(string repoRoot)` — fetches the page, parses, normalizes, appends to `<repoRoot>/data/observations.ndjson`; returns 0 on success, 1 on fetch/parse failure (writing nothing).
- Produces: `IReadOnlyList<Observation> ObservationsRunner.BuildObservations(string html, DateTimeOffset nowUtc)` (pure; the integration test targets this).

- [ ] **Step 1: Write the failing test** (append to `BeachObservationTests.cs`)

```csharp
    [Fact]
    public void BuildObservations_produces_normalized_rows()
    {
        var now = new DateTimeOffset(2026, 8, 8, 21, 0, 0, TimeSpan.Zero);
        var obs = Collectors.ObservationsRunner.BuildObservations(Html(), now);
        Assert.Equal(10, obs.Count);
        Assert.All(obs, o => Assert.Equal(2026, o.time.Year));
        Assert.All(obs, o => Assert.True(o.high >= o.low));
    }
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test collectors/Collectors.sln --filter BeachObservationTests`
Expected: FAIL (`BuildObservations` not found).

- [ ] **Step 3: Implement** (replace `ObservationsRunner` in `Runners.cs`)

```csharp
using System.Net.Http;

namespace Collectors;

public static class ObservationsRunner
{
    private const string Url = "http://65.130.252.76:90/fastDC.htm";

    public static IReadOnlyList<Observation> BuildObservations(string html, DateTimeOffset nowUtc)
    {
        var rows = BeachParser.Parse(html);
        var list = new List<Observation>();
        foreach (var r in rows)
        {
            var t = TimeNormalizer.Normalize(r.RawTime, nowUtc);
            list.Add(new Observation(t, r.TempF, r.Dir, r.Low, r.High));
        }
        return list;
    }

    public static async Task<int> RunAsync(string repoRoot)
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
            var html = await http.GetStringAsync(Url);
            var obs = BuildObservations(html, DateTimeOffset.UtcNow);
            if (obs.Count == 0) { Console.Error.WriteLine("0 rows parsed; writing nothing"); return 1; }

            var dir = Path.Combine(repoRoot, "data");
            Directory.CreateDirectory(dir);
            var path = Path.Combine(dir, "observations.ndjson");
            var n = NdjsonStore.AppendNewObservations(path, obs);
            Console.WriteLine($"observations: appended {n}");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"observations failed: {ex.Message}");
            return 1;
        }
    }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `dotnet test collectors/Collectors.sln --filter BeachObservationTests`
Expected: PASS.

- [ ] **Step 5: Smoke-run against the live source**

Run: `dotnet run --project collectors/src/Collectors -- observations .`
Expected: prints `observations: appended N` and creates/extends `data/observations.ndjson`.

- [ ] **Step 6: Commit**

```bash
git add collectors data/observations.ndjson
git commit -m "feat: end-to-end observations collector"
```

---

## Stage 2 — Forecast collector

### Task 6: Compass→degrees + ForecastRow, and Open-Meteo parser

**Files:**
- Create: `collectors/src/Collectors/CompassDegrees.cs`, `collectors/src/Collectors/ForecastRow.cs`, `collectors/src/Collectors/OpenMeteoParser.cs`
- Test: `collectors/test/Collectors.Tests/OpenMeteoParserTests.cs`

**Interfaces:**
- Produces: `public record ForecastRow(DateTimeOffset fetchedAt, string source, string model, string validTime, double windMph, double? gustMph, int? dirDeg);`
- Produces: `public static int? CompassDegrees.ToDegrees(string? compass)` — e.g. `"SW"→225`, unknown/empty→`null`.
- Produces: `public static IReadOnlyList<ForecastRow> OpenMeteoParser.Parse(string json, DateTimeOffset fetchedAt)` — emits rows for models `hrrr`,`ecmwf`,`gfs` from fields `wind_speed_10m_<model>`, `wind_gusts_10m_<model>`, `wind_direction_10m_<model>`, keyed by `hourly.time`.

- [ ] **Step 1: Write the failing test**

```csharp
using Collectors;
using Xunit;

public class OpenMeteoParserTests
{
    private static string Json() =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "fixtures", "openmeteo.json"));

    [Fact]
    public void Compass_maps_known_and_unknown()
    {
        Assert.Equal(225, CompassDegrees.ToDegrees("SW"));
        Assert.Equal(0, CompassDegrees.ToDegrees("N"));
        Assert.Null(CompassDegrees.ToDegrees(""));
        Assert.Null(CompassDegrees.ToDegrees("ZZ"));
    }

    [Fact]
    public void Parses_three_models()
    {
        var fetched = new DateTimeOffset(2026, 8, 8, 21, 0, 0, TimeSpan.Zero);
        var rows = OpenMeteoParser.Parse(Json(), fetched);
        Assert.Contains(rows, r => r.model == "hrrr");
        Assert.Contains(rows, r => r.model == "ecmwf");
        Assert.Contains(rows, r => r.model == "gfs");
        Assert.All(rows, r => Assert.Equal("open-meteo", r.source));
        Assert.All(rows, r => Assert.False(string.IsNullOrEmpty(r.validTime)));
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test collectors/Collectors.sln --filter OpenMeteoParserTests`
Expected: FAIL.

- [ ] **Step 3: Implement**

`CompassDegrees.cs`:

```csharp
namespace Collectors;

public static class CompassDegrees
{
    private static readonly string[] Points =
        { "N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW" };

    public static int? ToDegrees(string? compass)
    {
        if (string.IsNullOrWhiteSpace(compass)) return null;
        var idx = Array.IndexOf(Points, compass.Trim().ToUpperInvariant());
        return idx < 0 ? null : idx * 360 / Points.Length;
    }
}
```

`ForecastRow.cs`:

```csharp
namespace Collectors;

public record ForecastRow(
    DateTimeOffset fetchedAt, string source, string model, string validTime,
    double windMph, double? gustMph, int? dirDeg);
```

`OpenMeteoParser.cs`:

```csharp
using System.Text.Json;

namespace Collectors;

public static class OpenMeteoParser
{
    private static readonly (string field, string model)[] Models =
        { ("gfs_hrrr", "hrrr"), ("ecmwf_ifs025", "ecmwf"), ("gfs_seamless", "gfs") };

    public static IReadOnlyList<ForecastRow> Parse(string json, DateTimeOffset fetchedAt)
    {
        using var doc = JsonDocument.Parse(json);
        var hourly = doc.RootElement.GetProperty("hourly");
        var times = hourly.GetProperty("time").EnumerateArray().Select(e => e.GetString()!).ToArray();

        var rows = new List<ForecastRow>();
        foreach (var (field, model) in Models)
        {
            if (!hourly.TryGetProperty($"wind_speed_10m_{field}", out var wind)) continue;
            var winds = wind.EnumerateArray().ToArray();
            var gusts = hourly.TryGetProperty($"wind_gusts_10m_{field}", out var g) ? g.EnumerateArray().ToArray() : null;
            var dirs  = hourly.TryGetProperty($"wind_direction_10m_{field}", out var d) ? d.EnumerateArray().ToArray() : null;

            for (var i = 0; i < times.Length && i < winds.Length; i++)
            {
                if (winds[i].ValueKind == JsonValueKind.Null) continue;
                rows.Add(new ForecastRow(
                    fetchedAt, "open-meteo", model, times[i],
                    winds[i].GetDouble(),
                    gusts is { } gg && gg[i].ValueKind != JsonValueKind.Null ? gg[i].GetDouble() : null,
                    dirs is { } dd && dd[i].ValueKind != JsonValueKind.Null ? (int)Math.Round(dd[i].GetDouble()) : null));
            }
        }
        return rows;
    }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `dotnet test collectors/Collectors.sln --filter OpenMeteoParserTests`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add collectors
git commit -m "feat: Open-Meteo multi-model forecast parser"
```

---

### Task 7: NWS hourly parser

**Files:**
- Create: `collectors/src/Collectors/NwsParser.cs`
- Test: `collectors/test/Collectors.Tests/NwsParserTests.cs`

**Interfaces:**
- Produces: `public static IReadOnlyList<ForecastRow> NwsParser.Parse(string json, DateTimeOffset fetchedAt)` — reads `properties.periods[]`, uses `startTime` as `validTime`, parses the leading integer of `windSpeed` (e.g. `"10 mph"` or `"5 to 10 mph"` → 10, the high end), `windDirection` via `CompassDegrees`, `windGust` if present. `source="nws"`, `model="nws"`.

- [ ] **Step 1: Write the failing test**

```csharp
using Collectors;
using Xunit;

public class NwsParserTests
{
    private static string Json() =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "fixtures", "nws-hourly.json"));

    [Fact]
    public void Parses_periods_with_nws_source()
    {
        var rows = NwsParser.Parse(Json(), DateTimeOffset.UtcNow);
        Assert.NotEmpty(rows);
        Assert.All(rows, r => Assert.Equal("nws", r.source));
        Assert.All(rows, r => Assert.Equal("nws", r.model));
        Assert.All(rows, r => Assert.True(r.windMph >= 0));
    }

    [Fact]
    public void Parses_speed_string_high_end()
    {
        Assert.Equal(10, NwsParser.ParseSpeed("5 to 10 mph"));
        Assert.Equal(10, NwsParser.ParseSpeed("10 mph"));
        Assert.Equal(0, NwsParser.ParseSpeed(""));
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test collectors/Collectors.sln --filter NwsParserTests`
Expected: FAIL.

- [ ] **Step 3: Implement**

```csharp
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Collectors;

public static class NwsParser
{
    public static double ParseSpeed(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return 0;
        var nums = Regex.Matches(s, @"\d+").Select(m => int.Parse(m.Value)).ToArray();
        return nums.Length == 0 ? 0 : nums.Max(); // high end of any range
    }

    public static IReadOnlyList<ForecastRow> Parse(string json, DateTimeOffset fetchedAt)
    {
        using var doc = JsonDocument.Parse(json);
        var periods = doc.RootElement.GetProperty("properties").GetProperty("periods");
        var rows = new List<ForecastRow>();
        foreach (var p in periods.EnumerateArray())
        {
            var validTime = p.GetProperty("startTime").GetString()!;
            var wind = ParseSpeed(p.TryGetProperty("windSpeed", out var w) ? w.GetString() : null);
            double? gust = p.TryGetProperty("windGust", out var g) && g.ValueKind == JsonValueKind.String
                ? ParseSpeed(g.GetString()) : null;
            var dir = CompassDegrees.ToDegrees(p.TryGetProperty("windDirection", out var d) ? d.GetString() : null);
            rows.Add(new ForecastRow(fetchedAt, "nws", "nws", validTime, wind, gust, dir));
        }
        return rows;
    }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `dotnet test collectors/Collectors.sln --filter NwsParserTests`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add collectors
git commit -m "feat: NWS hourly forecast parser"
```

---

### Task 8: Forecast NDJSON append + wire the forecast runner

**Files:**
- Modify: `collectors/src/Collectors/NdjsonStore.cs` (add `AppendForecasts`)
- Modify: `collectors/src/Collectors/Runners.cs` (replace `ForecastRunner` stub)
- Test: `collectors/test/Collectors.Tests/NdjsonStoreTests.cs` (add forecast append test)

**Interfaces:**
- Consumes: `OpenMeteoParser.Parse`, `NwsParser.Parse`.
- Produces: `int NdjsonStore.AppendForecasts(string path, IEnumerable<ForecastRow> rows)` — appends **all** rows (forecast snapshots are intentionally kept per fetch; dedup only exact-duplicate lines within this call), returns count appended.
- Produces: `Task<int> ForecastRunner.RunAsync(string repoRoot)` — fetches both sources independently (one failing does not abort the other), appends to `<repoRoot>/data/forecasts.ndjson`; returns 0 if at least one source succeeded, else 1.

- [ ] **Step 1: Write the failing test** (append to `NdjsonStoreTests.cs`)

```csharp
    [Fact]
    public void Appends_forecast_rows()
    {
        var path = Path.GetTempFileName();
        try
        {
            var fetched = DateTimeOffset.Parse("2026-08-08T15:00:00-06:00");
            var rows = new[]
            {
                new ForecastRow(fetched, "open-meteo", "hrrr", "2026-08-08T18:00", 14, 22, 225),
                new ForecastRow(fetched, "nws", "nws", "2026-08-08T18:00:00-06:00", 10, null, 225),
            };
            Assert.Equal(2, NdjsonStore.AppendForecasts(path, rows));
            var text = File.ReadAllText(path);
            Assert.Contains("\"model\":\"hrrr\"", text);
            Assert.Contains("\"gustMph\":null", text);
        }
        finally { File.Delete(path); }
    }
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test collectors/Collectors.sln --filter NdjsonStoreTests`
Expected: FAIL (`AppendForecasts` not found).

- [ ] **Step 3: Implement `AppendForecasts`** (add to `NdjsonStore`)

```csharp
    public static int AppendForecasts(string path, IEnumerable<ForecastRow> rows)
    {
        var list = rows.ToList();
        if (list.Count == 0) return 0;
        var sb = new StringBuilder();
        foreach (var r in list)
            sb.Append(JsonSerializer.Serialize(r, Json)).Append('\n');
        File.AppendAllText(path, sb.ToString());
        return list.Count;
    }
```

- [ ] **Step 4: Implement `ForecastRunner`** (replace stub in `Runners.cs`)

```csharp
using System.Net.Http;
using System.Net.Http.Headers;

namespace Collectors;

public static class ForecastRunner
{
    private const string OpenMeteoUrl =
        "https://api.open-meteo.com/v1/forecast?latitude=40.4471&longitude=-111.4776" +
        "&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=mph" +
        "&timezone=America%2FDenver&models=gfs_hrrr,ecmwf_ifs025,gfs_seamless";
    private const string NwsUrl = "https://api.weather.gov/gridpoints/SLC/113,159/forecast/hourly";

    public static async Task<int> RunAsync(string repoRoot)
    {
        var now = DateTimeOffset.UtcNow;
        var all = new List<ForecastRow>();
        var anyOk = false;

        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        http.DefaultRequestHeaders.UserAgent.ParseAdd("kite-wind-tracker (Jeff.Woltjen@gmail.com)");

        try
        {
            var om = await http.GetStringAsync(OpenMeteoUrl);
            all.AddRange(OpenMeteoParser.Parse(om, now));
            anyOk = true;
        }
        catch (Exception ex) { Console.Error.WriteLine($"open-meteo failed: {ex.Message}"); }

        try
        {
            var req = new HttpRequestMessage(HttpMethod.Get, NwsUrl);
            req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/geo+json"));
            var resp = await http.SendAsync(req);
            resp.EnsureSuccessStatusCode();
            all.AddRange(NwsParser.Parse(await resp.Content.ReadAsStringAsync(), now));
            anyOk = true;
        }
        catch (Exception ex) { Console.Error.WriteLine($"nws failed: {ex.Message}"); }

        if (!anyOk) return 1;

        var dir = Path.Combine(repoRoot, "data");
        Directory.CreateDirectory(dir);
        var n = NdjsonStore.AppendForecasts(Path.Combine(dir, "forecasts.ndjson"), all);
        Console.WriteLine($"forecasts: appended {n}");
        return 0;
    }
}
```

- [ ] **Step 5: Run tests + live smoke**

Run: `dotnet test collectors/Collectors.sln`
Expected: all PASS.
Run: `dotnet run --project collectors/src/Collectors -- forecasts .`
Expected: prints `forecasts: appended N`, creates `data/forecasts.ndjson`.

- [ ] **Step 6: Commit**

```bash
git add collectors data/forecasts.ndjson
git commit -m "feat: end-to-end forecast collector"
```

---

## Stage 3 — Automation

### Task 9: Single collection workflow (obs every 5 min, forecasts hourly)

**Files:**
- Create: `.github/workflows/collect.yml`

**Interfaces:**
- Consumes: the built collector CLI (`observations` / `forecasts` modes).
- Produces: committed data files on a schedule. A single workflow avoids two schedulers racing to push.

- [ ] **Step 1: Write the workflow**

```yaml
name: collect
on:
  schedule:
    - cron: "*/5 * * * *"   # every 5 minutes (UTC); GitHub may delay a few min
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: collect
  cancel-in-progress: false

jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: "8.0.x"

      - name: Build collectors
        run: dotnet build collectors/Collectors.sln -c Release

      - name: Collect observations
        run: dotnet run --project collectors/src/Collectors -c Release -- observations "$GITHUB_WORKSPACE"

      - name: Collect forecasts (top of hour only)
        if: ${{ github.event_name == 'workflow_dispatch' }} || ${{ github.run_attempt != '' }}
        run: |
          MIN=$(date -u +%M)
          if [ "$MIN" -lt 5 ]; then
            dotnet run --project collectors/src/Collectors -c Release -- forecasts "$GITHUB_WORKSPACE"
          else
            echo "not top of hour ($MIN); skipping forecasts"
          fi

      - name: Commit data
        run: |
          git config user.name "kite-bot"
          git config user.email "actions@github.com"
          git add data/*.ndjson
          if git diff --cached --quiet; then
            echo "no new data"
          else
            git pull --rebase --autostash origin ${GITHUB_REF_NAME}
            git commit -m "data: collect $(date -u +%FT%TZ)"
            git push
          fi
```

> The `git pull --rebase` before push guards against the rare case where a manual push landed between checkout and commit.

- [ ] **Step 2: Validate YAML locally**

Run: `python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/collect.yml'))"`
Expected: no output (valid YAML).

- [ ] **Step 3: Commit and push, then trigger manually to verify**

```bash
git add .github/workflows/collect.yml
git commit -m "ci: scheduled collection workflow"
git push
```

After pushing to GitHub: Actions tab → `collect` → "Run workflow". Expected: green run; a follow-up `data: collect …` commit appears.

---

## Stage 4 — Frontend logic (pure, TDD)

### Task 10: Vite React scaffold, config, and types

**Files:**
- Create: `web/` via Vite; then `web/src/config.ts`, `web/src/types.ts`
- Create: `web/vitest.config.ts`

**Interfaces:**
- Produces: `export interface Observation { time: string; tempF: number; dir: string; low: number; high: number; }`
- Produces: `export interface Forecast { fetchedAt: string; source: string; model: string; validTime: string; windMph: number; gustMph: number | null; dirDeg: number | null; }`
- Produces: `export const config` with `location`, `dataBaseUrl`, and thresholds `goodLowMph=15, goodHighMph=26, steadySpreadMax=5, gustySpreadMax=10, idealDirs, okDirs, dayStartHour=9, dayEndHour=20`.

- [ ] **Step 1: Scaffold**

```bash
cd web && npm create vite@latest . -- --template react-ts
npm install
npm install recharts
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Add `web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "jsdom", globals: true, setupFiles: [] },
});
```

Add to `web/package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 3: Create `web/src/types.ts`**

```ts
export interface Observation {
  time: string; tempF: number; dir: string; low: number; high: number;
}
export interface Forecast {
  fetchedAt: string; source: string; model: string; validTime: string;
  windMph: number; gustMph: number | null; dirDeg: number | null;
}
```

- [ ] **Step 4: Create `web/src/config.ts`**

```ts
export const config = {
  location: { name: "Barbed Wire Beach — Deer Creek", lat: 40.4471, lon: -111.4776 },
  // Data is fetched at runtime from the repo's raw files. Replace <user> after first push.
  dataBaseUrl: import.meta.env.DEV
    ? "/data"
    : "https://raw.githubusercontent.com/<user>/deer-creek-wind-tracker/main/data",
  goodLowMph: 15,
  goodHighMph: 26,
  steadySpreadMax: 5,
  gustySpreadMax: 10,
  idealDirs: ["SW", "SSW", "WSW"],
  okDirs: ["S", "W"],
  dayStartHour: 9,
  dayEndHour: 20,
} as const;
```

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "chore: scaffold React+Vite web app, config, and types"
```

---

### Task 11: NDJSON parser + data loader

**Files:**
- Create: `web/src/ndjson.ts`, `web/src/dataLoader.ts`
- Test: `web/src/ndjson.test.ts`

**Interfaces:**
- Produces: `export function parseNdjson<T>(text: string): T[]` — one object per non-empty line; ignores blank lines and trailing newline.
- Produces: `export async function loadData(fetchFn = fetch): Promise<{ observations: Observation[]; forecasts: Forecast[] }>` — fetches `${config.dataBaseUrl}/observations.ndjson` and `/forecasts.ndjson`, returns parsed arrays; on a fetch error for either file, returns `[]` for that file.

- [ ] **Step 1: Write the failing test** (`web/src/ndjson.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { parseNdjson } from "./ndjson";

describe("parseNdjson", () => {
  it("parses lines and ignores blanks/trailing newline", () => {
    const text = `{"a":1}\n{"a":2}\n\n`;
    expect(parseNdjson<{ a: number }>(text)).toEqual([{ a: 1 }, { a: 2 }]);
  });
  it("returns [] for empty input", () => {
    expect(parseNdjson("")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run src/ndjson.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `ndjson.ts`**

```ts
export function parseNdjson<T>(text: string): T[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as T);
}
```

- [ ] **Step 4: Implement `dataLoader.ts`**

```ts
import { config } from "./config";
import { parseNdjson } from "./ndjson";
import type { Observation, Forecast } from "./types";

async function loadFile<T>(name: string, fetchFn: typeof fetch): Promise<T[]> {
  try {
    const res = await fetchFn(`${config.dataBaseUrl}/${name}`, { cache: "no-store" });
    if (!res.ok) return [];
    return parseNdjson<T>(await res.text());
  } catch {
    return [];
  }
}

export async function loadData(fetchFn: typeof fetch = fetch) {
  const [observations, forecasts] = await Promise.all([
    loadFile<Observation>("observations.ndjson", fetchFn),
    loadFile<Forecast>("forecasts.ndjson", fetchFn),
  ]);
  return { observations, forecasts };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd web && npx vitest run src/ndjson.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/ndjson.ts web/src/dataLoader.ts web/src/ndjson.test.ts
git commit -m "feat: ndjson parser and data loader"
```

---

### Task 12: Classification logic

**Files:**
- Create: `web/src/classify.ts`
- Test: `web/src/classify.test.ts`

**Interfaces:**
- Produces: `export type Category = "good" | "gusty" | "light" | "strong";`
- Produces: `export function classify(low: number, high: number): Category` using config thresholds:
  `mid=(low+high)/2`, `spread=high-low`; `high<goodLowMph→"light"`; else `mid>goodHighMph || spread>gustySpreadMax→"strong"`; else `spread<=steadySpreadMax→"good"`; else `"gusty"`.
- Produces: `export type DirRating = "ideal" | "ok" | "off";` and `export function rateDirection(dir: string): DirRating`.

- [ ] **Step 1: Write the failing test** (`web/src/classify.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { classify, rateDirection } from "./classify";

describe("classify", () => {
  it("good: steady, in band", () => expect(classify(16, 20)).toBe("good"));
  it("gusty: in band, spread 6-10", () => expect(classify(12, 20)).toBe("gusty"));
  it("light: high below floor", () => expect(classify(8, 12)).toBe("light"));
  it("strong: mid above ceiling", () => expect(classify(26, 32)).toBe("strong"));
  it("strong: spread over gusty max", () => expect(classify(10, 24)).toBe("strong"));
});

describe("rateDirection", () => {
  it("ideal SW", () => expect(rateDirection("SW")).toBe("ideal"));
  it("ok S", () => expect(rateDirection("S")).toBe("ok"));
  it("off N", () => expect(rateDirection("N")).toBe("off"));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run src/classify.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import { config } from "./config";

export type Category = "good" | "gusty" | "light" | "strong";
export type DirRating = "ideal" | "ok" | "off";

export function classify(low: number, high: number): Category {
  const mid = (low + high) / 2;
  const spread = high - low;
  if (high < config.goodLowMph) return "light";
  if (mid > config.goodHighMph || spread > config.gustySpreadMax) return "strong";
  if (spread <= config.steadySpreadMax) return "good";
  return "gusty";
}

export function rateDirection(dir: string): DirRating {
  const d = dir.toUpperCase();
  if ((config.idealDirs as readonly string[]).includes(d)) return "ideal";
  if ((config.okDirs as readonly string[]).includes(d)) return "ok";
  return "off";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && npx vitest run src/classify.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/classify.ts web/src/classify.test.ts
git commit -m "feat: wind classification and direction rating"
```

---

### Task 13: Analytics — hour pattern, forecast-vs-actual, model scoreboard

**Files:**
- Create: `web/src/analytics.ts`
- Test: `web/src/analytics.test.ts`

**Interfaces:**
- Produces:
  - `export function localHour(iso: string): number` — hour-of-day (0–23) from an ISO string, using its own offset (no re-zoning; observation/forecast times are already Mountain).
  - `export function localDate(iso: string): string` — `YYYY-MM-DD` from the ISO string.
  - `export function hourPattern(obs: Observation[]): { hour: number; avgMid: number; count: number }[]` — mean of `(low+high)/2` per hour-of-day, hours 0–23 with data.
  - `export function actualDailyPeak(obs: Observation[]): Map<string, number>` — per `localDate`, max `(low+high)/2` within `[dayStartHour, dayEndHour)`.
  - `export function forecastDailyPeak(fc: Forecast[]): Map<string, Map<string, number>>` — `date -> (source|model key -> max windMph in day window, using the latest snapshot fetched before that date)`.
  - `export function scoreboard(obs: Observation[], fc: Forecast[]): { key: string; mae: number; days: number }[]` — mean absolute error of forecast peak vs actual peak per model key, sorted ascending (best first).

- [ ] **Step 1: Write the failing test** (`web/src/analytics.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { localHour, localDate, hourPattern, actualDailyPeak, scoreboard } from "./analytics";
import type { Observation, Forecast } from "./types";

const obs = (time: string, low: number, high: number): Observation =>
  ({ time, tempF: 90, dir: "SW", low, high });

describe("time helpers", () => {
  it("localHour uses the string's own offset", () =>
    expect(localHour("2026-08-08T14:44:00-06:00")).toBe(14));
  it("localDate", () => expect(localDate("2026-08-08T14:44:00-06:00")).toBe("2026-08-08"));
});

describe("hourPattern", () => {
  it("averages mid per hour", () => {
    const p = hourPattern([
      obs("2026-08-08T14:00:00-06:00", 10, 20), // mid 15
      obs("2026-08-08T14:30:00-06:00", 20, 30), // mid 25
    ]);
    const h14 = p.find((x) => x.hour === 14)!;
    expect(h14.avgMid).toBe(20);
    expect(h14.count).toBe(2);
  });
});

describe("actualDailyPeak", () => {
  it("takes daytime max mid", () => {
    const m = actualDailyPeak([
      obs("2026-08-08T07:00:00-06:00", 30, 30), // before window -> ignored
      obs("2026-08-08T14:00:00-06:00", 18, 22), // mid 20
      obs("2026-08-08T15:00:00-06:00", 10, 12), // mid 11
    ]);
    expect(m.get("2026-08-08")).toBe(20);
  });
});

describe("scoreboard", () => {
  it("computes MAE per model, best first", () => {
    const observations = [obs("2026-08-08T14:00:00-06:00", 18, 22)]; // actual peak 20
    const forecasts: Forecast[] = [
      { fetchedAt: "2026-08-07T18:00:00-06:00", source: "open-meteo", model: "ecmwf",
        validTime: "2026-08-08T14:00", windMph: 18, gustMph: null, dirDeg: 225 },
      { fetchedAt: "2026-08-07T18:00:00-06:00", source: "nws", model: "nws",
        validTime: "2026-08-08T14:00:00-06:00", windMph: 10, gustMph: null, dirDeg: 225 },
    ];
    const board = scoreboard(observations, forecasts);
    expect(board[0].key).toBe("open-meteo/ecmwf"); // |18-20|=2 beats |10-20|=10
    expect(board[0].mae).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run src/analytics.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `analytics.ts`**

```ts
import { config } from "./config";
import type { Observation, Forecast } from "./types";

export function localHour(iso: string): number {
  // Take the hour written in the ISO string itself (times are already Mountain).
  const m = iso.match(/T(\d{2}):/);
  return m ? Number(m[1]) : new Date(iso).getHours();
}

export function localDate(iso: string): string {
  return iso.slice(0, 10);
}

const mid = (o: Observation) => (o.low + o.high) / 2;
const inDay = (h: number) => h >= config.dayStartHour && h < config.dayEndHour;

export function hourPattern(obs: Observation[]) {
  const buckets = new Map<number, { sum: number; count: number }>();
  for (const o of obs) {
    const h = localHour(o.time);
    const b = buckets.get(h) ?? { sum: 0, count: 0 };
    b.sum += mid(o); b.count += 1;
    buckets.set(h, b);
  }
  return [...buckets.entries()]
    .map(([hour, b]) => ({ hour, avgMid: b.sum / b.count, count: b.count }))
    .sort((a, b) => a.hour - b.hour);
}

export function actualDailyPeak(obs: Observation[]): Map<string, number> {
  const peaks = new Map<string, number>();
  for (const o of obs) {
    if (!inDay(localHour(o.time))) continue;
    const d = localDate(o.time);
    peaks.set(d, Math.max(peaks.get(d) ?? -Infinity, mid(o)));
  }
  return peaks;
}

export function forecastDailyPeak(fc: Forecast[]): Map<string, Map<string, number>> {
  // For each day + model key, use ONLY the single latest snapshot fetched before that day,
  // and take that snapshot's peak windMph over the day window.
  // chosen: day -> key -> { fetchedAt used, peak so far within that snapshot }
  const chosen = new Map<string, Map<string, { fetchedAt: string; peak: number }>>();
  for (const f of fc) {
    const day = localDate(f.validTime);
    if (!inDay(localHour(f.validTime))) continue;
    if (f.fetchedAt.slice(0, 10) >= day) continue; // only forecasts made before the day
    const key = `${f.source}/${f.model}`;
    const dayMap = chosen.get(day) ?? new Map<string, { fetchedAt: string; peak: number }>();
    chosen.set(day, dayMap);
    const cur = dayMap.get(key);
    if (!cur || f.fetchedAt > cur.fetchedAt) {
      dayMap.set(key, { fetchedAt: f.fetchedAt, peak: f.windMph }); // newer snapshot resets peak
    } else if (f.fetchedAt === cur.fetchedAt) {
      cur.peak = Math.max(cur.peak, f.windMph);
    } // older snapshot: ignore
  }
  const out = new Map<string, Map<string, number>>();
  for (const [day, keys] of chosen) {
    const m = new Map<string, number>();
    for (const [key, v] of keys) m.set(key, v.peak);
    out.set(day, m);
  }
  return out;
}

export function scoreboard(obs: Observation[], fc: Forecast[]) {
  const actual = actualDailyPeak(obs);
  const fpeak = forecastDailyPeak(fc);
  const errs = new Map<string, number[]>();
  for (const [day, models] of fpeak) {
    const a = actual.get(day);
    if (a === undefined) continue;
    for (const [key, wind] of models) {
      if (!isFinite(wind)) continue;
      const arr = errs.get(key) ?? [];
      arr.push(Math.abs(wind - a));
      errs.set(key, arr);
    }
  }
  return [...errs.entries()]
    .map(([key, e]) => ({ key, mae: e.reduce((s, x) => s + x, 0) / e.length, days: e.length }))
    .sort((a, b) => a.mae - b.mae);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && npx vitest run src/analytics.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add web/src/analytics.ts web/src/analytics.test.ts
git commit -m "feat: hour pattern, daily peaks, and model scoreboard analytics"
```

---

## Stage 5 — UI components & assembly

### Task 14: Verdict component (latest reading)

**Files:**
- Create: `web/src/components/Verdict.tsx`
- Test: `web/src/components/Verdict.test.tsx`

**Interfaces:**
- Consumes: `classify`, `rateDirection`, `Observation`.
- Produces: `export function Verdict({ latest }: { latest: Observation | null }): JSX.Element` — renders the category label (GOOD/GUSTY/TOO LIGHT/STRONG), `dir · low–high mph`, and a relative "updated" note; renders "No data yet" when `latest` is null.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Verdict } from "./Verdict";

describe("Verdict", () => {
  it("shows GOOD for steady in-band wind", () => {
    render(<Verdict latest={{ time: "2026-08-08T14:44:00-06:00", tempF: 95, dir: "SW", low: 16, high: 20 }} />);
    expect(screen.getByText(/GOOD/i)).toBeTruthy();
    expect(screen.getByText(/16–20 mph/)).toBeTruthy();
  });
  it("shows empty state", () => {
    render(<Verdict latest={null} />);
    expect(screen.getByText(/No data yet/i)).toBeTruthy();
  });
});
```

Add `web/src/setupTests.ts` with `import "@testing-library/jest-dom";` and reference it in `vitest.config.ts` `setupFiles`.

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run src/components/Verdict.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
import { classify, rateDirection, type Category } from "../classify";
import type { Observation } from "../types";

const LABEL: Record<Category, string> = {
  good: "🟢 GOOD RIGHT NOW", gusty: "🟡 RIDEABLE BUT GUSTY",
  light: "⚪ TOO LIGHT", strong: "🔴 STRONG / CAUTION",
};

export function Verdict({ latest }: { latest: Observation | null }) {
  if (!latest) return <section><h1>No data yet</h1></section>;
  const cat = classify(latest.low, latest.high);
  const dir = rateDirection(latest.dir);
  return (
    <section className={`verdict verdict-${cat}`}>
      <h1>{LABEL[cat]}</h1>
      <p>{latest.dir} ({dir}) · {latest.low}–{latest.high} mph</p>
      <small>updated {new Date(latest.time).toLocaleString()}</small>
    </section>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && npx vitest run src/components/Verdict.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Verdict.tsx web/src/components/Verdict.test.tsx web/src/setupTests.ts web/vitest.config.ts
git commit -m "feat: Verdict component"
```

---

### Task 15: HistoryChart component

**Files:**
- Create: `web/src/components/HistoryChart.tsx`
- Test: `web/src/components/HistoryChart.test.tsx`

**Interfaces:**
- Consumes: `Observation`, Recharts.
- Produces: `export function HistoryChart({ observations }: { observations: Observation[] }): JSX.Element` — a line/scatter of `mid` over time for the last 7 days, with a shaded good band (`goodLowMph`–`goodHighMph`). Renders "No history yet" when empty.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HistoryChart } from "./HistoryChart";

describe("HistoryChart", () => {
  it("empty state", () => {
    render(<HistoryChart observations={[]} />);
    expect(screen.getByText(/No history yet/i)).toBeTruthy();
  });
  it("renders a chart container with data", () => {
    const { container } = render(
      <HistoryChart observations={[{ time: "2026-08-08T14:00:00-06:00", tempF: 90, dir: "SW", low: 15, high: 20 }]} />
    );
    expect(container.querySelector(".history-chart")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run src/components/HistoryChart.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceArea, CartesianGrid,
} from "recharts";
import { config } from "../config";
import type { Observation } from "../types";

export function HistoryChart({ observations }: { observations: Observation[] }) {
  if (observations.length === 0) return <section><h2>Last 7 Days</h2><p>No history yet</p></section>;
  const cutoff = Date.now() - 7 * 864e5;
  const data = observations
    .filter((o) => new Date(o.time).getTime() >= cutoff)
    .map((o) => ({ t: new Date(o.time).getTime(), mid: (o.low + o.high) / 2 }));
  return (
    <section className="history-chart">
      <h2>Last 7 Days</h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <ReferenceArea y1={config.goodLowMph} y2={config.goodHighMph} fillOpacity={0.15} fill="green" />
          <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]}
                 tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, { weekday: "short" })} />
          <YAxis unit=" mph" />
          <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleString()} />
          <Line type="monotone" dataKey="mid" dot={false} stroke="#0369a1" />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && npx vitest run src/components/HistoryChart.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/HistoryChart.tsx web/src/components/HistoryChart.test.tsx
git commit -m "feat: 7-day history chart"
```

---

### Task 16: HourPattern component

**Files:**
- Create: `web/src/components/HourPattern.tsx`
- Test: `web/src/components/HourPattern.test.tsx`

**Interfaces:**
- Consumes: `hourPattern`, `Observation`, Recharts.
- Produces: `export function HourPattern({ observations }: { observations: Observation[] }): JSX.Element` — a bar chart of average mid wind per hour-of-day. Empty state "Not enough data yet".

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HourPattern } from "./HourPattern";

describe("HourPattern", () => {
  it("empty state", () => {
    render(<HourPattern observations={[]} />);
    expect(screen.getByText(/Not enough data yet/i)).toBeTruthy();
  });
  it("renders with data", () => {
    const { container } = render(
      <HourPattern observations={[{ time: "2026-08-08T14:00:00-06:00", tempF: 90, dir: "SW", low: 15, high: 20 }]} />
    );
    expect(container.querySelector(".hour-pattern")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run src/components/HourPattern.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { hourPattern } from "../analytics";
import type { Observation } from "../types";

export function HourPattern({ observations }: { observations: Observation[] }) {
  const data = hourPattern(observations);
  if (data.length === 0) return <section><h2>When Is It Usually Good?</h2><p>Not enough data yet</p></section>;
  return (
    <section className="hour-pattern">
      <h2>When Is It Usually Good?</h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
          <YAxis unit=" mph" />
          <Tooltip formatter={(v: number) => `${v.toFixed(1)} mph`} labelFormatter={(h) => `${h}:00`} />
          <Bar dataKey="avgMid" fill="#0369a1" />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && npx vitest run src/components/HourPattern.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/HourPattern.tsx web/src/components/HourPattern.test.tsx
git commit -m "feat: hour-of-day pattern chart"
```

---

### Task 17: ForecastVsActual + ModelScoreboard components

**Files:**
- Create: `web/src/components/ForecastVsActual.tsx`, `web/src/components/ModelScoreboard.tsx`
- Test: `web/src/components/ModelScoreboard.test.tsx`

**Interfaces:**
- Consumes: `scoreboard`, `actualDailyPeak`, `forecastDailyPeak`, `Observation`, `Forecast`.
- Produces:
  - `export function ModelScoreboard({ observations, forecasts }): JSX.Element` — table of `key | MAE (mph) | days`, best first; empty state "No overlapping days yet".
  - `export function ForecastVsActual({ observations, forecasts }): JSX.Element` — per-day rows: date, actual peak, each model's predicted peak, with the worst miss flagged.

- [ ] **Step 1: Write the failing test** (`ModelScoreboard.test.tsx`)

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ModelScoreboard } from "./ModelScoreboard";
import type { Forecast } from "../types";

const obs = [{ time: "2026-08-08T14:00:00-06:00", tempF: 90, dir: "SW", low: 18, high: 22 }];
const fc: Forecast[] = [
  { fetchedAt: "2026-08-07T18:00:00-06:00", source: "nws", model: "nws",
    validTime: "2026-08-08T14:00:00-06:00", windMph: 10, gustMph: null, dirDeg: 225 },
];

describe("ModelScoreboard", () => {
  it("empty when no overlap", () => {
    render(<ModelScoreboard observations={[]} forecasts={[]} />);
    expect(screen.getByText(/No overlapping days yet/i)).toBeTruthy();
  });
  it("lists a model row", () => {
    render(<ModelScoreboard observations={obs} forecasts={fc} />);
    expect(screen.getByText(/nws\/nws/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run src/components/ModelScoreboard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `ModelScoreboard.tsx`**

```tsx
import { scoreboard } from "../analytics";
import type { Observation, Forecast } from "../types";

export function ModelScoreboard(
  { observations, forecasts }: { observations: Observation[]; forecasts: Forecast[] }
) {
  const rows = scoreboard(observations, forecasts);
  if (rows.length === 0)
    return <section><h2>Model Scoreboard</h2><p>No overlapping days yet</p></section>;
  return (
    <section className="model-scoreboard">
      <h2>Model Scoreboard</h2>
      <table>
        <thead><tr><th>Source/Model</th><th>Avg error (mph)</th><th>Days</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}><td>{r.key}</td><td>{r.mae.toFixed(1)}</td><td>{r.days}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 4: Implement `ForecastVsActual.tsx`**

```tsx
import { actualDailyPeak, forecastDailyPeak } from "../analytics";
import type { Observation, Forecast } from "../types";

export function ForecastVsActual(
  { observations, forecasts }: { observations: Observation[]; forecasts: Forecast[] }
) {
  const actual = actualDailyPeak(observations);
  const fpeak = forecastDailyPeak(forecasts);
  const days = [...actual.keys()].filter((d) => fpeak.has(d)).sort().reverse();
  if (days.length === 0)
    return <section><h2>Forecast vs Actual</h2><p>No evaluated days yet</p></section>;
  const keys = [...new Set([...fpeak.values()].flatMap((m) => [...m.keys()]))].sort();
  return (
    <section className="forecast-vs-actual">
      <h2>Forecast vs Actual</h2>
      <table>
        <thead>
          <tr><th>Day</th><th>Actual peak</th>{keys.map((k) => <th key={k}>{k}</th>)}</tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const a = actual.get(d)!;
            const models = fpeak.get(d)!;
            return (
              <tr key={d}>
                <td>{d}</td><td>{a.toFixed(0)}</td>
                {keys.map((k) => {
                  const v = models.get(k);
                  const miss = v !== undefined && isFinite(v) && Math.abs(v - a) >= 8;
                  return <td key={k} className={miss ? "miss" : ""}>{v !== undefined && isFinite(v) ? v.toFixed(0) : "–"}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd web && npx vitest run src/components/ModelScoreboard.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/ForecastVsActual.tsx web/src/components/ModelScoreboard.tsx web/src/components/ModelScoreboard.test.tsx
git commit -m "feat: forecast-vs-actual and model scoreboard"
```

---

### Task 18: DataTable with CSV download

**Files:**
- Create: `web/src/components/DataTable.tsx`, `web/src/csv.ts`
- Test: `web/src/csv.test.ts`

**Interfaces:**
- Produces: `export function toCsv(observations: Observation[]): string` — header `time,tempF,dir,low,high` then rows.
- Produces: `export function DataTable({ observations }): JSX.Element` — collapsible `<details>` table (newest first) with a "Download CSV" button.

- [ ] **Step 1: Write the failing test** (`web/src/csv.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("emits header and rows", () => {
    const csv = toCsv([{ time: "2026-08-08T14:44:00-06:00", tempF: 95, dir: "SW", low: 15, high: 20 }]);
    expect(csv.split("\n")[0]).toBe("time,tempF,dir,low,high");
    expect(csv).toContain("2026-08-08T14:44:00-06:00,95,SW,15,20");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run src/csv.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `csv.ts`**

```ts
import type { Observation } from "./types";

export function toCsv(observations: Observation[]): string {
  const header = "time,tempF,dir,low,high";
  const rows = observations.map((o) => `${o.time},${o.tempF},${o.dir},${o.low},${o.high}`);
  return [header, ...rows].join("\n");
}
```

- [ ] **Step 4: Implement `DataTable.tsx`**

```tsx
import { toCsv } from "../csv";
import type { Observation } from "../types";

export function DataTable({ observations }: { observations: Observation[] }) {
  const rows = [...observations].sort((a, b) => (a.time < b.time ? 1 : -1));
  const download = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "barbed-wire-observations.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <details className="data-table">
      <summary>Full data ({rows.length} readings)</summary>
      <button onClick={download}>Download CSV</button>
      <table>
        <thead><tr><th>Time</th><th>°F</th><th>Dir</th><th>Low</th><th>High</th></tr></thead>
        <tbody>
          {rows.slice(0, 500).map((o, i) => (
            <tr key={i}><td>{new Date(o.time).toLocaleString()}</td><td>{o.tempF}</td><td>{o.dir}</td><td>{o.low}</td><td>{o.high}</td></tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd web && npx vitest run src/csv.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/DataTable.tsx web/src/csv.ts web/src/csv.test.ts
git commit -m "feat: data table with CSV download"
```

---

### Task 19: App assembly

**Files:**
- Modify: `web/src/App.tsx`, `web/src/main.tsx` (default from Vite), `web/src/App.css`
- Create dev sample data: `web/public/data/observations.ndjson`, `web/public/data/forecasts.ndjson`

**Interfaces:**
- Consumes: `loadData` and all components.
- Produces: the assembled dashboard; latest observation = max `time`.

- [ ] **Step 1: Provide dev sample data**

```bash
cp data/observations.ndjson web/public/data/observations.ndjson
cp data/forecasts.ndjson web/public/data/forecasts.ndjson
```

- [ ] **Step 2: Implement `App.tsx`**

```tsx
import { useEffect, useState } from "react";
import { loadData } from "./dataLoader";
import type { Observation, Forecast } from "./types";
import { Verdict } from "./components/Verdict";
import { HistoryChart } from "./components/HistoryChart";
import { HourPattern } from "./components/HourPattern";
import { ForecastVsActual } from "./components/ForecastVsActual";
import { ModelScoreboard } from "./components/ModelScoreboard";
import { DataTable } from "./components/DataTable";
import "./App.css";

export default function App() {
  const [obs, setObs] = useState<Observation[]>([]);
  const [fc, setFc] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData().then(({ observations, forecasts }) => {
      setObs(observations); setFc(forecasts); setLoading(false);
    });
  }, []);

  const latest = obs.length ? obs.reduce((a, b) => (a.time > b.time ? a : b)) : null;

  return (
    <main>
      <h1>Barbed Wire Beach — Deer Creek</h1>
      {loading ? <p>Loading…</p> : (
        <>
          <Verdict latest={latest} />
          <HistoryChart observations={obs} />
          <HourPattern observations={obs} />
          <ForecastVsActual observations={obs} forecasts={fc} />
          <ModelScoreboard observations={obs} forecasts={fc} />
          <DataTable observations={obs} />
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Minimal styles** — append to `web/src/App.css`:

```css
main { max-width: 820px; margin: 0 auto; padding: 1rem; font-family: system-ui, sans-serif; }
section { margin: 1.5rem 0; }
.verdict-good h1 { color: #15803d; } .verdict-gusty h1 { color: #b45309; }
.verdict-light h1 { color: #6b7280; } .verdict-strong h1 { color: #b91c1c; }
table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
td.miss { background: #fee2e2; font-weight: 600; }
```

- [ ] **Step 4: Run the full test suite + dev server**

Run: `cd web && npx vitest run`
Expected: all tests PASS.
Run: `cd web && npm run dev` — open the local URL; verify all sections render from sample data.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat: assemble dashboard app"
```

---

## Stage 6 — Deploy

### Task 20: GitHub Pages deploy + finalize config + README

**Files:**
- Create: `.github/workflows/deploy-web.yml`
- Modify: `web/vite.config.ts` (set `base`), `web/src/config.ts` (real `<user>`)
- Create: `README.md`

**Interfaces:**
- Produces: a published site that rebuilds only when `web/**` changes and fetches data from the repo's raw files.

- [ ] **Step 1: Set Vite base** in `web/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "/deer-creek-wind-tracker/",
});
```

- [ ] **Step 2: Replace `<user>`** in `web/src/config.ts` `dataBaseUrl` with the real GitHub username.

- [ ] **Step 3: Create `.github/workflows/deploy-web.yml`**

```yaml
name: deploy-web
on:
  push:
    branches: [main]
    paths: ["web/**", ".github/workflows/deploy-web.yml"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
        working-directory: web
      - run: npm run build
        working-directory: web
      - uses: actions/upload-pages-artifact@v3
        with:
          path: web/dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: Write `README.md`**

```markdown
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

## Tuning "good wind"
Edit the thresholds in `web/src/config.ts` (speed band, steadiness, ideal directions).
```

- [ ] **Step 5: Commit, push, enable Pages**

```bash
git add .github/workflows/deploy-web.yml web/vite.config.ts web/src/config.ts README.md
git commit -m "ci: GitHub Pages deploy and finalize config"
git push
```

On GitHub: Settings → Pages → Source = "GitHub Actions". Run `deploy-web` (or push a `web/**` change). Expected: the site publishes at `https://<user>.github.io/deer-creek-wind-tracker/` and loads live data after the `collect` workflow has committed some.

- [ ] **Step 6: End-to-end verification**

- Trigger `collect` manually; confirm a `data: collect …` commit lands.
- Open the Pages URL on your phone; confirm the verdict + charts render.
- After a day, confirm `Forecast vs Actual` and `Model Scoreboard` populate.

---

## Self-Review Notes (author)

- **Spec coverage:** observations (Tasks 2–5), forecasts Open-Meteo+NWS+models (6–8), 5-min/hourly cadence + single-workflow race avoidance (9), NDJSON append-only schemas (4, 8), classification thresholds §7 (12), all six site sections §8 (14–19), forecast-vs-actual & scoreboard methodology §8 (13, 17), raw-URL runtime data + deploy-only-on-web-change §9 (11, 20), Mountain-Time normalization (3). Phase II (§10) intentionally excluded.
- **`<user>` placeholder** is intentional and resolved in Task 20 Step 2 (and noted in config.ts).
