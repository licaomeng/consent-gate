import ConsentGatePage from "@/components/ConsentGatePage";
import { DEMO_SCENARIOS } from "@/demo/scenarios";
import { getContainer } from "@/server/container";

export default function Home() {
  return (
    <ConsentGatePage policy={getContainer().policy} presets={DEMO_SCENARIOS} />
  );
}
