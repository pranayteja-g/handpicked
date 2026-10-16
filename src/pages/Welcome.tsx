import { t } from "../i18n";
import { configured } from "../data/client";

export function Welcome() {
  return (
    <section className="hero stack">
      <h1 className="display">{t("home.tagline")}</h1>
      <p className="lead">{t("home.sub")}</p>
      {!configured && <p className="error">{t("home.notConfigured")}</p>}
      <div className="stack">
        <a className="btn primary" href="#/signup">
          {t("home.create")}
        </a>
        <a className="btn" href="#/login">
          {t("home.signin")}
        </a>
      </div>
    </section>
  );
}
