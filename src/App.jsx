import React from "react";

const SESSION_STORAGE_KEY = "sc22.session.v1";
const API_BASE =
  window.location.hostname === "localhost" && window.location.port !== "3003"
    ? "http://localhost:3003"
    : "";

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildUserFromEmail(email) {
  const local = String(email).split("@")[0] || "User";
  const name = local
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const seed = encodeURIComponent(email.toLowerCase());
  const avatarUrl = `https://api.dicebear.com/8.x/identicon/svg?seed=${seed}`;
  return { email, name: name || "User", avatarUrl };
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

async function readErrorMessage(res) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = await res.json().catch(() => null);
    if (json && typeof json === "object" && typeof json.error === "string") return json.error;
  }
  const text = await res.text().catch(() => "");
  return text || "Request failed.";
}

function readSession() {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== "object") return null;
  if (!parsed.user || typeof parsed.user !== "object") return null;
  return parsed;
}

function writeSession(session) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function Card({ children }) {
  return <div className="card">{children}</div>;
}

function AppLogo({ className }) {
  const candidates = ["/logo.png", "/logo.jpg"];
  const [index, setIndex] = React.useState(0);
  const src = candidates[index];

  if (!src) {
    return <LogoMark className={className} />;
  }

  return (
    <img
      className={className}
      src={src}
      alt=""
      onError={() => setIndex((i) => i + 1)}
    />
  );
}

function LogoMark({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 900 420"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="SC22"
    >
      <defs>
        <linearGradient id="chrome" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.22" stopColor="#b7f3ff" stopOpacity="0.95" />
          <stop offset="0.46" stopColor="#ffc7f2" stopOpacity="0.95" />
          <stop offset="0.72" stopColor="#ffd79a" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="fillWarm" x1="0.12" x2="0.92" y1="0.08" y2="0.92">
          <stop offset="0" stopColor="#ffe889" />
          <stop offset="0.36" stopColor="#ff9c2f" />
          <stop offset="0.62" stopColor="#ff6618" />
          <stop offset="1" stopColor="#ff4fc7" />
        </linearGradient>
        <linearGradient id="strokeGlow" x1="0" x2="1" y1="0.2" y2="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="#c6f2ff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffd4a2" stopOpacity="0.92" />
        </linearGradient>
        <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="8" result="b" />
          <feColorMatrix
            in="b"
            type="matrix"
            values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 0.35 0"
            result="g"
          />
          <feMerge>
            <feMergeNode in="g" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="drop3d" x="-30%" y="-30%" width="160%" height="160%">
          <feOffset dx="0" dy="14" result="o" />
          <feGaussianBlur in="o" stdDeviation="12" result="ob" />
          <feColorMatrix
            in="ob"
            type="matrix"
            values="
              0 0 0 0 0.06
              0 0 0 0 0.03
              0 0 0 0 0.18
              0 0 0 0.42 0"
            result="os"
          />
          <feMerge>
            <feMergeNode in="os" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="cloudClip">
          <path d="M176 302c-62 0-112-44-112-99 0-50 41-92 95-99 16-55 70-96 135-96 66 0 121 41 136 97 13-4 27-6 41-6 71 0 129 50 129 112 0 1 0 2-.01 3h7c60 0 109 42 109 94 0 52-49 94-109 94H176z" />
        </clipPath>
      </defs>

      <g filter="url(#drop3d)">
        <path
          d="M176 302c-62 0-112-44-112-99 0-50 41-92 95-99 16-55 70-96 135-96 66 0 121 41 136 97 13-4 27-6 41-6 71 0 129 50 129 112 0 1 0 2-.01 3h7c60 0 109 42 109 94 0 52-49 94-109 94H176z"
          fill="rgba(255,255,255,0.18)"
          stroke="url(#chrome)"
          strokeWidth="18"
        />

        <g clipPath="url(#cloudClip)" filter="url(#softGlow)">
          <rect x="110" y="92" width="510" height="240" rx="90" fill="url(#fillWarm)" />
          <g opacity="0.9">
            {Array.from({ length: 10 }).map((_, i) => {
              const x = 150 + i * 36;
              const h = 170 - i * 6;
              return (
                <rect
                  key={i}
                  x={x}
                  y={260 - h}
                  width="20"
                  height={h}
                  rx="10"
                  fill="rgba(255,255,255,0.28)"
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth="2"
                />
              );
            })}
          </g>
          <path
            d="M144 122c210 0 378 40 460 112-62-30-170-48-316-48-150 0-254 22-317 60 36-76 92-124 173-124z"
            fill="rgba(255,255,255,0.30)"
          />
          <path
            d="M122 300h642"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </g>

        <g filter="url(#softGlow)">
          <path
            d="M706 112c74 0 134 52 134 116 0 32-15 62-40 84 25 22 40 52 40 84 0 64-60 116-134 116-73 0-133-51-134-114h94c4 20 20 34 40 34 23 0 42-19 42-42 0-22-19-41-42-41h-56v-74h56c23 0 42-19 42-41 0-23-19-42-42-42-20 0-36 14-40 34h-94c1-63 61-114 134-114z"
            fill="url(#fillWarm)"
            stroke="url(#strokeGlow)"
            strokeWidth="16"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </svg>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <div className="fieldLabel">{label}</div>
      {children}
    </label>
  );
}

function AuthScreen({ onLoggedIn }) {
  const [mode, setMode] = React.useState("login");
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      setError("Enter a valid email.");
      return;
    }

    if (mode === "register") {
      if (!name.trim()) {
        setError("Enter your name.");
        return;
      }
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
      const normalizedEmail = normalizeEmail(trimmedEmail);

      if (mode === "register") {
        const res = await fetch(`${API_BASE}/api/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            name: name.trim(),
            password,
          }),
        });
        if (res.status === 409) {
          setError("An account with this email already exists.");
          return;
        }
        if (!res.ok) {
          const msg = await readErrorMessage(res);
          setError(msg);
          return;
        }
        const payload = await res.json().catch(() => null);
        const base = buildUserFromEmail(normalizedEmail);
        const user = {
          ...base,
          name: name.trim(),
          walletAddress:
            payload && typeof payload.wallet_address === "string"
              ? payload.wallet_address
              : undefined,
        };
        const session = { user, createdAt: Date.now() };
        writeSession(session);
        onLoggedIn(session);
        return;
      }

      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });
      if (!res.ok) {
        const msg = await readErrorMessage(res);
        setError(msg);
        return;
      }

      const payload = await res.json().catch(() => null);
      const base = buildUserFromEmail(normalizedEmail);
      const user = {
        ...base,
        name:
          payload && typeof payload.name === "string" && payload.name.trim()
            ? payload.name.trim()
            : base.name,
        walletAddress:
          payload && typeof payload.wallet_address === "string"
            ? payload.wallet_address
            : undefined,
      };
      const session = { user, createdAt: Date.now() };
      writeSession(session);
      onLoggedIn(session);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="topBar">
        <div className="topLeftBrand">
          <AppLogo className="cornerLogo" />
        </div>
      </div>

      <div className="content">
        <Card>
          <div className="cardTitle">{mode === "login" ? "Log in" : "Register"}</div>
          <form className="form" onSubmit={onSubmit}>
            {mode === "register" ? (
              <Field label="Name">
                <input
                  autoComplete="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            ) : null}
            <Field label="Email">
              <input
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <input
                autoComplete="current-password"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {mode === "register" ? (
              <Field label="Confirm password">
                <input
                  autoComplete="off"
                  placeholder="••••••••"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </Field>
            ) : null}
            {error ? <div className="error">{error}</div> : null}
            <button className="primaryButton" disabled={isSubmitting}>
              {isSubmitting
                ? mode === "login"
                  ? "Logging in…"
                  : "Creating account…"
                : mode === "login"
                  ? "Log in"
                  : "Create account"}
            </button>
            <div className="switchRow">
              {mode === "login" ? (
                <>
                  <span className="mutedText">New user?</span>
                  <button
                    className="linkButton"
                    type="button"
                    onClick={() => {
                      setError("");
                      setMode("register");
                    }}
                  >
                    Register
                  </button>
                </>
              ) : (
                <>
                  <span className="mutedText">Already have an account?</span>
                  <button
                    className="linkButton"
                    type="button"
                    onClick={() => {
                      setError("");
                      setMode("login");
                    }}
                  >
                    Log in
                  </button>
                </>
              )}
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

function AccountBottomPanel({ user, onLogout, onPlaySong }) {
  return (
    <div className="bottomPanel bottomPanelHome">
      <div className="bottomGrid">
        <div className="bottomSection">
          <div className="sectionTitle">Account</div>
          <div className="accountRow">
            <img className="avatar" src={user.avatarUrl} alt="" />
            <div className="accountMeta">
              <div className="accountName">{user.name}</div>
              <div className="accountEmail">{user.email}</div>
            </div>
            <button className="secondaryButton" onClick={onLogout}>
              Log out
            </button>
          </div>
        </div>

        <div className="bottomSection">
          <div className="sectionTitleRow">
            <div className="sectionTitle">My songs</div>
            <button
              className="glassIconButton"
              data-role="add-song"
              onClick={() => window.dispatchEvent(new CustomEvent("open-add-song"))}
            >
              +
            </button>
          </div>
          <SongArea email={user.email} onPlaySong={onPlaySong} />
        </div>
      </div>
    </div>
  );
}

function useSongs(email) {
  const [songs, setSongs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/songs?email=${encodeURIComponent(email)}`,
      );
      if (!res.ok) throw new Error("Failed to load");
      const list = await res.json();
      setSongs(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, [email]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    function onRefresh() {
      load();
    }
    window.addEventListener("refresh-songs", onRefresh);
    return () => window.removeEventListener("refresh-songs", onRefresh);
  }, [load]);

  return { songs, loading, reload: load };
}

function shuffleList(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function useFeed() {
  const [songs, setSongs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/feed`);
      if (!res.ok) throw new Error("Failed to load");
      const list = await res.json().catch(() => []);
      setSongs(
        shuffleList(
          Array.isArray(list)
            ? list.filter(
                (song) =>
                  song && typeof song === "object" && typeof song.id === "string",
              )
            : [],
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    function onRefresh() {
      load();
    }
    window.addEventListener("refresh-songs", onRefresh);
    return () => window.removeEventListener("refresh-songs", onRefresh);
  }, [load]);

  return { songs, loading, reload: load };
}

function useUserProfile(email) {
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!email) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/user?email=${encodeURIComponent(email)}`);
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        if (!cancelled) setProfile(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [email]);

  return { profile, loading };
}

function SongScroller({ email, onPlaySong, nowPlayingId }) {
  const { songs, loading } = useSongs(email);
  const [activeId, setActiveId] = React.useState(null);
  const wrapRef = React.useRef(null);
  const itemRefs = React.useRef(new Map());

  React.useEffect(() => {
    if (!songs.length) {
      setActiveId(null);
      return;
    }
    setActiveId((prev) => (songs.some((s) => s.id === prev) ? prev : songs[0].id));
  }, [songs]);

  const scrollToId = React.useCallback((id, behavior) => {
    const wrap = wrapRef.current;
    const el = itemRefs.current.get(id);
    if (!wrap || !el) return;
    const top = el.offsetTop - wrap.clientHeight / 2 + el.offsetHeight / 2;
    wrap.scrollTo({ top, behavior: behavior || "smooth" });
  }, []);

  const requestPlay = React.useCallback(
    (song) => {
      if (!song) return;
      const isActive = song.id === activeId;
      const toggle = song.id === nowPlayingId;
      if (!isActive) {
        setActiveId(song.id);
        scrollToId(song.id, "smooth");
      }
      onPlaySong(song, { toggle });
    },
    [activeId, nowPlayingId, onPlaySong, scrollToId],
  );

  React.useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    let raf = 0;
    const measure = () => {
      raf = 0;
      const centerY = wrap.scrollTop + wrap.clientHeight / 2;
      let bestId = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const s of songs) {
        const el = itemRefs.current.get(s.id);
        if (!el) continue;
        const y = el.offsetTop + el.offsetHeight / 2;
        const d = Math.abs(y - centerY);
        if (d < bestDist) {
          bestDist = d;
          bestId = s.id;
        }
      }
      if (bestId) setActiveId(bestId);
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(measure);
    };

    wrap.addEventListener("scroll", onScroll, { passive: true });
    measure();
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      wrap.removeEventListener("scroll", onScroll);
    };
  }, [songs]);

  if (loading) {
    return <div className="heroPlayerCard">Loading songs…</div>;
  }

  if (!songs.length) {
    return (
      <div className="heroPlayerCard">
        <div className="heroPlayerEmpty">Add your first song with the + button below.</div>
      </div>
    );
  }

  return (
    <div className="heroPlayerCard heroPlayerCardScroller">
      <div className="songScroll" ref={wrapRef}>
        <div className="songScrollPad" />
        {songs.map((s) => {
          const isActive = s.id === activeId;
          return (
            <div
              key={s.id}
              className={`songScrollItem ${isActive ? "songScrollItemActive" : ""}`}
              ref={(el) => {
                if (!el) itemRefs.current.delete(s.id);
                else itemRefs.current.set(s.id, el);
              }}
            >
              <button
                type="button"
                className="songScrollArtworkButton"
                onClick={() => requestPlay(s)}
                aria-label="Play/Pause"
              >
                <div className="songScrollArtwork">
                  {s.artworkFileId ? (
                    <img src={`${API_BASE}/api/artwork/${s.artworkFileId}`} alt="" />
                  ) : (
                    <div className="songScrollArtworkPlaceholder">No artwork</div>
                  )}
                </div>
              </button>
              <div className="songScrollBody">
                <div className="songScrollTitle">{s.title}</div>
                {s.description ? <div className="songScrollDesc">{s.description}</div> : null}
                <div className="mutedText">Tap artwork to {s.id === nowPlayingId ? "pause" : "play"}.</div>
              </div>
            </div>
          );
        })}
        <div className="songScrollPad" />
      </div>
    </div>
  );
}

function AppTopBar({ onGoHome, onGoForYou, activeScreen }) {
  return (
    <div className="topBar topBarHome">
      <div className="topBarHomeInner">
        <div className="topLeftBrand">
          <AppLogo className="cornerLogo cornerLogoHome" />
        </div>
        <div className="topNavTabs">
          <button
            type="button"
            className={`topNavTab ${activeScreen === "home" ? "topNavTabActive" : ""}`}
            onClick={onGoHome}
          >
            Home
          </button>
          <button
            type="button"
            className={`topNavTab ${activeScreen === "for-you" ? "topNavTabActive" : ""}`}
            onClick={onGoForYou}
          >
            For you
          </button>
        </div>
      </div>
    </div>
  );
}

function HomeScreen({
  session,
  onLogout,
  nowPlaying,
  onPlaySong,
  onGoForYou,
}) {
  const nowPlayingId = nowPlaying?.id || null;

  return (
    <div className="homeViewport">
      <div className="page pageHome">
        <AppTopBar
          onGoHome={() => {}}
          onGoForYou={onGoForYou}
          activeScreen="home"
        />

        <div className="content contentHome">
          <div className="hero heroHome">
            <div className="heroEyebrow">Main window</div>
            <div className="heroTitle">Welcome back, {session.user.name}.</div>
            <div className="heroSubtitle">Your music space is ready.</div>
            <SongScroller
              email={session.user.email}
              onPlaySong={onPlaySong}
              nowPlayingId={nowPlayingId}
            />
          </div>
        </div>

        <AccountBottomPanel
          user={session.user}
          onLogout={onLogout}
          onPlaySong={onPlaySong}
        />
        <AddSongModal email={session.user.email} />
      </div>
    </div>
  );
}

function ForYouScreen({
  session,
  nowPlaying,
  onPlaySong,
  onGoHome,
  onOpenProfile,
}) {
  const { songs, loading } = useFeed();

  return (
    <div className="homeViewport">
      <div className="page pageHome pageFeed">
        <AppTopBar
          onGoHome={onGoHome}
          onGoForYou={() => {}}
          activeScreen="for-you"
        />
        <div className="forYouPages">
          {loading ? <div className="feedEmpty">Loading songs…</div> : null}
          {!loading && !songs.length ? (
            <div className="feedEmpty">No songs from platform users are available yet.</div>
          ) : null}
          {!loading
            ? songs.map((song) => (
                <div key={song.id} className="forYouPage">
                  <button
                    type="button"
                    className="forYouArtworkButton"
                    onClick={() => onPlaySong(song, { toggle: song.id === nowPlaying?.id })}
                  >
                    {song.artworkFileId ? (
                      <img
                        className="forYouArtwork"
                        src={`${API_BASE}/api/artwork/${song.artworkFileId}`}
                        alt=""
                      />
                    ) : (
                      <div className="forYouArtworkPlaceholder">No artwork</div>
                    )}
                  </button>
                  <div className="forYouOverlay">
                    <div className="forYouSongTitle">{song.title}</div>
                    {song.description ? <div className="forYouSongDesc">{song.description}</div> : null}
                  </div>
                  <button
                    type="button"
                    className="authorBubble"
                    onClick={() => onOpenProfile(song.ownerEmail)}
                  >
                    @{song.ownerName || song.ownerEmail}
                  </button>
                </div>
              ))
            : null}
        </div>
        <AddSongModal email={session.user.email} />
      </div>
    </div>
  );
}

function ProfileScreen({
  email,
  onBack,
  nowPlaying,
  onPlaySong,
}) {
  const { profile, loading } = useUserProfile(email);
  const user = React.useMemo(() => {
    if (!profile || typeof profile !== "object") return null;
    return {
      email: profile.email,
      name: profile.name || buildUserFromEmail(profile.email).name,
      avatarUrl: buildUserFromEmail(profile.email).avatarUrl,
    };
  }, [profile]);

  return (
    <div className="homeViewport">
      <div className="page pageHome pageProfile">
        <div className="topBar topBarHome">
          <div className="topBarHomeInner">
            <button type="button" className="topNavTab topNavTabActive" onClick={onBack}>
              Back
            </button>
          </div>
        </div>
        <div className="content contentHome">
          {loading ? (
            <div className="feedEmpty">Loading profile…</div>
          ) : user ? (
            <div className="profileCard">
              <div className="profileHeader">
                <img className="profileAvatar" src={user.avatarUrl} alt="" />
                <div>
                  <div className="profileName">{user.name}</div>
                  <div className="profileEmailText">{user.email}</div>
                </div>
              </div>
              <div className="sectionTitle">Songs</div>
              <div className="profileSongList">
                {(profile.songs || []).map((song) => (
                  <button
                    key={song.id}
                    type="button"
                    className="profileSongItem"
                    onClick={() => onPlaySong(song, { toggle: song.id === nowPlaying?.id })}
                  >
                    {song.artworkFileId ? (
                      <img
                        className="profileSongArtwork"
                        src={`${API_BASE}/api/artwork/${song.artworkFileId}`}
                        alt=""
                      />
                    ) : (
                      <div className="profileSongArtwork profileSongArtworkPlaceholder" />
                    )}
                    <div className="profileSongText">
                      <div className="profileSongTitle">{song.title}</div>
                      {song.description ? <div className="profileSongDesc">{song.description}</div> : null}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="feedEmpty">Profile not found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function NowPlayingDock({ song, onPlaySong, onClear, audioRef }) {
  if (!song) return null;
  return (
    <div className="nowPlayingDock">
      <button type="button" className="nowPlayingArtworkButton" onClick={() => onPlaySong(song, { toggle: true })}>
        {song.artworkFileId ? (
          <img className="nowPlayingArtwork" src={`${API_BASE}/api/artwork/${song.artworkFileId}`} alt="" />
        ) : (
          <div className="nowPlayingArtworkPlaceholder" />
        )}
      </button>
      <div className="nowPlayingMeta">
        <div className="nowPlayingTitle">{song.title}</div>
        <audio
          ref={audioRef}
          className="nowPlayingAudio"
          controls
          preload="metadata"
          src={`${API_BASE}/api/audio/${song.audioFileId}`}
        />
      </div>
      <button type="button" className="nowPlayingClose" onClick={onClear} aria-label="Close">
        ×
      </button>
    </div>
  );
}

function AddSongModal({ email }) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [artwork, setArtwork] = React.useState(null);
  const [audio, setAudio] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    function onOpen() {
      setOpen(true);
      setError("");
      setTitle("");
      setDescription("");
      setArtwork(null);
      setAudio(null);
    }
    window.addEventListener("open-add-song", onOpen);
    return () => window.removeEventListener("open-add-song", onOpen);
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Enter a title.");
      return;
    }
    if (!audio) {
      setError("Select a WAV/MP3 file.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("email", email);
      fd.set("title", title.trim());
      fd.set("description", description.trim());
      if (artwork) fd.set("artwork", artwork);
      fd.set("audio", audio);
      const res = await fetch(`${API_BASE}/api/songs`, { method: "POST", body: fd });
      if (!res.ok) {
        const msg = await readErrorMessage(res);
        setError(msg || "Upload failed.");
        return;
      }
      setOpen(false);
      window.dispatchEvent(new CustomEvent("refresh-songs"));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="modalBackdrop" onClick={() => setOpen(false)}>
      <div className="modalCard" onClick={(e) => e.stopPropagation()}>
        <div className="modalTitle">Add song</div>
        <form className="form" onSubmit={onSubmit}>
          <Field label="Title">
            <input placeholder="Song title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Description">
            <textarea placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Artwork">
            <input type="file" accept="image/*" onChange={(e) => setArtwork(e.target.files?.[0] || null)} />
          </Field>
          <Field label="Audio (wav/mp3)">
            <input type="file" accept="audio/wav,audio/mpeg" onChange={(e) => setAudio(e.target.files?.[0] || null)} />
          </Field>
          {error ? <div className="error">{error}</div> : null}
          <div className="modalActions">
            <button type="button" className="secondaryButton" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="primaryButton" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SongArea({ email, onPlaySong }) {
  const { songs, loading } = useSongs(email);

  if (loading) return <div className="emptyState">Loading…</div>;
  if (!songs.length) return <div className="emptyState">No songs yet.</div>;

  return (
    <div className="songMiniList">
      {songs.map((s) => (
        <button
          key={s.id}
          type="button"
          className="songMiniItem"
          onClick={() => onPlaySong(s, { toggle: true })}
        >
          <div className="songMiniThumb" aria-hidden="true">
            {s.artworkFileId ? (
              <img src={`${API_BASE}/api/artwork/${s.artworkFileId}`} alt="" />
            ) : (
              <div className="songMiniThumbPlaceholder" />
            )}
          </div>
          <div className="songMiniTitle">{s.title}</div>
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const [session, setSession] = React.useState(() => readSession());
  const [screen, setScreen] = React.useState("home");
  const [profileEmail, setProfileEmail] = React.useState("");
  const [nowPlaying, setNowPlaying] = React.useState(null);
  const audioRef = React.useRef(null);

  const onPlaySong = React.useCallback(
    (song, options) => {
      if (!song || typeof song !== "object" || !song.audioFileId) return;
      const audio = audioRef.current;
      const same = nowPlaying && song.id === nowPlaying.id;
      if (same && options && options.toggle && audio) {
        if (audio.paused) void audio.play();
        else audio.pause();
        return;
      }
      setNowPlaying(song);
    },
    [nowPlaying],
  );

  const onClearNowPlaying = React.useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) audio.pause();
    setNowPlaying(null);
  }, []);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !nowPlaying?.audioFileId) return;
    void audio.play();
  }, [nowPlaying?.audioFileId]);

  function onLogout() {
    clearSession();
    setSession(null);
  }

  if (!session) return <AuthScreen onLoggedIn={setSession} />;
  if (screen === "for-you") {
    return (
      <div className="appShellPersistentPlayer">
        <ForYouScreen
          session={session}
          nowPlaying={nowPlaying}
          onPlaySong={onPlaySong}
          onGoHome={() => setScreen("home")}
          onOpenProfile={(email) => {
            setProfileEmail(email);
            setScreen("profile");
          }}
        />
        <div className="globalNowPlayingShell">
          <NowPlayingDock
            song={nowPlaying}
            onPlaySong={onPlaySong}
            onClear={onClearNowPlaying}
            audioRef={audioRef}
          />
        </div>
      </div>
    );
  }
  if (screen === "profile") {
    return (
      <div className="appShellPersistentPlayer">
        <ProfileScreen
          email={profileEmail}
          onBack={() => setScreen("for-you")}
          nowPlaying={nowPlaying}
          onPlaySong={onPlaySong}
        />
        <div className="globalNowPlayingShell">
          <NowPlayingDock
            song={nowPlaying}
            onPlaySong={onPlaySong}
            onClear={onClearNowPlaying}
            audioRef={audioRef}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="appShellPersistentPlayer">
      <HomeScreen
        session={session}
        onLogout={onLogout}
        nowPlaying={nowPlaying}
        onPlaySong={onPlaySong}
        onGoForYou={() => setScreen("for-you")}
      />
      <div className="globalNowPlayingShell">
        <NowPlayingDock
          song={nowPlaying}
          onPlaySong={onPlaySong}
          onClear={onClearNowPlaying}
          audioRef={audioRef}
        />
      </div>
    </div>
  );
}
