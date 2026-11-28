"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('zs-theme');var d=t?t==='dark':true;document.documentElement.classList.toggle('dark',d);document.querySelector('meta[name=theme-color]')?.setAttribute('content',d?'#070b0d':'#f4f6f5')}catch(e){document.documentElement.classList.add('dark')}})()`;

export function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.querySelector("meta[name=theme-color]")?.setAttribute("content", next ? "#070b0d" : "#f4f6f5");
    try {
      localStorage.setItem("zs-theme", next ? "dark" : "light");
    } catch {
      /* modo privado */
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={dark ? "Tema claro" : "Tema escuro"}
      className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-fg transition active:scale-90"
    >
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
