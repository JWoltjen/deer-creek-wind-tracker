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
}
