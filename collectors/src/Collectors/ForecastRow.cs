namespace Collectors;

public record ForecastRow(
    DateTimeOffset fetchedAt, string source, string model, string validTime,
    double windMph, double? gustMph, int? dirDeg);
