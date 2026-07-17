"use client";

/* eslint-disable @next/next/no-img-element */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialogs/dialog";

import type { ResolvedMenuItem } from "./types";

type MenuItemDialogProps = {
  item: ResolvedMenuItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MenuItemDialog({ item, open, onOpenChange }: MenuItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[calc(100vw-1.25rem)] max-w-sm gap-0 overflow-hidden rounded-3xl border border-stone-200 bg-background p-0 shadow-2xl sm:max-w-4xl sm:w-full">
        <div className="flex max-h-[88vh] min-h-0 flex-col overflow-hidden md:flex-row">
          <div className="relative h-56 shrink-0 bg-stone-100 sm:h-80 md:h-auto md:min-h-[32rem] md:w-[48%]">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-amber-50 via-stone-100 to-stone-200">
                <span className="text-7xl opacity-35 sm:text-8xl">🍽️</span>
              </div>
            )}

            {item.price !== null && (
              <div className="absolute left-4 top-4 rounded-2xl bg-stone-950/85 px-4 py-2 shadow-lg backdrop-blur-sm sm:left-5 sm:top-5">
                <span className="text-lg font-extrabold text-amber-400 sm:text-xl">
                  ${item.price.toFixed(2)}
                </span>
              </div>
            )}

            {(item.unit || item.calories !== null) && (
              <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-stone-950/55 via-stone-950/20 to-transparent px-4 pb-4 pt-10 sm:px-6 sm:pb-6">
                <p className="max-w-[18rem] text-sm font-medium leading-5 text-white/90 sm:text-base sm:leading-6">
                  {item.calories !== null ? `${item.calories} cal` : item.unit}
                </p>
              </div>
            )}
          </div>

          <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overflow-x-hidden px-5 py-5 sm:px-6 sm:py-6 md:w-[52%]">
            <DialogHeader className="mb-0 gap-2">
              <DialogTitle className="min-w-0 w-full whitespace-normal break-words text-2xl font-extrabold leading-tight tracking-tight text-stone-900 sm:text-3xl">
                {item.title}
              </DialogTitle>
              {(item.unit || item.calories !== null) && (
                <DialogDescription className="min-w-0 whitespace-normal break-words text-sm text-stone-500 sm:text-[15px]">
                  {item.unit}
                  {item.calories !== null ? ` · ${item.calories} cal` : ""}
                </DialogDescription>
              )}
            </DialogHeader>

            {item.description ? (
              <p className="mt-4 whitespace-normal break-words text-sm leading-6 text-stone-600 sm:text-[15px] sm:leading-7">
                {item.description}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {item.unit ? (
                <span className="max-w-full rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 break-words">
                  {item.unit}
                </span>
              ) : null}
              {item.calories !== null ? (
                <span className="max-w-full rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 break-words">
                  {item.calories} calories
                </span>
              ) : null}
            </div>

            {item.notes ? (
              <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                  Notes
                </p>
                <p className="mt-2 whitespace-normal break-words text-sm leading-6 text-stone-600">
                  {item.notes}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}