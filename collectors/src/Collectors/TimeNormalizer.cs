using System.Globalization;

namespace Collectors;

public static class TimeNormalizer
{
    private static readonly TimeZoneInfo Mt = TimeZoneInfo.FindSystemTimeZoneById("America/Denver");
    private static readonly string[] Formats = { "MM/dd h:mm tt", "MM/dd hh:mm tt" };

    public static DateTimeOffset Normalize(string rawMonthDayTime, DateTimeOffset nowUtc)
    {
        var s = System.Text.RegularExpressions.Regex.Replace(rawMonthDayTime.Trim(), @"\s+", " ");
        var nowMt = TimeZoneInfo.ConvertTime(nowUtc, Mt);

        var md = DateTime.ParseExact(s, Formats, CultureInfo.InvariantCulture, DateTimeStyles.None);
        var year = nowMt.Year;
        var candidate = new DateTime(year, md.Month, md.Day, md.Hour, md.Minute, 0, DateTimeKind.Unspecified);

        // If the timestamp lands clearly in the future, it belongs to the previous year.
        if (candidate > nowMt.DateTime.AddDays(2))
            candidate = candidate.AddYears(-1);

        var offset = Mt.GetUtcOffset(candidate);
        return new DateTimeOffset(candidate, offset);
    }
}
