import type { ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export function VaultPanel({
  title,
  description,
  children,
  footer,
  isLoading = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  isLoading?: boolean;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4 sm:p-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="gap-2">
          <LockKeyhole className="size-6 text-primary" aria-hidden="true" />
          <CardTitle className="flex items-center gap-2">
            <h1>{title}</h1> {isLoading && <Spinner className="size-4" />}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
        {footer && <CardFooter>{footer}</CardFooter>}
      </Card>
    </main>
  );
}
