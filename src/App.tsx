import { useCallback, useEffect, useState, type ReactNode } from "react";
import { t } from "./i18n";
import { go, useRoute } from "./router";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { ToastProvider } from "./ui/toast";
import { Spinner } from "./ui/common";
import { readPendingKey } from "./data/key";
import { unreadCount } from "./data/recs";
import { Welcome } from "./pages/Welcome";
import { SignUp } from "./pages/SignUp";
import { Login } from "./pages/Login";
import { Join } from "./pages/Join";
import { Friends } from "./pages/Friends";
import { Settings } from "./pages/Settings";
import { Spike } from "./pages/Spike";
import { RecList } from "./pages/RecList";
import { Compose } from "./pages/Compose";
import { RecDetail } from "./pages/RecDetail";

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </AuthProvider>
  );
}

/** Unread badge: refresh on route change, focus, a custom event, and every 60 s (polling works where WebSockets don't). */
function useUnread(enabled: boolean, route: string): number {
  const [n, setN] = useState(0);
  const refresh = useCallback(() => {
    if (!enabled) return;
    unreadCount()
      .then(setN)
      .catch(() => {});
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh, route]);

  useEffect(() => {
    if (!enabled) return;
    const onVis = () => document.visibilityState === "visible" && refresh();
    const id = window.setInterval(onVis, 60_000);
    window.addEventListener("hp:unread", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("hp:unread", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, refresh]);

  return enabled ? n : 0;
}

function Shell() {
  const route = useRoute();
  const { status, reloadProfile } = useAuth();
  const unread = useUnread(status === "in", route);

  // Signed in but never confirmed the secret key -> force back to the key screen.
  useEffect(() => {
    if (status === "in" && readPendingKey() && route !== "/signup") go("/signup");
  }, [status, route]);

  let page: ReactNode;
  if (route === "/spike") page = <Spike />;
  else if (route.startsWith("/join/")) page = <Join code={route.slice("/join/".length)} />;
  else if (status === "loading") page = <Spinner />;
  else if (status === "error") {
    page = (
      <section className="card stack">
        <p className="error">{t("err.profileLoad")}</p>
        <button className="btn primary" onClick={() => void reloadProfile()}>
          {t("common.retry")}
        </button>
      </section>
    );
  } else if (status === "out") {
    if (route === "/signup") page = <SignUp />;
    else if (route === "/login") page = <Login />;
    else page = <Welcome />;
  } else if (route === "/signup") {
    page = <SignUp />; // key-confirmation step
  } else if (route === "/sent") page = <RecList mode="sent" />;
  else if (route === "/new") page = <Compose />;
  else if (route.startsWith("/edit/")) page = <Compose editId={route.slice("/edit/".length)} />;
  else if (route.startsWith("/r/")) page = <RecDetail id={route.slice("/r/".length)} />;
  else if (route === "/friends") page = <Friends />;
  else if (route === "/settings") page = <Settings />;
  else page = <RecList mode="inbox" />;

  const signedIn = status === "in" && !(route === "/signup");

  const tab = (href: string, label: string, match: (r: string) => boolean, badge = 0) => (
    <a className="tab" href={href} aria-current={match(route) ? "page" : undefined}>
      {label}
      {badge > 0 && <span className="badge">{badge > 99 ? "99+" : badge}</span>}
    </a>
  );

  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="#/">
          {t("app.name")}
        </a>
      </header>
      <main className={`page${signedIn ? " has-tabs" : ""}`}>{page}</main>
      {signedIn && (
        <nav className="tabbar" aria-label="Main">
          <div className="tabbar-inner">
            {tab("#/", t("nav.inbox"), (r) => r === "/" || r.startsWith("/r/"), unread)}
            {tab("#/sent", t("nav.sent"), (r) => r === "/sent")}
            <a className="tab add" href="#/new" aria-current={route === "/new" ? "page" : undefined}>
              <span className="plus" aria-hidden="true">
                +
              </span>
              {t("nav.new")}
            </a>
            {tab("#/friends", t("nav.friends"), (r) => r === "/friends")}
            {tab("#/settings", t("nav.settings"), (r) => r === "/settings")}
          </div>
        </nav>
      )}
    </div>
  );
}
