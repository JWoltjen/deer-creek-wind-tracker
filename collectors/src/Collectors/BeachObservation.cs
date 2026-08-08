using System.Globalization;
using HtmlAgilityPack;

namespace Collectors;

public record RawBeachRow(string RawTime, int TempF, string Dir, int Low, int High);

public static class BeachParser
{
    public static IReadOnlyList<RawBeachRow> Parse(string html)
    {
        var doc = new HtmlDocument();
        doc.LoadHtml(html);
        var table = doc.DocumentNode.SelectSingleNode("//table");
        var result = new List<RawBeachRow>();
        if (table is null) return result;

        foreach (var tr in table.SelectNodes(".//tr") ?? Enumerable.Empty<HtmlNode>())
        {
            var tds = tr.SelectNodes("./td");
            if (tds is null || tds.Count < 4) continue; // header/spacer rows

            var time = Clean(tds[0].InnerText);
            var speed = Clean(tds[3].InnerText);
            if (string.IsNullOrWhiteSpace(speed)) continue;

            if (!int.TryParse(Clean(tds[1].InnerText), NumberStyles.Integer,
                    CultureInfo.InvariantCulture, out var temp)) continue;

            var (low, high) = ParseRange(speed);
            if (low < 0) continue;

            result.Add(new RawBeachRow(time, temp, Clean(tds[2].InnerText), low, high));
        }
        return result;
    }

    private static (int low, int high) ParseRange(string s)
    {
        var parts = s.Split('-', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 2
            && int.TryParse(parts[0], out var lo) && int.TryParse(parts[1], out var hi))
            return (lo, hi);
        if (parts.Length == 1 && int.TryParse(parts[0], out var v))
            return (v, v);
        return (-1, -1);
    }

    private static string Clean(string s) =>
        System.Net.WebUtility.HtmlDecode(s).Replace(" ", " ").Trim();
}
