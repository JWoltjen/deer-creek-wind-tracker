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
            req.Headers.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/geo+json"));
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
