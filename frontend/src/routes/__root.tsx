import { Outlet, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { Toaster } from '@/components/ui/sonner';

function RootComponent() {
  return (
    <>
      <Toaster position="bottom-right" richColors />
      <Outlet />
      <TanStackRouterDevtools position="bottom-left" initialIsOpen={false} />
    </>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
