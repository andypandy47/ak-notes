import { useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import reactLogo from "./assets/react.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import "./App.css";

function App() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function greet() {
    if (!name.trim() || pending) return;
    setPending(true);
    try {
      setMessage(isTauri()
        ? await invoke<string>("greet", { name: name.trim() })
        : `Hello, ${name.trim()}! You're trying the browser preview.`);
    } catch {
      setMessage("The greeting could not be loaded. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted/40 px-6 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-6">
          <a href="https://vite.dev" target="_blank" rel="noreferrer" aria-label="Vite documentation"><img src="/vite.svg" className="size-10" alt="Vite" /></a>
          <a href="https://tauri.app" target="_blank" rel="noreferrer" aria-label="Tauri documentation"><img src="/tauri.svg" className="size-10" alt="Tauri" /></a>
          <a href="https://react.dev" target="_blank" rel="noreferrer" aria-label="React documentation"><img src={reactLogo} className="size-10" alt="React" /></a>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to AK Notes</h1>
        <p className="text-sm text-muted-foreground">A small beginning for your personal notebook.</p>
      </header>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Say hello</CardTitle>
          <CardDescription>Enter your name to try the greeting.</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="greeting-form" onSubmit={(event) => { event.preventDefault(); void greet(); }}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="greet-name">Your name</FieldLabel>
                <Input id="greet-name" placeholder="Enter your name" autoComplete="given-name" value={name} onChange={(event) => setName(event.target.value)} disabled={pending} required />
              </Field>
              <p role="status" aria-live="polite" className="min-h-10 text-sm text-muted-foreground">{message || "Your greeting will appear here."}</p>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="submit" form="greeting-form" disabled={pending || !name.trim()}>{pending ? "Greeting…" : "Greet"}</Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => { setName(""); setMessage(""); }}>Reset</Button>
        </CardFooter>
      </Card>
    </main>
  );
}

export default App;
