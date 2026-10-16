import { useEffect, useState } from "react";

// Hash routing: works on GitHub Pages with no server rewrites.
const read = () => (location.hash.replace(/^#/, "") || "/").split("?")[0];

export function useRoute(): string {
  const [route, setRoute] = useState(read());
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function go(path: string) {
  location.hash = path;
}
