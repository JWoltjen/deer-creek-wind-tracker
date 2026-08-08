using Collectors;
using Xunit;

public class NdjsonStoreTests
{
    private static Observation Obs(string iso, int low, int high) =>
        new(DateTimeOffset.Parse(iso), 90, "SW", low, high);

    [Fact]
    public void Appends_only_newer_and_dedups()
    {
        var path = Path.GetTempFileName();
        try
        {
            var first = NdjsonStore.AppendNewObservations(path, new[]
            {
                Obs("2026-08-08T14:44:00-06:00", 15, 20),
                Obs("2026-08-08T14:42:00-06:00", 14, 19),
            });
            Assert.Equal(2, first);

            // Overlapping fetch: one old (dup) + one new
            var second = NdjsonStore.AppendNewObservations(path, new[]
            {
                Obs("2026-08-08T14:44:00-06:00", 15, 20),  // not newer -> skip
                Obs("2026-08-08T14:46:00-06:00", 16, 21),  // newer -> keep
            });
            Assert.Equal(1, second);

            var lines = File.ReadAllLines(path);
            Assert.Equal(3, lines.Length);
            Assert.Contains("\"low\":16", lines[2]);
            Assert.DoesNotContain("\n\n", File.ReadAllText(path));
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void Empty_input_writes_nothing()
    {
        var path = Path.GetTempFileName();
        try
        {
            File.WriteAllText(path, "");
            Assert.Equal(0, NdjsonStore.AppendNewObservations(path, Array.Empty<Observation>()));
            Assert.Equal("", File.ReadAllText(path));
        }
        finally { File.Delete(path); }
    }
}
