import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/flow/')({
  beforeLoad: () => {
    throw redirect({ to: '/flow/scenario' });
  },
});
