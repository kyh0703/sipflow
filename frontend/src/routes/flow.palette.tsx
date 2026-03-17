import { createFileRoute } from '@tanstack/react-router';
import { RoutePending } from '@/components/route-pending';
import { ScenarioBuilder } from '@/features/scenario/builder/components/scenario-builder';

function FlowPalettePage() {
  return <ScenarioBuilder activePanel="palette" />;
}

export const Route = createFileRoute('/flow/palette')({
  component: FlowPalettePage,
  pendingComponent: () => (
    <RoutePending
      title="Loading component palette..."
      description="노드 팔레트를 불러오는 중입니다."
    />
  ),
});
