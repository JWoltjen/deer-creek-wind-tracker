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
        Assert.Equal(0, NwsParser.ParseSpeed(null));
        Assert.Equal(0, NwsParser.ParseSpeed("Calm"));
    }

    [Fact]
    public void Parses_windGust_object_form()
    {
        var json = """
            {
              "properties": {
                "periods": [
                  {
                    "startTime": "2026-08-01T00:00:00+00:00",
                    "windSpeed": "10 mph",
                    "windGust": { "unitCode": "wmoUnit:km_h", "value": 22.0 },
                    "windDirection": "N"
                  }
                ]
              }
            }
            """;
        var rows = NwsParser.Parse(json, DateTimeOffset.UtcNow);
        Assert.Single(rows);
        Assert.Equal(22.0, rows[0].gustMph);
    }

    [Fact]
    public void Parses_windGust_string_form_still_works()
    {
        var json = """
            {
              "properties": {
                "periods": [
                  {
                    "startTime": "2026-08-01T00:00:00+00:00",
                    "windSpeed": "10 mph",
                    "windGust": "15 mph",
                    "windDirection": "N"
                  }
                ]
              }
            }
            """;
        var rows = NwsParser.Parse(json, DateTimeOffset.UtcNow);
        Assert.Single(rows);
        Assert.Equal(15.0, rows[0].gustMph);
    }
}
