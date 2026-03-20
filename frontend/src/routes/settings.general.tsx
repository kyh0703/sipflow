import { createFileRoute } from '@tanstack/react-router';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { RoutePending } from '@/components/route-pending';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function SettingsGeneralPage() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="space-y-6 p-6">
      <section className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground">기본 설정</h2>

        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm dark:border-white/5 dark:bg-[#20222b]">
          <div className="px-5 py-5">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
              <div className="min-w-0 flex-1 space-y-1.5 text-left">
                <h3 className="text-base font-semibold tracking-tight text-foreground">기본 테마</h3>
                <p className="text-xs leading-5 text-muted-foreground">
                  앱에서 사용할 기본 테마를 선택합니다.
                </p>
              </div>
              <div className="w-full shrink-0 sm:w-40">
                {mounted ? (
                  <Select value={theme ?? 'system'} onValueChange={setTheme}>
                    <SelectTrigger
                      aria-label="기본 테마"
                      className="border-border/70 bg-background/80 text-sm font-medium shadow-none dark:border-white/10 dark:bg-[#262935]"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">
                        <span className="flex items-center gap-2">
                          <Monitor className="h-4 w-4" />
                          System
                        </span>
                      </SelectItem>
                      <SelectItem value="dark">
                        <span className="flex items-center gap-2">
                          <Moon className="h-4 w-4" />
                          Dark
                        </span>
                      </SelectItem>
                      <SelectItem value="light">
                        <span className="flex items-center gap-2">
                          <Sun className="h-4 w-4" />
                          Light
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="h-9 rounded-md border border-border/70 bg-muted/40 dark:border-white/10 dark:bg-white/5" />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
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
