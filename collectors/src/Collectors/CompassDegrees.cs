namespace Collectors;

public static class CompassDegrees
{
    private static readonly string[] Points =
        { "N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW" };

    public static int? ToDegrees(string? compass)
    {
        if (string.IsNullOrWhiteSpace(compass)) return null;
        var idx = Array.IndexOf(Points, compass.Trim().ToUpperInvariant());
        return idx < 0 ? null : idx * 360 / Points.Length;
    }
}
