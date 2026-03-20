import { createFileRoute } from '@tanstack/react-router';
import { RoutePending } from '@/components/route-pending';

function SettingsMediaPage() {
  return (
    <div className="p-6">
      <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-6 text-sm text-muted-foreground">
        추후 미디어 관련 전역 설정을 이 영역에 추가할 예정입니다.
      </div>
    </div>
  );
}

export const Route = createFileRoute('/settings/media')({
  component: SettingsMediaPage,
  pendingComponent: () => (
    <RoutePending
      title="Loading media settings..."
      description="미디어 설정 화면을 준비하고 있습니다."
    />
  ),
});
