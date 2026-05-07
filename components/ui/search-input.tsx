import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

export function SearchInput({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof Input> & { containerClassName?: string }) {
  return (
    <div className={cn("relative", containerClassName)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <Input className={cn("pl-8", className)} {...props} />
    </div>
  );
}
