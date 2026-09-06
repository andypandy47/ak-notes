import { FileText } from "lucide-react";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { formatDate } from "@/utils/format-date";
import { useNotebook } from "../hooks/use-notebook";
import { useSidebar } from "@/components/ui/sidebar";

export function PageList() {
  const { visiblePages: pages, activePage, selectPage } = useNotebook();
  const { isMobile, setOpenMobile } = useSidebar();
  function handleSelectPage(id: string) {
    selectPage(id);
    if (isMobile) {
      setOpenMobile(false);
    }
  }
  return (
    <nav aria-label="Your pages">
      <SidebarMenu className="gap-1">
        {pages.map((item) => (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              size="lg"
              className="h-auto items-start gap-3 px-3 py-3.5"
              isActive={item.id === activePage?.id}
              onClick={() => handleSelectPage(item.id)}
              aria-current={item.id === activePage?.id ? "page" : undefined}
            >
              <FileText aria-hidden="true" />
              <span className="flex min-w-0 flex-col gap-1 text-xs font-medium">
                <span className="truncate">{item.title || "Untitled"}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Edited {formatDate(item.updated)}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
      {!pages.length && (
        <p className="px-4 py-3 text-sm text-muted-foreground">No matching pages.</p>
      )}
    </nav>
  );
}
