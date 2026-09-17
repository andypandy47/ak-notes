import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { formatDate } from "@/utils/format-date";
import { useNotebook } from "../hooks/use-notebook";
import { useSidebar } from "@/components/ui/sidebar";

export function PageList() {
  const { visiblePages: pages, activeSummary, selectPage, isLoading } = useNotebook();
  const { isMobile, setOpenMobile } = useSidebar();
  function handleSelectPage(id: string) {
    selectPage(id);
    if (isMobile) {
      setOpenMobile(false);
    }
  }
  return (
    <nav aria-label="Your pages" aria-busy={isLoading}>
      <SidebarMenu className="gap-1">
        {isLoading ? (
          <PageListSkeleton />
        ) : (
          pages.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                size="lg"
                className="h-auto items-start gap-3 px-3 py-3.5"
                isActive={item.id === activeSummary?.id}
                onClick={() => handleSelectPage(item.id)}
                aria-current={item.id === activeSummary?.id ? "page" : undefined}
              >
                <FileText aria-hidden="true" />
                <span className="flex min-w-0 flex-col gap-1 text-xs font-medium">
                  <span className="truncate">{item.title || "Untitled"}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Edited {formatDate(item.updatedAt)}
                  </span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))
        )}
      </SidebarMenu>
      {!isLoading && !pages.length && (
        <p className="px-4 py-3 text-sm text-muted-foreground">No matching pages.</p>
      )}
    </nav>
  );
}

function PageListSkeleton() {
  return Array.from({ length: 4 }, (_, index) => (
    <SidebarMenuItem key={index} aria-hidden="true">
      <SidebarMenuButton
        size="lg"
        className="h-auto items-start gap-3 px-3 py-3.5 bg-sidebar-foreground/25"
        disabled
      >
        <Skeleton className="size-4 shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ));
}
