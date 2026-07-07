/* eslint-disable @next/next/no-img-element */

/**
 * Public menu sticky top navbar.
 * Shows the restaurant logo, name, and menu title.
 * Pure server component — no interactivity needed.
 */
export function MenuNavbar({
  orgName,
  orgLogoUrl,
  menuName,
}: {
  orgName: string;
  orgLogoUrl: string | null;
  menuName: string;
}) {
  const initials = orgName.trim().slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-stone-800 bg-stone-950 shadow-lg">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
        {/* Brand logo / initials */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-amber-400 text-stone-950 shadow-sm">
          {orgLogoUrl ? (
            <img
              src={orgLogoUrl}
              alt={orgName}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-sm font-extrabold">{initials}</span>
          )}
        </div>

        {/* Name + menu label */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold leading-tight text-white">
            {orgName}
          </p>
          <p className="truncate text-xs text-stone-400">{menuName}</p>
        </div>

        {/* Menu badge */}
        <span className="shrink-0 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-stone-950">
          Menu
        </span>
      </div>
    </header>
  );
}
