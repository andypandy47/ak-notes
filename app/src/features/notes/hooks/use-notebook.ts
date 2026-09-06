import { useContext } from "react";
import { NotebookContext } from "../context/notebook-context";

export function useNotebook() {
  const notebook = useContext(NotebookContext);
  if (!notebook) {
    throw new Error("useNotebook must be used within NotebookProvider");
  }
  return notebook;
}
