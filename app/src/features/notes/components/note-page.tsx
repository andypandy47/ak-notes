import { ArrowUpRight, FileText, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatTime } from "@/utils/format-date";
import { NoteEditor } from "./note-editor";
import { useNotebook } from "../hooks/use-notebook";

export function NotePage() {
  const {
    activePage: page,
    updatePage,
    addPage,
    isLoading,
    isPageLoading,
    loadError,
  } = useNotebook();

  if (isLoading || isPageLoading) {
    return <NotePageSkeleton />;
  }

  if (loadError) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Could not open your pages</EmptyTitle>
          <EmptyDescription>{loadError.message}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!page) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>A little room for your thoughts</EmptyTitle>
          <EmptyDescription>Create your first encrypted page and start writing.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={addPage}>Create a page</Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8 md:px-10 md:py-10 lg:px-16 lg:py-16">
      <div className="flex items-center gap-4 text-xs tracking-widest text-muted-foreground">
        <span className="flex rounded-xl border border-border bg-muted p-3 md:p-4 text-primary">
          <FileText className="size-6" aria-hidden="true" />
        </span>
        <span>A PAGE OF YOUR OWN</span>
      </div>
      <Textarea
        key={page.document.id}
        className="min-h-12 resize-none border-0 px-0 py-0 font-serif text-3xl md:text-4xl lg:text-5xl leading-tight font-normal tracking-tight"
        aria-label="Page title"
        placeholder="Untitled"
        rows={2}
        value={page.document.title}
        onChange={(event) => updatePage(page.document.id, { title: event.target.value })}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Clock3 className="size-3" aria-hidden="true" />
        <span>
          Edited {formatDate(page.updatedAt)} at {formatTime(page.updatedAt)}
        </span>
        <span>·</span>
        <span>{page.document.blocks.length} blocks</span>
      </div>
      <div className="-mx-4">
        <NoteEditor
          key={page.document.id}
          initialContent={page.document.blocks}
          onChange={(blocks) => updatePage(page.document.id, { blocks })}
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
        <span>Type / for blocks. Grab the ⋮⋮ handle to move them.</span>
      </div>
    </article>
  );
}

function NotePageSkeleton() {
  return (
    <article
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8 md:px-10 md:py-10 lg:px-16 lg:py-16"
      aria-label="Opening your pages"
      aria-busy="true"
    >
      <div className="flex items-center gap-4" aria-hidden="true">
        <Skeleton className="size-12 rounded-xl md:size-14" />
        <Skeleton className="h-3 w-36" />
      </div>

      <div className="flex min-h-24 flex-col gap-3" aria-hidden="true">
        <Skeleton className="h-10 w-3/4 lg:h-12" />
        <Skeleton className="h-10 w-1/2 lg:h-12" />
      </div>

      <div className="flex items-center gap-2" aria-hidden="true">
        <Skeleton className="size-3" />
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-3 w-14" />
      </div>

      <div className="flex min-h-64 flex-col gap-4 px-4 py-2" aria-hidden="true">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="mt-4 h-6 w-2/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      <div className="flex items-center gap-2" aria-hidden="true">
        <Skeleton className="size-4" />
        <Skeleton className="h-3 w-72 max-w-full" />
      </div>
    </article>
  );
}
