import SideNav from "@/components/SideNav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <SideNav />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
