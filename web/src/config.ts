export const config = {
  location: { name: "Barbed Wire Beach — Deer Creek", lat: 40.4471, lon: -111.4776 },
  // Data is fetched at runtime from the repo's raw files. Replace <user> after first push.
  dataBaseUrl: import.meta.env.DEV
    ? "/data"
    : "https://raw.githubusercontent.com/<user>/deer-creek-wind-tracker/main/data",
  goodLowMph: 15,
  goodHighMph: 26,
  steadySpreadMax: 5,
  gustySpreadMax: 10,
  idealDirs: ["SW", "SSW", "WSW"],
  okDirs: ["S", "W"],
  dayStartHour: 9,
  dayEndHour: 20,
} as const;
