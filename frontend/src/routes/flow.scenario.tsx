import { createFileRoute } from '@tanstack/react-router';
import { RoutePending } from '@/components/route-pending';
import { ScenarioBuilder } from '@/features/scenario/builder/components/scenario-builder';

function FlowScenarioPage() {
  return <ScenarioBuilder activePanel="scenario" />;
}

export const Route = createFileRoute('/flow/scenario')({
  component: FlowScenarioPage,
  pendingComponent: () => (
    <RoutePending
      title="Loading scenario workspace..."
      description="시나리오 빌더를 불러오는 중입니다."
    />
  ),
});
