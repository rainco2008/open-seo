import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnalyticsPage } from "../../src/client/features/ga4/AnalyticsPage";
import { SearchDiagnostics } from "../../src/client/features/search-performance/SearchDiagnostics";

const styles = await import("../../src/client/styles/app.css");
void styles;

// Browser tests replace only the data boundaries via Playwright interception.
// This entry is not imported by the application or included in production.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AnalyticsPage projectId="fixture-project" />
    <SearchDiagnostics projectId="fixture-project" dateRange="last_28_days" />
  </QueryClientProvider>,
);
