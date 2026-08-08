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
