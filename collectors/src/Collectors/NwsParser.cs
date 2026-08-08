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
