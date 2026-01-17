import SideNav from "@/components/SideNav";
import {
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <SideNav />
      <SidebarRail />
      <div className="pointer-events-none fixed left-4 top-4 z-40">
        <SidebarTrigger className="pointer-events-auto bg-white shadow-sm dark:bg-black" />
      </div>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
