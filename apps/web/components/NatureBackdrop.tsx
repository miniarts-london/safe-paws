"use client";

import Box from "@mui/material/Box";
import { keyframes } from "@mui/material/styles";

/**
 * An Egyptian landscape behind the home page words. By day: a blue sky with
 * the sun's glow drifting slowly across, birds gliding over. By night (dark
 * mode): a starry sky that twinkles, with the odd shooting star. Always: sand
 * dunes, the pyramids far off on the horizon, date palms swaying, and small
 * dogs running free across the sand.
 *
 * Decorative only. Everything moves with CSS transforms and opacity (cheap
 * for the browser) and holds still for people who've asked their device to
 * reduce motion.
 */

const glide = keyframes`
  from { transform: translate3d(-12vw, 0, 0); }
  to   { transform: translate3d(112vw, -4vh, 0); }
`;
const flap = keyframes`
  0%, 100% { transform: scaleY(1); }
  50%      { transform: scaleY(0.35); }
`;
const sway = keyframes`
  0%, 100% { transform: rotate(-1.2deg); }
  50%      { transform: rotate(1.6deg); }
`;
const run = keyframes`
  from { transform: translate3d(-6vw, 0, 0); }
  to   { transform: translate3d(106vw, 0, 0); }
`;
const runBack = keyframes`
  from { transform: translate3d(106vw, 0, 0) scaleX(-1); }
  to   { transform: translate3d(-6vw, 0, 0) scaleX(-1); }
`;
/** A gallop: the body bobs while the legs swap between stretched and gathered. */
const bob = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-1px); }
`;
const stride = keyframes`
  0%, 49.9%  { opacity: 1; }
  50%, 100%  { opacity: 0; }
`;
/** The sun's glow crosses the sky in a low arc, very slowly, and back. */
const sunArc = keyframes`
  0%   { transform: translate3d(0, 10vh, 0); }
  50%  { transform: translate3d(32vw, 0, 0); }
  100% { transform: translate3d(64vw, 10vh, 0); }
`;
/**
 * Sunrise, once, when the page opens (light mode). The sky starts a pale
 * dawn blue, warms to soft gold as the sun comes up over the horizon, then
 * clears to the day's blue. After that the sun drifts slowly as before.
 */
const SUNRISE_S = 18;
const dawnFade = keyframes`
  0%, 15% { opacity: 1; }
  45%     { opacity: 0; }
  100%    { opacity: 0; }
`;
const warmGlow = keyframes`
  0%   { opacity: 0; }
  40%  { opacity: 1; }
  60%  { opacity: 1; }
  100% { opacity: 0; }
`;
const rise = keyframes`
  from { transform: translate3d(0, 62vh, 0) scale(0.8); opacity: 0.6; }
  to   { transform: translate3d(0, 0, 0) scale(1); opacity: 1; }
`;

/**
 * Sunset, once, when the page opens in dark mode: a warm evening sky with
 * the sun sinking below the horizon, deepening into night as the stars come out.
 */
const SUNSET_S = 18;
const duskFade = keyframes`
  0%, 20% { opacity: 1; }
  70%     { opacity: 0.25; }
  100%    { opacity: 0; }
`;
const set = keyframes`
  from { transform: translate3d(0, 0, 0); opacity: 0.85; }
  80%  { opacity: 0.55; }
  to   { transform: translate3d(0, 42vh, 0); opacity: 0; }
`;
const starsIn = keyframes`
  0%, 30% { opacity: 0; }
  100%    { opacity: 1; }
`;

const twinkle = keyframes`
  0%, 100% { opacity: var(--lo); }
  50%      { opacity: 1; }
`;
/** A shooting star: a quick streak, then a long pause before the next. */
const shoot = keyframes`
  0%   { transform: translate3d(0, 0, 0) rotate(-24deg) scaleX(0.2); opacity: 0; }
  2%   { opacity: 1; }
  7%   { transform: translate3d(-34vw, 15vh, 0) rotate(-24deg) scaleX(1); opacity: 0; }
  100% { transform: translate3d(-34vw, 15vh, 0) rotate(-24deg) scaleX(1); opacity: 0; }
`;

const still = { "@media (prefers-reduced-motion: reduce)": { animation: "none" } };

/** Scene colours, day then night. */
const COLOURS = {
  light: {
    "--sky": "linear-gradient(180deg, #a9d6f2 0%, #cfe8f7 45%, #eef4ef 78%, #f6efdf 100%)",
    "--dune-back": "#efe0c0",
    "--dune-front": "#e6d0a2",
    // Far away, so paler and closer to the sky's colour.
    "--stone": "#ead9b6",
    "--stone-shade": "#dcc597",
    "--trunk": "#a88660",
    "--frond": "#6f9e6a",
    "--bird": "rgba(29, 36, 34, 0.35)",
    "--dog": "#8f6a40",
    "--dog-opacity": "0.3",
  },
  dark: {
    "--sky": "linear-gradient(180deg, #070d1c 0%, #0d1730 40%, #142030 72%, #19221f 100%)",
    "--dune-back": "#1f2722",
    "--dune-front": "#262c23",
    "--stone": "#273041",
    "--stone-shade": "#1f2735",
    "--trunk": "#36352a",
    "--frond": "#2b4330",
    "--bird": "transparent",
    "--dog": "#e4ece9",
    "--dog-opacity": "0.16",
  },
};

/** A number from 0 to 1 that looks random but is always the same for the same input. */
function hash(n: number) {
  let x = n + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
const round = (v: number) => Math.round(v * 100) / 100;

export function NatureBackdrop() {
  return (
    <Box
      aria-hidden
      sx={(t) => ({
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        ...COLOURS.light,
        ...t.applyStyles("dark", COLOURS.dark),
        backgroundImage: "var(--sky)",
      })}
    >
      <Sunrise />
      <Sunset />
      <Sun />
      <Stars />
      <Birds />
      <Horizon />
      <Dogs />
    </Box>
  );
}

/** Morning sky layers over the day's blue: pale dawn first, then a warm glow, both fading out. */
function Sunrise() {
  const layer = { position: "absolute", inset: 0, opacity: 0, "@media (prefers-reduced-motion: reduce)": { display: "none" } } as const;
  return (
    <Box sx={(t) => ({ ...t.applyStyles("dark", { display: "none" }) })}>
      <Box
        sx={{
          ...layer,
          background: "linear-gradient(180deg, #d6e3ee 0%, #e4ecf2 50%, #eef1ee 80%, #f2efe6 100%)",
          animation: `${dawnFade} ${SUNRISE_S}s ease-in-out forwards`,
        }}
      />
      <Box
        sx={{
          ...layer,
          background: "linear-gradient(180deg, #f6e7cf 0%, #fbe5c4 40%, #fdd9a8 75%, #f9cf98 100%)",
          animation: `${warmGlow} ${SUNRISE_S}s ease-in-out forwards`,
        }}
      />
    </Box>
  );
}

/** Dark mode: an evening sky over the night, with the sun going down, all fading as night falls. */
function Sunset() {
  const layer = { position: "absolute", inset: 0, "@media (prefers-reduced-motion: reduce)": { display: "none" } } as const;
  return (
    <Box sx={(t) => ({ display: "none", ...t.applyStyles("dark", { display: "block" }) })}>
      <Box
        sx={{
          ...layer,
          opacity: 0,
          // Deep at the top where the words are, warm only down by the horizon.
          background: "linear-gradient(180deg, #1c1f3a 0%, #34284a 35%, #5e3550 58%, #b4605a 80%, #ec9d5e 93%, #f4b86c 100%)",
          animation: `${duskFade} ${SUNSET_S}s ease-in-out forwards`,
        }}
      />
      <Box
        sx={{
          ...layer,
          inset: "auto",
          right: "14vw",
          bottom: { xs: 90, sm: 130 },
          width: { xs: 100, sm: 150 },
          height: { xs: 100, sm: 150 },
          borderRadius: "50%",
          opacity: 0,
          background:
            // Soft: a gentle warm disc with a faint glow, not a bright light.
            "radial-gradient(circle, rgba(255, 210, 160, 0.7) 0%, rgba(250, 170, 115, 0.5) 26%, rgba(235, 125, 90, 0.16) 50%, rgba(235, 125, 90, 0) 68%)",
          animation: `${set} ${SUNSET_S * 0.85}s ease-in forwards`,
        }}
      />
    </Box>
  );
}

/**
 * Daytime: the sun rises over the horizon as the page opens, then its soft
 * glow drifts slowly across the sky over a few minutes.
 */
function Sun() {
  return (
    <Box
      sx={(t) => ({
        position: "absolute",
        left: "-12vw",
        top: "-14vh",
        animation: `${rise} ${SUNRISE_S * 0.75}s cubic-bezier(0.2, 0.6, 0.3, 1) forwards`,
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        ...t.applyStyles("dark", { display: "none" }),
      })}
    >
      <Box
        sx={{
          width: { xs: 360, sm: 620 },
          height: { xs: 360, sm: 620 },
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255, 236, 190, 0.95) 0%, rgba(255, 220, 150, 0.55) 18%, rgba(255, 214, 140, 0.22) 40%, rgba(255, 214, 140, 0) 68%)",
          // Starts drifting once it has risen.
          animation: `${sunArc} 240s ease-in-out ${SUNRISE_S * 0.75}s infinite alternate`,
          transform: "translate3d(0, 10vh, 0)",
          "@media (prefers-reduced-motion: reduce)": { animation: "none", transform: "translate3d(48vw, 2vh, 0)" },
        }}
      />
    </Box>
  );
}

/** Night-time: stars twinkling at their own pace, and a shooting star now and then. */
function Stars() {
  const stars = Array.from({ length: 90 }, (_, i) => ({
    x: round(hash(i * 7 + 1) * 100),
    // Mostly high in the sky, thinning towards the horizon.
    y: round(Math.pow(hash(i * 7 + 2), 1.6) * 72),
    size: round(1 + hash(i * 7 + 3) * 1.8),
    dur: round(2.5 + hash(i * 7 + 4) * 4),
    delay: -round(hash(i * 7 + 5) * 6),
    lo: round(0.15 + hash(i * 7 + 6) * 0.35),
  }));
  return (
    <Box
      sx={(t) => ({
        display: "none",
        ...t.applyStyles("dark", {
          display: "block",
          // The stars come out as the sunset fades.
          animation: `${starsIn} ${SUNSET_S}s ease-in forwards`,
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }),
      })}
    >
      {stars.map((s, i) => (
        <Box
          key={i}
          sx={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            bgcolor: "#f3f6ff",
            boxShadow: s.size > 2.2 ? "0 0 6px rgba(220, 230, 255, 0.8)" : "none",
            // Fewer stars on phones.
            display: { xs: i % 2 ? "none" : "block", sm: "block" },
            "--lo": s.lo,
            opacity: s.lo,
            animation: `${twinkle} ${s.dur}s ease-in-out ${s.delay}s infinite`,
            ...still,
          }}
        />
      ))}
      {[
        { left: "78%", top: "8%", dur: 14, delay: -2 },
        { left: "56%", top: "4%", dur: 23, delay: -15 },
      ].map((s, i) => (
        <Box
          key={`shoot-${i}`}
          sx={{
            position: "absolute",
            left: s.left,
            top: s.top,
            width: 110,
            height: 2,
            borderRadius: 1,
            transformOrigin: "100% 50%",
            background: "linear-gradient(90deg, rgba(255,255,255,0.9), rgba(255,255,255,0))",
            opacity: 0,
            animation: `${shoot} ${s.dur}s ease-out ${s.delay}s infinite`,
            "@media (prefers-reduced-motion: reduce)": { display: "none" },
          }}
        />
      ))}
    </Box>
  );
}

/** y: % from the top; dur s; delay s (negative = already on its way). */
const BIRDS = [
  { y: 14, size: 22, dur: 46, delay: -6 },
  { y: 17, size: 16, dur: 46, delay: -8.5 },
  { y: 12, size: 14, dur: 46, delay: -10 },
  { y: 30, size: 18, dur: 62, delay: -38 },
  { y: 33, size: 13, dur: 62, delay: -40 },
];

/** Daytime birds gliding over (they've gone to roost at night). */
function Birds() {
  return (
    <>
      {BIRDS.map((b, i) => (
        <Box
          key={i}
          sx={(t) => ({
            position: "absolute",
            top: `${b.y}%`,
            left: 0,
            display: { xs: "none", sm: "block" }, // phones: keep the words clear
            animation: `${glide} ${b.dur}s linear ${b.delay}s infinite`,
            "@media (prefers-reduced-motion: reduce)": {
              animation: "none",
              transform: `translateX(${62 + i * 6}vw)`,
            },
            ...t.applyStyles("dark", { display: "none" }),
          })}
        >
          <Box
            component="svg"
            viewBox="0 0 24 10"
            sx={{
              width: b.size,
              display: "block",
              transformOrigin: "50% 60%",
              animation: `${flap} ${0.9 + i * 0.12}s ease-in-out infinite`,
              ...still,
            }}
          >
            <path d="M1 7 Q 6 1 12 6 Q 18 1 23 7" fill="none" stroke="var(--bird)" strokeWidth="1.6" strokeLinecap="round" />
          </Box>
        </Box>
      ))}
    </>
  );
}

/** bottom px above the page edge; size px wide; dur s to cross; back = running right to left. */
const DOGS = [
  { bottom: 42, size: 26, dur: 34, delay: -5, back: false, still: 22 },
  { bottom: 49, size: 21, dur: 40, delay: -18, back: false, still: 30 },
  { bottom: 35, size: 23, dur: 44, delay: -27, back: true, still: 74 },
];

/** Small, faint dogs trotting across the sand, taking their time. */
function Dogs() {
  return (
    <>
      {DOGS.map((d, i) => (
        <Box
          key={i}
          sx={{
            position: "absolute",
            left: 0,
            bottom: { xs: d.bottom * 0.6, sm: d.bottom },
            // One dog on phones, three on wider screens.
            display: { xs: i === 0 ? "block" : "none", sm: "block" },
            animation: `${d.back ? runBack : run} ${d.dur}s linear ${d.delay}s infinite`,
            "@media (prefers-reduced-motion: reduce)": {
              animation: "none",
              transform: `translateX(${d.still}vw)${d.back ? " scaleX(-1)" : ""}`,
            },
          }}
        >
          <Box sx={{ animation: `${bob} 0.46s ease-in-out infinite`, ...still }}>
            <RunningDog width={d.size} />
          </Box>
        </Box>
      ))}
    </>
  );
}

/** A side-on silhouette in mid-gallop, with two leg poses that alternate. */
function RunningDog({ width }: { width: number }) {
  const leg = { stroke: "var(--dog)", strokeWidth: 3.6, strokeLinecap: "round" as const, fill: "none" };
  return (
    // Solid shapes, faded as one, so overlapping parts don't show seams.
    <Box component="svg" viewBox="0 0 64 34" sx={{ width, display: "block", overflow: "visible", opacity: "var(--dog-opacity)" }}>
      <g fill="var(--dog)">
        <ellipse cx="30" cy="16" rx="15" ry="6.2" />
        <path d="M40 13 Q 45 6 50 6 L 52 12 Q 47 15 42 19 Z" />
        <ellipse cx="53" cy="8" rx="5.6" ry="4.2" />
        <ellipse cx="58.5" cy="10" rx="4" ry="2.4" />
        <polygon points="49,5 51,-1 54,5" />
      </g>
      <path d="M16 13 Q 9 6 4 8" {...leg} strokeWidth={3} />
      {/* Stretched out */}
      <Box component="g" sx={{ animation: `${stride} 0.46s steps(1) infinite`, ...still }}>
        <path d="M42 19 L 55 27" {...leg} />
        <path d="M39 20 L 49 30" {...leg} />
        <path d="M20 19 L 7 26" {...leg} />
        <path d="M23 20 L 13 30" {...leg} />
      </Box>
      {/* Gathered under */}
      <Box
        component="g"
        sx={{
          opacity: 0,
          animation: `${stride} 0.46s steps(1) -0.23s infinite`,
          "@media (prefers-reduced-motion: reduce)": { animation: "none", opacity: 0 },
        }}
      >
        <path d="M42 19 L 38 31" {...leg} />
        <path d="M39 20 L 33 30" {...leg} />
        <path d="M20 19 L 26 31" {...leg} />
        <path d="M23 20 L 30 30" {...leg} />
      </Box>
    </Box>
  );
}

/**
 * Dunes, pyramids and palms along the bottom edge. Wide screens see the whole
 * scene; phones see the right-hand part (pyramids and a palm) at a size that reads.
 */
function Horizon() {
  return (
    <>
      <Scene viewBox="0 0 1440 240" sx={{ display: { xs: "none", sm: "block" }, height: 200 }} />
      <Scene viewBox="780 0 660 240" sx={{ display: { xs: "block", sm: "none" }, height: 150 }} />
    </>
  );
}

function Scene({ viewBox, sx }: { viewBox: string; sx: object }) {
  return (
    <Box sx={{ position: "absolute", left: 0, right: 0, bottom: 0, ...sx }}>
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMax slice" width="100%" height="100%" style={{ display: "block" }}>
        {/* Everything sits 40 units down, leaving headroom for the palm crowns. */}
        <g transform="translate(0 40)">
          {/* Pyramids of Giza, far off on the horizon: small and pale, their bases hidden behind the dune. */}
          <polygon points="1000,148 1062,86 1124,148" fill="var(--stone)" />
          <polygon points="1062,86 1124,148 1078,148" fill="var(--stone-shade)" />
          <polygon points="1108,148 1154,103 1200,148" fill="var(--stone)" />
          <polygon points="1154,103 1200,148 1166,148" fill="var(--stone-shade)" />
          <polygon points="1192,148 1218,122 1244,148" fill="var(--stone)" />
          <polygon points="1218,122 1244,148 1225,148" fill="var(--stone-shade)" />

          {/* Back dune */}
          <path d="M0 150 C 220 118, 420 146, 640 132 S 1060 146, 1440 124 L1440 200 L0 200 Z" fill="var(--dune-back)" />

          {/* Front dune */}
          <path d="M0 178 C 260 150, 540 184, 780 166 S 1220 152, 1440 172 L1440 200 L0 200 Z" fill="var(--dune-front)" />

          <Palm x={150} y={186} scale={0.85} delay={0} />
          <Palm x={226} y={180} scale={0.66} delay={-1.6} />
          <Palm x={1376} y={190} scale={0.78} delay={-0.8} />
        </g>
      </svg>
    </Box>
  );
}

const FRONDS = [-168, -140, -112, -76, -44, -16, 12];

/** A date palm. The whole tree leans gently from its base. */
function Palm({ x, y, scale, delay }: { x: number; y: number; scale: number; delay: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <Box
        component="g"
        sx={{
          transformBox: "fill-box",
          transformOrigin: "50% 100%",
          animation: `${sway} 6s ease-in-out ${delay}s infinite`,
          ...still,
        }}
      >
        <path d="M0 0 C 6 -40, -8 -84, 4 -128" fill="none" stroke="var(--trunk)" strokeWidth="7" strokeLinecap="round" />
        <g transform="translate(4 -128)">
          {FRONDS.map((angle) => (
            <path
              key={angle}
              transform={`rotate(${angle})`}
              d="M0 0 C 18 -14, 46 -14, 66 6 C 44 -2, 22 -2, 0 0 Z"
              fill="var(--frond)"
            />
          ))}
          {/* Dates */}
          <circle cx="-3" cy="6" r="3" fill="var(--trunk)" />
          <circle cx="3" cy="8" r="3" fill="var(--trunk)" />
        </g>
      </Box>
    </g>
  );
}
