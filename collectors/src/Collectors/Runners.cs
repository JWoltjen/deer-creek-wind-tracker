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
    public static Task<int> RunAsync(string repoRoot) => Task.FromResult(0);
}
