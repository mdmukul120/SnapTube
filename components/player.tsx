"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Source = { url: string; type: "hls" | "mp4" | "webm"; quality: string; label: string; note?: string };

type Payload = {
  ok: boolean;
  mode: "cdn" | "map" | "demo";
  configured: boolean;
  sources: Source[];
};

const API_KEY = process.env.NEXT_PUBLIC_BFF_API_KEY || "ctg-live-public-key";

async function fetchPlayback(kind: string, slug: string): Promise<Payload> {
  const tokenRes = await fetch("/api/v1/auth/token", {
    method: "POST",
    headers: { "x-api-key": API_KEY },
    cache: "no-store",
  });
  const tokenJson = await tokenRes.json();
  const res = await fetch(`/api/v1/play/${kind}/${slug}`, {
    headers: { "x-api-key": API_KEY, authorization: `Bearer ${tokenJson.token}` },
    cache: "no-store",
  });
  return (await res.json()) as Payload;
}

function fmt(time: number): string {
  if (!Number.isFinite(time)) return "00:00";
  const total = Math.max(0, Math.floor(time));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function VideoPlayer({
  kind,
  slug,
  title,
  poster,
  autoOpen = false,
}: {
  kind: string;
  slug: string;
  title: string;
  poster?: string;
  autoOpen?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [payload, setPayload] = useState<Payload | null>(null);
  const [active, setActive] = useState(0);
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------------------------------------------------------- load manifest */
  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    setStatus("loading");
    setError(null);
    fetchPlayback(kind, slug)
      .then((data) => {
        if (cancelled) return;
        if (!data.ok || !data.sources?.length) {
          setStatus("error");
          setError("No playable source was returned for this title.");
          return;
        }
        setPayload(data);
        setActive(0);
        setStatus("ready");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setStatus("error");
        setError(err.message || "Could not reach the playback API.");
      });
    return () => {
      cancelled = true;
    };
  }, [started, kind, slug]);

  /* ------------------------------------------------------------- attach src */
  useEffect(() => {
    const video = videoRef.current;
    const source = payload?.sources?.[active];
    if (!video || !source) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl");
    const isHls = source.type === "hls";

    if (isHls && !nativeHls) {
      let disposed = false;
      import("hls.js")
        .then(({ default: Hls }) => {
          if (disposed || !videoRef.current) return;
          if (!Hls.isSupported()) {
            videoRef.current.src = source.url;
            return;
          }
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hlsRef.current = hls;
          hls.loadSource(source.url);
          hls.attachMedia(videoRef.current);
          hls.on(Hls.Events.ERROR, (_event: unknown, data: any) => {
            if (data?.fatal) {
              hls.destroy();
              hlsRef.current = null;
              // fall back to the first non-HLS source if the CDN hiccups
              const fallbackIndex = payload.sources.findIndex((entry) => entry.type !== "hls");
              if (fallbackIndex >= 0 && fallbackIndex !== active) {
                setActive(fallbackIndex);
              } else {
                setStatus("error");
                setError("The stream could not be loaded (network or CORS). Try another quality.");
              }
            }
          });
        })
        .catch(() => {
          video.src = source.url;
        });
      return () => {
        disposed = true;
      };
    }

    video.src = source.url;
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [payload, active]);

  /* ----------------------------------------------------------- media events */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => {
      setCurrent(video.currentTime);
      if (video.buffered.length) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onMeta = () => setDuration(video.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => {
      setStatus("error");
      setError("This source refused to play in the browser. Pick another quality.");
    };
    const onWaiting = () => setStatus((state) => (state === "error" ? state : "loading"));
    const onPlaying = () => {
      setStatus("ready");
      setError(null);
    };

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("progress", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("durationchange", onMeta);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onError);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);

    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("progress", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("durationchange", onMeta);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onError);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
    };
  }, []);

  /* -------------------------------------------------------------- fullscreen */
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (video.paused) await video.play();
      else video.pause();
    } catch {
      setStatus("error");
      setError("Autoplay was blocked by the browser — press play again.");
    }
  }, []);

  const seek = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrent(value);
  };

  const setVol = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const toggleFullscreen = async () => {
    const node = wrapperRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await node.requestFullscreen();
    } catch {
      /* browsers may block without gesture */
    }
  };

  const nudge = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + delta), video.duration || 0);
  };

  const wakeControls = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 2800);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!started) return;
      if (event.key === " ") {
        event.preventDefault();
        toggle();
      }
      if (event.key === "ArrowRight") nudge(10);
      if (event.key === "ArrowLeft") nudge(-10);
      if (event.key === "m") toggleMute();
      if (event.key === "f") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, toggle]);

  useEffect(() => {
    if (started) {
      const video = videoRef.current;
      video?.play().catch(() => {
        /* requires a gesture on some browsers; the poster CTA stays visible */
      });
    }
  }, [started]);

  useEffect(() => {
    if (autoOpen && !started) setStarted(true);
  }, [autoOpen, started]);

  /* ---------------------------------------------------------------- rendering */
  return (
    <div ref={wrapperRef} className="vp" onMouseMove={wakeControls}>
      {!started ? (
        <button type="button" className="vp-launch" onClick={() => setStarted(true)} aria-label={`Play ${title}`}>
          {poster ? <img src={poster} alt="" className="vp-poster" /> : null}
          <span className="vp-shade" aria-hidden />
          <span className="vp-play">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.2v13.6L19 12z" />
            </svg>
          </span>
          <span className="vp-launch-copy">
            <strong>Play {title}</strong>
            <small>
              {kind === "game" ? "Game trailer" : "Full stream"} · 1080p · subtitles on demand
            </small>
          </span>
        </button>
      ) : (
        <>
          <video
            ref={videoRef}
            className="vp-video"
            poster={poster}
            playsInline
            controls={false}
            preload="metadata"
            onClick={toggle}
          />

          {status === "loading" ? (
            <div className="vp-spinner" aria-live="polite">
              <span />
              <em>Buffering stream…</em>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="vp-error" role="alert">
              <strong>Playback failed</strong>
              <p>{error}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <button type="button" className="vp-btn vp-btn-acc" onClick={() => setActive((value) => (value + 1) % (payload?.sources.length || 1))}>
                  Try another source
                </button>
                <button type="button" className="vp-btn" onClick={() => setStarted(false)}>
                  Back to poster
                </button>
              </div>
            </div>
          ) : null}

          {!playing && status !== "loading" ? (
            <button type="button" className="vp-center-play" onClick={toggle} aria-label="Play">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5.2v13.6L19 12z" />
              </svg>
            </button>
          ) : null}

          <div className="vp-controls" data-visible={showControls || !playing}>
            <div className="vp-scrub">
              <div className="vp-scrub-buffer" style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
              <div className="vp-scrub-fill" style={{ width: `${duration ? (current / duration) * 100 : 0}%` }} />
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={current}
                onChange={(event) => seek(Number(event.target.value))}
                aria-label="Seek"
              />
            </div>
            <div className="vp-bar">
              <button type="button" className="vp-ico" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
                {playing ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2v13.6L19 12z" /></svg>
                )}
              </button>
              <button type="button" className="vp-ico" onClick={() => nudge(-10)} aria-label="Back 10 seconds">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9l5 4" /><path d="M6 9h7a5 5 0 1 1 0 10H9" /></svg>
              </button>
              <button type="button" className="vp-ico" onClick={() => nudge(10)} aria-label="Forward 10 seconds">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m13 5 5 4-5 4" /><path d="M18 9h-7a5 5 0 1 0 0 10h4" /></svg>
              </button>
              <button type="button" className="vp-ico" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
                {muted || volume === 0 ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M4 9v6h3l5 4V5L7 9z" /><path d="m16 9 5 6M21 9l-5 6" /></svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M4 9v6h3l5 4V5L7 9z" /><path d="M16 8.5a5 5 0 0 1 0 7" /></svg>
                )}
              </button>
              <input
                className="vp-vol"
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={muted ? 0 : volume}
                onChange={(event) => setVol(Number(event.target.value))}
                aria-label="Volume"
              />
              <span className="vp-time">
                {fmt(current)} <i>/</i> {fmt(duration)}
              </span>

              <div className="vp-sources">
                {(payload?.sources ?? []).slice(0, 4).map((source, index) => (
                  <button
                    key={`${source.url}-${index}`}
                    type="button"
                    className="vp-src"
                    data-active={index === active}
                    onClick={() => setActive(index)}
                  >
                    {source.quality}
                  </button>
                ))}
              </div>

              <button type="button" className="vp-ico" onClick={toggleFullscreen} aria-label="Fullscreen">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5" />
                </svg>
              </button>
            </div>
          </div>

          {payload ? (
            <span className="vp-badge">
              {payload.mode === "demo" ? "DEMO REEL" : payload.mode === "cdn" ? "CDN" : "LIBRARY"} ·{" "}
              {payload.sources[active]?.note ?? payload.sources[active]?.label ?? "stream"}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}
