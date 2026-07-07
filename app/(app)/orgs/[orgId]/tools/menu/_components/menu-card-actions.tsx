"use client";

/**
 * Menu card actions.
 * Reusable overflow actions for the menu cards so edit, duplicate, and delete
 * stay grouped behind the same compact trigger.
 */

import { Copy, Pencil, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type MenuCardMenu = {
  id: string;
  name: string;
  description: string | null;
};

export type { MenuCardMenu };

export function MenuCardActions({
  menu,
  menuId,
  disabled,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  menu: MenuCardMenu;
  menuId: string;
  disabled: boolean;
  onEdit: (menu: MenuCardMenu) => void;
  onDuplicate: (menuId: string) => void;
  onDelete: (menuId: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Menu actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => onEdit(menu)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onDuplicate(menuId)}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => onDelete(menuId)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}