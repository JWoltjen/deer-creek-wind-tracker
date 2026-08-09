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

    [Fact]
    public void BuildObservations_produces_normalized_rows()
    {
        var now = new DateTimeOffset(2026, 8, 8, 21, 0, 0, TimeSpan.Zero);
        var obs = Collectors.ObservationsRunner.BuildObservations(Html(), now);
        Assert.Equal(10, obs.Count);
        Assert.All(obs, o => Assert.Equal(2026, o.time.Year));
        Assert.All(obs, o => Assert.True(o.high >= o.low));
    }

    [Fact]
    public void MergeDistinct_dedupes_by_time_and_sorts()
    {
        var t1 = new DateTimeOffset(2026, 8, 9, 14, 40, 0, TimeSpan.FromHours(-6));
        var t2 = new DateTimeOffset(2026, 8, 9, 14, 42, 0, TimeSpan.FromHours(-6));
        var t3 = new DateTimeOffset(2026, 8, 9, 14, 44, 0, TimeSpan.FromHours(-6));
        var all = new[]
        {
            new Observation(t2, 90, "SW", 15, 20), new Observation(t1, 90, "SW", 14, 19),
            new Observation(t3, 90, "SW", 16, 21), new Observation(t2, 90, "SW", 15, 20), // dup t2
        };
        var merged = Collectors.ObservationsRunner.MergeDistinct(all);
        Assert.Equal(3, merged.Count);
        Assert.Equal(t1, merged[0].time);
        Assert.Equal(t3, merged[2].time);
    }
}
