namespace Collectors;

public static class Program
{
    public static async Task<int> Main(string[] args)
    {
        var mode = args.Length > 0 ? args[0] : "";
        var repoRoot = args.Length > 1 ? args[1] : Directory.GetCurrentDirectory();
        return mode switch
        {
            "observations" => await ObservationsRunner.RunAsync(repoRoot),
            "forecasts"    => await ForecastRunner.RunAsync(repoRoot),
            _ => Fail($"unknown mode '{mode}', expected 'observations' or 'forecasts'"),
        };
    }

    private static int Fail(string msg)
    {
        Console.Error.WriteLine(msg);
        return 2;
    }
}
