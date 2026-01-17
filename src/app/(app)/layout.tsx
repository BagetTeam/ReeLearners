import SideNav from "@/components/SideNav";
import {
  SidebarInset,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import SidebarFloatingTrigger from "@/components/SidebarFloatingTrigger";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="bg-background text-foreground">
      <SideNav />
      <SidebarRail />
      <SidebarFloatingTrigger />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
