import { Outlet, createRootRoute } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/sonner';

function RootComponent() {
  return (
    <>
      <Toaster position="bottom-right" richColors />
      <Outlet />
    </>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
