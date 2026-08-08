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
