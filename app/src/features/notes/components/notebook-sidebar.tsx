import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  useSidebar,
} from "@/components/ui/sidebar";
import { CloudOff, Feather, Plus, Search } from "lucide-react";
import { useNotebook } from "../hooks/use-notebook";
import { PageList } from "./page-list";

export function NotebookSidebar() {
  const { pageCount, query, setQuery, addPage } = useNotebook();
  const { isMobile, setOpenMobile } = useSidebar();
  function createPage() {
    addPage();
    if (isMobile) {
      setOpenMobile(false);
    }
  }
  return (
    <Sidebar collapsible="offcanvas" aria-label="Pages">
      <SidebarHeader className="gap-0 p-0">
        <div className="flex items-center gap-3 px-5 py-7 text-xl font-semibold tracking-tight">
          <span className="rounded-lg bg-accent p-2.5 text-primary">
            <Feather className="size-5" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            ak notes
            <span className="text-xs font-medium tracking-wide text-muted-foreground">
              YOUR PERSONAL SPACE
            </span>
          </span>
        </div>
        <div className="flex flex-col gap-3 px-5 pb-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <SidebarInput
              aria-label="Search pages"
              placeholder="Find a page…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Button className="w-full" variant="outline" onClick={createPage}>
            <Plus data-icon="inline-start" />
            New page
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-2.5">
          <SidebarGroupLabel className="flex justify-between">
            <span>YOUR PAGES</span>
            <span>{pageCount}</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <PageList />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-2 border-t border-border p-5">
        <div className="flex items-center gap-2 text-xs">
          <CloudOff className="size-4 shrink-0" aria-hidden="true" />
          <span>Cloud sync not connected</span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Design preview · changes stay in this session
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
