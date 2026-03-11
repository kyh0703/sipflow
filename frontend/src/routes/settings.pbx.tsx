import { createFileRoute } from '@tanstack/react-router';
import { RoutePending } from '@/components/route-pending';
import { SettingsPanel } from '@/features/scenario-builder/components/settings-panel';

export const Route = createFileRoute('/settings/pbx')({
  component: SettingsPanel,
  pendingComponent: () => (
    <RoutePending
      title="Loading PBX settings..."
      description="PBX 설정 화면을 불러오는 중입니다."
    />
  ),
});
