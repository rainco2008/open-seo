import { createFileRoute } from "@tanstack/react-router";
import { GoogleAdsPlannerPage } from "@/extensions/personal-google-ads/client/GoogleAdsPlannerPage";

export const Route = createFileRoute(
  "/_project/p/$projectId/google-ads-planner",
)({
  component: GoogleAdsPlannerRoute,
});

function GoogleAdsPlannerRoute() {
  const { projectId } = Route.useParams();
  return <GoogleAdsPlannerPage projectId={projectId} />;
}
