"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, Logo } from "./ui";

const links = [
  { href: "/", label: "Home" },
  { href: "/movies", label: "Movies" },
  { href: "/series", label: "Series" },
  { href: "/games", label: "Games" },
  { href: "/anime", label: "Anime" },
  { href: "/fest/mcu", label: "Franchises" },
  { href: "/analysis", label: "Analysis" },
];

const tabs = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/movies", label: "Movies", icon: "film" },
  { href: "/series", label: "Series", icon: "tv" },
  { href: "/games", label: "Games", icon: "game" },
  { href: "/search", label: "Search", icon: "search" },
];

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <a href="/" aria-label="CTGMovies home">
          <Logo />
        </a>
        <nav className="nav" aria-label="Primary">
          {links.map((link) => (
            <a key={link.href} href={link.href} data-active={isActive(link.href)}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <a className="search-trigger" href="/search">
            <Icon name="search" size={13} />
            Search titles
            <kbd>/</kbd>
          </a>
          <a className="btn btn-primary btn-sm" href="/movies">
            Browse
          </a>
          <button
            className="icon-btn mobile-menu-btn"
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Icon name="menu" size={18} />
          </button>
        </div>
      </div>

      {open ? (
        <div className="mobile-sheet" role="dialog" aria-modal="true">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Logo />
            <button
              className="icon-btn"
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <nav>
            {[...links, { href: "/search", label: "Search" }].map((link, index) => (
              <a key={link.href} href={link.href}>
                {link.label}
                <span>{String(index + 1).padStart(2, "0")}</span>
              </a>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export function TabBar() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="tabbar" aria-label="Mobile">
      {tabs.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <a key={tab.href} href={tab.href} data-active={active}>
            <Icon name={tab.icon} size={17} />
            {tab.label}
          </a>
        );
      })}
    </nav>
  );
}
