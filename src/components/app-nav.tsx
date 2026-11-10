"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUser, Layers, Plus, Shirt, Sun, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const LEFT: NavItem[] = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/closet", label: "Closet", icon: Shirt },
];
const RIGHT: NavItem[] = [
  { href: "/looks", label: "Looks", icon: Layers },
  { href: "/me", label: "Me", icon: CircleUser },
];
const ADD: NavItem = { href: "/add", label: "Add", icon: Plus };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Bottom tab bar on phones, left sidebar from the md breakpoint up. */
export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
          {LEFT.map((item) => (
            <TabLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
          <li className="flex justify-center">
            <Link
              href={ADD.href}
              aria-label="Add an item"
              aria-current={isActive(pathname, ADD.href) ? "page" : undefined}
              className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm transition-transform active:scale-95"
            >
              <Plus className="size-6" strokeWidth={2} />
            </Link>
          </li>
          {RIGHT.map((item) => (
            <TabLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </ul>
      </nav>

      <nav
        aria-label="Main"
        className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col gap-8 border-r bg-background px-5 py-8 md:flex"
      >
        <Link href="/" className="px-3 font-display text-lg whitespace-nowrap">
          Fashion Companion
        </Link>
        <Link
          href={ADD.href}
          className="flex h-11 items-center justify-center gap-2 rounded-full bg-accent text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
        >
          <Plus className="size-4" /> Add to closet
        </Link>
        <ul className="flex flex-col gap-1">
          {[...LEFT, ...RIGHT].map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.75} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li className="flex justify-center">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
        {item.label}
      </Link>
    </li>
  );
}
