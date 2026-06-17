// ============================================================
// WM 2026 Tippspiel – App-Logik
// Reines React (UMD) + Babel-Standalone, kein Build-Schritt.
// ============================================================

const { useState, useEffect, useMemo, useCallback, useRef } = React;

// ---------- Supabase Client ----------
const cfg = window.SUPABASE_CONFIG || {};
const isConfigured = cfg.url && !cfg.url.includes("DEIN-PROJEKT") && cfg.anonKey && !cfg.anonKey.includes("DEIN-ANON-KEY");
const supabase = isConfigured ? window.supabase.createClient(cfg.url, cfg.anonKey) : null;

const LS_KEY = "wm2026_session";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 Minuten

const ROUND_LABELS = {
  group: "Vorrunde",
  ro32: "Sechzehntelfinale",
  ro16: "Achtelfinale",
  quarter: "Viertelfinale",
  semi: "Halbfinale",
  third: "Spiel um Platz 3",
  final: "Finale",
};
const ROUND_ORDER = ["group", "ro32", "ro16", "quarter", "semi", "third", "final"];

// ---------- Hilfsfunktionen ----------
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
function dayKey(iso) {
  return new Date(iso).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}
function isLocked(match, now) {
  return new Date(match.kickoff).getTime() <= now;
}
function pointsFor(pred, match) {
  if (!pred || match.score_home === null || match.score_home === undefined) return null;
  if (pred.pred_home === match.score_home && pred.pred_away === match.score_away) return 3;
  const predDiff = Math.sign(pred.pred_home - pred.pred_away);
  const realDiff = Math.sign(match.score_home - match.score_away);
  if (predDiff === realDiff) return 1;
  return 0;
}

// ============================================================
// Auth Gate – Name + PIN
// ============================================================
function AuthGate({ onLogin }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !pin.trim()) {
      setError("Bitte Name und PIN eingeben.");
      return;
    }
    if (pin.trim().length < 4) {
      setError("Die PIN muss mindestens 4 Zeichen lang sein.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("login_or_register", {
        p_name: name.trim(),
        p_pin: pin.trim(),
      });
      if (error) {
        if (error.message && error.message.includes("INVALID_PIN")) {
          setError("Dieser Name ist bereits vergeben und die PIN stimmt nicht. Bitte andere PIN oder anderen Namen verwenden.");
        } else {
          setError("Anmeldung fehlgeschlagen: " + error.message);
        }
        setBusy(false);
        return;
      }
      const session = { id: data, name: name.trim(), pin: pin.trim() };
      localStorage.setItem(LS_KEY, JSON.stringify(session));
      onLogin(session);
    } catch (err) {
      setError("Unerwarteter Fehler: " + err.message);
    }
    setBusy(false);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 className="auth-title">WM <span style={{color: "var(--gold)"}}>2026</span></h1>
        <p className="auth-sub">Tippspiel zur Fußball-Weltmeisterschaft</p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label className="field-label">Dein Name</label>
          <input
            className="field-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Max"
            autoComplete="name"
            maxLength={40}
          />
          <label className="field-label">PIN (mind. 4 Zeichen)</label>
          <input
            className="field-input"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            autoComplete="current-password"
            maxLength={20}
          />
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? "Einen Moment …" : "Loslegen"}
          </button>
        </form>
        <p className="auth-hint">
          Neu hier? Einfach Namen und eine selbst gewählte PIN eingeben – dein Konto wird automatisch
          angelegt. Schon dabei? Gib denselben Namen und dieselbe PIN erneut ein.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Tipp-Eingabefeld innerhalb einer Spielkarte
// ============================================================
function TipInput({ match, myPrediction, session, locked, onSaved }) {
  const [home, setHome] = useState(myPrediction ? String(myPrediction.pred_home) : "");
  const [away, setAway] = useState(myPrediction ? String(myPrediction.pred_away) : "");
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const debounceRef = useRef(null);

  useEffect(() => {
    setHome(myPrediction ? String(myPrediction.pred_home) : "");
    setAway(myPrediction ? String(myPrediction.pred_away) : "");
  }, [myPrediction]);

  const save = useCallback((h, a) => {
    if (h === "" || a === "") return;
    const hNum = parseInt(h, 10);
    const aNum = parseInt(a, 10);
    if (isNaN(hNum) || isNaN(aNum) || hNum < 0 || aNum < 0) return;

    setStatus("saving");
    supabase
      .rpc("submit_prediction", {
        p_name: session.name,
        p_pin: session.pin,
        p_match_id: match.id,
        p_pred_home: hNum,
        p_pred_away: aNum,
      })
      .then(({ error }) => {
        if (error) {
          setStatus("error");
        } else {
          setStatus("saved");
          onSaved(match.id, hNum, aNum);
        }
      });
  }, [match.id, session, onSaved]);

  function handleChange(which, val) {
    const cleaned = val.replace(/[^0-9]/g, "").slice(0, 2);
    if (which === "home") setHome(cleaned); else setAway(cleaned);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const newHome = which === "home" ? cleaned : home;
    const newAway = which === "away" ? cleaned : away;
    debounceRef.current = setTimeout(() => save(newHome, newAway), 600);
  }

  if (locked) {
    return <span className="lock-badge">Gesperrt</span>;
  }

  return (
    <div className="tip-box" onClick={(e) => e.stopPropagation()}>
      <input
        className="tip-input"
        type="number"
        min="0"
        inputMode="numeric"
        value={home}
        onChange={(e) => handleChange("home", e.target.value)}
        onClick={(e) => e.stopPropagation()}
      />
      <span className="tip-colon">:</span>
      <input
        className="tip-input"
        type="number"
        min="0"
        inputMode="numeric"
        value={away}
        onChange={(e) => handleChange("away", e.target.value)}
        onClick={(e) => e.stopPropagation()}
      />
      {status === "saving" && <span className="tip-status empty">speichert…</span>}
      {status === "saved" && <span className="tip-status saved">gespeichert</span>}
      {status === "error" && <span className="tip-status locked">Fehler</span>}
    </div>
  );
}

// ============================================================
// Eine Spielkarte
// ============================================================
function MatchCard({ match, myPrediction, session, now, onSaved, onOpenDetails }) {
  const locked = isLocked(match, now);
  const hasScore = match.score_home !== null && match.score_home !== undefined;
  const pts = hasScore ? pointsFor(myPrediction, match) : null;

  return (
    <div
      className={"match-card" + (match.is_germany_match ? " is-de" : "") + (locked ? " locked" : "")}
      onClick={() => onOpenDetails(match)}
    >
      <div className="teams">
        <div className="team">
          {match.flag_home ? (
            <img className="flag" src={match.flag_home} alt="" />
          ) : (
            <span className="flag-placeholder" />
          )}
          <span>{match.team_home}</span>
        </div>
        <span className="vs">–</span>
        <div className="team">
          {match.flag_away ? (
            <img className="flag" src={match.flag_away} alt="" />
          ) : (
            <span className="flag-placeholder" />
          )}
          <span>{match.team_away}</span>
        </div>
      </div>

      <div className="meta-col">
        {hasScore ? (
          <div className="score-display">{match.score_home}:{match.score_away}</div>
        ) : (
          <React.Fragment>
            <div className="meta-date">{formatDate(match.kickoff)}</div>
            <div className="meta-time">{formatTime(match.kickoff)}</div>
          </React.Fragment>
        )}
      </div>

      <div className="tip-col">
        {pts !== null && <span className="points-badge">+{pts} Pkt.</span>}
        <TipInput
          match={match}
          myPrediction={myPrediction}
          session={session}
          locked={locked}
          onSaved={onSaved}
        />
      </div>
    </div>
  );
}

// ============================================================
// Modal: Tipps aller Teilnehmenden für ein Spiel
// ============================================================
function PredictionsModal({ match, onClose }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("predictions_public")
      .select("player_name, pred_home, pred_away, updated_at")
      .eq("match_id", match.id)
      .order("player_name", { ascending: true })
      .then(({ data, error }) => {
        if (active) setRows(error ? [] : data);
      });
    return () => { active = false; };
  }, [match.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{match.team_home} – {match.team_away}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-sub">
          {formatDate(match.kickoff)} · {formatTime(match.kickoff)} Uhr
          {match.location ? " · " + match.location : ""}
        </div>

        {rows === null && <div className="empty-note">Lade Tipps …</div>}
        {rows && rows.length === 0 && (
          <div className="empty-note">Noch niemand hat für dieses Spiel getippt.</div>
        )}
        {rows && rows.length > 0 && rows.map((r, i) => (
          <div className="tip-row" key={i}>
            <span className="pname">{r.player_name}</span>
            <span className="pscore">{r.pred_home}:{r.pred_away}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Tab: Spiele & Tipps
// ============================================================
function MatchesTab({ matches, myPredictions, session, onSaved }) {
  const [activeRound, setActiveRound] = useState("group");
  const [now, setNow] = useState(Date.now());
  const [detailsMatch, setDetailsMatch] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const availableRounds = useMemo(() => {
    const present = new Set(matches.map((m) => m.round));
    return ROUND_ORDER.filter((r) => present.has(r));
  }, [matches]);

  const filteredMatches = useMemo(() => {
    let list = matches.filter((m) => m.round === activeRound);
    if (activeRound === "group") {
      list = list.filter((m) => m.is_germany_match);
    }
    return list.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  }, [matches, activeRound]);

  const grouped = useMemo(() => {
    const map = new Map();
    filteredMatches.forEach((m) => {
      const key = dayKey(m.kickoff);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    });
    return Array.from(map.entries());
  }, [filteredMatches]);

  return (
    <div>
      <div className="round-nav">
        {availableRounds.map((r) => (
          <button
            key={r}
            className={"round-chip" + (activeRound === r ? " active" : "")}
            onClick={() => setActiveRound(r)}
          >
            {ROUND_LABELS[r]}
          </button>
        ))}
      </div>

      {activeRound === "group" && (
        <p className="de-only-note">
          In der Vorrunde werden ausschließlich die Spiele der deutschen Nationalmannschaft abgefragt.
          Ab dem Sechzehntelfinale kannst du alle Partien tippen.
        </p>
      )}

      <div className="match-list">
        {grouped.length === 0 && (
          <div className="empty-note">Für diese Runde stehen noch keine Spiele bereit.</div>
        )}
        {grouped.map(([day, dayMatches]) => (
          <React.Fragment key={day}>
            <div className="day-divider">{day}</div>
            {dayMatches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                myPrediction={myPredictions[m.id]}
                session={session}
                now={now}
                onSaved={onSaved}
                onOpenDetails={setDetailsMatch}
              />
            ))}
          </React.Fragment>
        ))}
      </div>

      {detailsMatch && (
        <PredictionsModal match={detailsMatch} onClose={() => setDetailsMatch(null)} />
      )}
    </div>
  );
}

// ============================================================
// Tab: Rangliste
// ============================================================
function LeaderboardTab({ session }) {
  const [rows, setRows] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const load = useCallback(() => {
    supabase
      .from("leaderboard")
      .select("player_id, player_name, tips_count, points")
      .then(({ data, error }) => {
        if (!error) {
          setRows(data);
          setLastUpdate(new Date());
        }
      });
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="leaderboard-wrap">
      <div className="lb-header">
        <div className="lb-title">Rangliste</div>
        <div className="lb-refresh-note">
          {lastUpdate ? "Aktualisiert " + lastUpdate.toLocaleTimeString("de-DE") : ""} · Auto-Refresh alle 5 Min.
        </div>
      </div>
      <table className="lb-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th className="num">Tipps</th>
            <th className="num">Punkte</th>
          </tr>
        </thead>
        <tbody>
          {rows === null && (
            <tr><td colSpan="4" className="empty-note">Lade Rangliste …</td></tr>
          )}
          {rows && rows.map((r, i) => {
            const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
            const isMe = session && r.player_name === session.name;
            return (
              <tr key={r.player_id} className={isMe ? "me" : ""}>
                <td className={"rank-cell " + rankClass}>{i + 1}</td>
                <td>{r.player_name}</td>
                <td className="num">{r.tips_count}</td>
                <td className="num points-cell">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{padding: "14px 22px 18px", margin: 0, fontSize: "12px", color: "var(--steel)"}}>
        Punkteregel: 3 Punkte für das exakt richtige Ergebnis, 1 Punkt für den richtig getippten Sieger
        (bzw. ein richtig getipptes Unentschieden).
      </p>
    </div>
  );
}

// ============================================================
// Hauptkomponente
// ============================================================
function App() {
  const [session, setSession] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [tab, setTab] = useState("matches");
  const [matches, setMatches] = useState([]);
  const [myPredictions, setMyPredictions] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      try { setSession(JSON.parse(raw)); } catch (e) { /* ignore */ }
    }
    setSessionChecked(true);
  }, []);

  const loadMatches = useCallback(() => {
    return supabase
      .from("matches")
      .select("*")
      .order("kickoff", { ascending: true })
      .then(({ data, error }) => {
        if (error) { setLoadError(error.message); return; }
        setMatches(data);
      });
  }, []);

  const loadMyPredictions = useCallback((playerId) => {
    return supabase
      .from("predictions")
      .select("match_id, pred_home, pred_away")
      .eq("player_id", playerId)
      .then(({ data, error }) => {
        if (error) return;
        const map = {};
        data.forEach((p) => { map[p.match_id] = p; });
        setMyPredictions(map);
      });
  }, []);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    setLoading(true);
    Promise.all([loadMatches(), loadMyPredictions(session.id)]).finally(() => setLoading(false));
  }, [session, loadMatches, loadMyPredictions]);

  function handleSaved(matchId, home, away) {
    setMyPredictions((prev) => ({
      ...prev,
      [matchId]: { match_id: matchId, pred_home: home, pred_away: away },
    }));
  }

  function handleLogout() {
    localStorage.removeItem(LS_KEY);
    setSession(null);
    setMyPredictions({});
  }

  if (!isConfigured) {
    return (
      <div className="config-warning">
        <h2>Konfiguration fehlt</h2>
        <p>
          Bitte trage deine Supabase-Zugangsdaten in der Datei <code>config.js</code> ein
          (<code>url</code> und <code>anonKey</code>). Beide findest du in deinem Supabase-Projekt
          unter <em>Project Settings → API</em>.
        </p>
      </div>
    );
  }

  if (!sessionChecked) {
    return <div className="loading-state">Lade …</div>;
  }

  if (!session) {
    return <AuthGate onLogin={setSession} />;
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">
          <span className="brand-mark">WM<span className="accent">2026</span></span>
          <span className="brand-sub">Tippspiel</span>
        </div>
        <div className="session-pill">
          <span className="who">{session.name}</span>
          <button onClick={handleLogout}>Abmelden</button>
        </div>
      </div>

      <div className="tabs">
        <button className={"tab-btn" + (tab === "matches" ? " active" : "")} onClick={() => setTab("matches")}>
          Spiele &amp; Tipps
        </button>
        <button className={"tab-btn" + (tab === "leaderboard" ? " active" : "")} onClick={() => setTab("leaderboard")}>
          Rangliste
        </button>
      </div>

      {loading && <div className="loading-state">Lade Spiele …</div>}
      {loadError && <div className="error-state">Fehler beim Laden: {loadError}</div>}

      {!loading && !loadError && tab === "matches" && (
        <MatchesTab
          matches={matches}
          myPredictions={myPredictions}
          session={session}
          onSaved={handleSaved}
        />
      )}
      {!loading && !loadError && tab === "leaderboard" && (
        <LeaderboardTab session={session} />
      )}

      <div className="app-footer">WM 2026 Tippspiel · Inoffizielles Fan-Projekt</div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
