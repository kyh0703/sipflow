import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router';
import { SettingsLayout } from '@/layouts/settings-layout';

function SettingsRouteComponent() {
  const location = useLocation();
  const activeTab = location.pathname.endsWith('/general')
    ? 'general'
    : location.pathname.endsWith('/media')
      ? 'media'
      : location.pathname.endsWith('/pbx')
        ? 'pbx'
        : null;

  return (
    <SettingsLayout activeTab={activeTab}>
      <Outlet />
    </SettingsLayout>
  );
}

export const Route = createFileRoute('/settings')({
  component: SettingsRouteComponent,
});
