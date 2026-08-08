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
