using Collectors;
using Xunit;

public class TimeNormalizerTests
{
    private static readonly TimeZoneInfo Mt = TimeZoneInfo.FindSystemTimeZoneById("America/Denver");

    [Fact]
    public void Attaches_year_and_mountain_offset_in_summer()
    {
        var now = new DateTimeOffset(2026, 8, 8, 21, 0, 0, TimeSpan.Zero); // 3pm MDT
        var t = TimeNormalizer.Normalize("08/08  02:44 PM", now);
        Assert.Equal(2026, t.Year);
        Assert.Equal(8, t.Month);
        Assert.Equal(14, t.Hour);
        Assert.Equal(TimeSpan.FromHours(-6), t.Offset); // MDT
    }

    [Fact]
    public void Handles_variable_whitespace()
    {
        var now = new DateTimeOffset(2026, 8, 8, 21, 0, 0, TimeSpan.Zero);
        var t = TimeNormalizer.Normalize("08/08 2:44 pm", now);
        Assert.Equal(14, t.Hour);
    }

    [Fact]
    public void Rolls_back_a_year_across_new_year()
    {
        var now = new DateTimeOffset(2026, 1, 1, 8, 0, 0, TimeSpan.Zero); // 1am MST Jan 1 2026
        var t = TimeNormalizer.Normalize("12/31  11:50 PM", now);
        Assert.Equal(2025, t.Year);
        Assert.Equal(TimeSpan.FromHours(-7), t.Offset); // MST
    }
}
