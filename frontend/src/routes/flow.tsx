import { Outlet, createFileRoute } from '@tanstack/react-router';
import { FlowLayout } from '@/layouts/flow-layout';

function FlowRouteComponent() {
  return (
    <FlowLayout>
      <Outlet />
    </FlowLayout>
  );
}

export const Route = createFileRoute('/flow')({
  component: FlowRouteComponent,
});
