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
}
