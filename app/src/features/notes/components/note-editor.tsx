import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import type { Page } from "../types";
import "@blocknote/shadcn/style.css";

type NoteEditorProps = {
  initialContent: Page["blocks"];
  onChange: (blocks: Page["blocks"]) => void;
};

export function NoteEditor({ initialContent, onChange }: NoteEditorProps) {
  const editor = useCreateBlockNote({ initialContent });
  // BlockNote owns these internal elements and theme variables; scoped variants
  // bridge its vendor styles to our Tailwind tokens without a custom stylesheet.
  return (
    <BlockNoteView
      className="[--bn-colors-editor-background:var(--background)] [--bn-colors-editor-text:var(--foreground)] [--bn-font-family:var(--font-sans)] [&_.bn-editor]:bg-transparent! [&_.bn-editor]:text-sm! [&_.bn-editor]:leading-relaxed! [&_.bn-editor]:px-4! [&_.bn-block-content[data-content-type=heading]]:mt-6!"
      editor={editor}
      theme="light"
      onChange={() => onChange(editor.document)}
    />
  );
}
