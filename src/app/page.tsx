import ConsentGatePage from "@/components/ConsentGatePage";
import { DEMO_SCENARIOS } from "@/demo/scenarios";
import { getEvaluationDate } from "@/server/clock";
import { getContainer } from "@/server/container";

// The page must render with the server's current evaluation date on every
// request, not the build date.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <ConsentGatePage
      policy={getContainer().policy}
      presets={DEMO_SCENARIOS}
      evaluationDate={getEvaluationDate()}
    />
  );
}
