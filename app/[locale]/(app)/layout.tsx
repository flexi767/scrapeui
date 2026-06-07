import { SessionProvider } from '@/components/SessionProvider';
import { AppSidebar } from '@/components/AppSidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TooltipProvider>
        <div className="flex h-screen flex-col overflow-hidden bg-[#111827]">
          <AppSidebar />
          <main className="min-h-0 flex-1 overflow-y-auto p-4">{children}</main>
        </div>
      </TooltipProvider>
    </SessionProvider>
  );
}
