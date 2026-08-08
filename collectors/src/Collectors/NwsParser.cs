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
            // /forecast/hourly returns windGust as a string ("15 mph"); other NWS endpoints return an object {"unitCode":...,"value":15.0}
            double? gust = null;
            if (p.TryGetProperty("windGust", out var g))
            {
                if (g.ValueKind == JsonValueKind.String)
                    gust = ParseSpeed(g.GetString());
                else if (g.ValueKind == JsonValueKind.Object
                         && g.TryGetProperty("value", out var gv)
                         && gv.ValueKind == JsonValueKind.Number)
                    gust = gv.GetDouble();
            }
            var dir = CompassDegrees.ToDegrees(p.TryGetProperty("windDirection", out var d) ? d.GetString() : null);
            rows.Add(new ForecastRow(fetchedAt, "nws", "nws", validTime, wind, gust, dir));
        }
        return rows;
    }
}
