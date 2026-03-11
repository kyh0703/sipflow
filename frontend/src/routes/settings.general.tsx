import { createFileRoute } from '@tanstack/react-router';
import { RoutePending } from '@/components/route-pending';

function SettingsGeneralPage() {
  return (
    <div className="p-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">General</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          추후 전역 기본값과 일반 설정을 이 영역에 추가할 예정입니다.
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/settings/general')({
  component: SettingsGeneralPage,
  pendingComponent: () => (
    <RoutePending
      title="Loading general settings..."
      description="일반 설정 화면을 준비하고 있습니다."
    />
  ),
});
