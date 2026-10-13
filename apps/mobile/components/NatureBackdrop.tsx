import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, useColorScheme, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * The website's home scene on a phone: a blue sky with the sun's glow by day,
 * stars at night, the pyramids far off, a date palm, sand dunes, and a small
 * dog trotting across the sand. Decorative only, and it holds still for
 * people who've asked their phone to reduce motion.
 */

/** Scene colours, day then night (the same as the website's). */
const COLOURS = {
  light: {
    sky: ["#a9d6f2", "#cfe8f7", "#eef4ef", "#f6efdf"],
    duneBack: "#efe0c0",
    duneFront: "#e6d0a2",
    stone: "#ead9b6",
    stoneShade: "#dcc597",
    trunk: "#a88660",
    frond: "#6f9e6a",
    dog: "#8f6a40",
    dogOpacity: 0.3,
  },
  dark: {
    sky: ["#070d1c", "#0d1730", "#142030", "#19221f"],
    duneBack: "#1f2722",
    duneFront: "#262c23",
    stone: "#273041",
    stoneShade: "#1f2735",
    trunk: "#36352a",
    frond: "#2b4330",
    dog: "#e4ece9",
    dogOpacity: 0.16,
  },
};
type Colours = (typeof COLOURS)["light"];

/** How tall the dunes and palm are at the bottom, as on the website's phone layout. */
export const HORIZON_HEIGHT = 150;

/** A number from 0 to 1 that looks random but is always the same for the same input. */
function hash(n: number) {
  let x = n + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

// The web preview can't run animations on the native thread.
const native = Platform.OS !== "web";

export function NatureBackdrop() {
  const dark = useColorScheme() === "dark";
  const c = dark ? COLOURS.dark : COLOURS.light;
  const reduce = useReduceMotion();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Sky c={c} dark={dark} />
      {dark && <Stars reduce={reduce} />}
      <Horizon c={c} />
      <Dog c={c} reduce={reduce} />
    </View>
  );
}

/** The sky, with the sun's warm glow high on the left by day. */
function Sky({ c, dark }: { c: Colours; dark: boolean }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.sky[0]} />
          <Stop offset={dark ? "0.4" : "0.45"} stopColor={c.sky[1]} />
          <Stop offset={dark ? "0.72" : "0.78"} stopColor={c.sky[2]} />
          <Stop offset="1" stopColor={c.sky[3]} />
        </LinearGradient>
        <RadialGradient id="sun" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="rgb(255,236,190)" stopOpacity={0.95} />
          <Stop offset="0.18" stopColor="rgb(255,220,150)" stopOpacity={0.55} />
          <Stop offset="0.4" stopColor="rgb(255,214,140)" stopOpacity={0.22} />
          <Stop offset="0.68" stopColor="rgb(255,214,140)" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#sky)" />
      {!dark && <Circle cx="78%" cy="8%" r="180" fill="url(#sun)" />}
    </Svg>
  );
}

const STARS = Array.from({ length: 45 }, (_, i) => ({
  x: hash(i * 7 + 1) * 100,
  // Mostly high in the sky, thinning towards the horizon.
  y: Math.pow(hash(i * 7 + 2), 1.6) * 72,
  r: 0.5 + hash(i * 7 + 3) * 0.9,
  dim: hash(i * 7 + 6) < 0.5,
}));

/** Night: stars, half of them twinkling slowly. */
function Stars({ reduce }: { reduce: boolean }) {
  const glow = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.3, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(glow, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow, reduce]);
  const layer = (dim: boolean) => (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      {STARS.filter((s) => s.dim === dim).map((s, i) => (
        <Circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="#f3f6ff" opacity={dim ? 0.6 : 0.9} />
      ))}
    </Svg>
  );
  return (
    <>
      {layer(false)}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: glow }]}>{layer(true)}</Animated.View>
    </>
  );
}

const FRONDS = [-168, -140, -112, -76, -44, -16, 12];

/** Pyramids, dunes and a date palm along the bottom: the right-hand part of the website's scene. */
function Horizon({ c }: { c: Colours }) {
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: HORIZON_HEIGHT }}>
      <Svg viewBox="780 0 660 240" preserveAspectRatio="xMidYMax slice" width="100%" height="100%">
        <G transform="translate(0 40)">
          <Polygon points="1000,148 1062,86 1124,148" fill={c.stone} />
          <Polygon points="1062,86 1124,148 1078,148" fill={c.stoneShade} />
          <Polygon points="1108,148 1154,103 1200,148" fill={c.stone} />
          <Polygon points="1154,103 1200,148 1166,148" fill={c.stoneShade} />
          <Polygon points="1192,148 1218,122 1244,148" fill={c.stone} />
          <Polygon points="1218,122 1244,148 1225,148" fill={c.stoneShade} />
          <Path d="M0 150 C 220 118, 420 146, 640 132 S 1060 146, 1440 124 L1440 200 L0 200 Z" fill={c.duneBack} />
          <Path d="M0 178 C 260 150, 540 184, 780 166 S 1220 152, 1440 172 L1440 200 L0 200 Z" fill={c.duneFront} />
          <G transform="translate(1376 190) scale(0.78)">
            <Path d="M0 0 C 6 -40, -8 -84, 4 -128" fill="none" stroke={c.trunk} strokeWidth={7} strokeLinecap="round" />
            <G transform="translate(4 -128)">
              {FRONDS.map((angle) => (
                <Path key={angle} transform={`rotate(${angle})`} d="M0 0 C 18 -14, 46 -14, 66 6 C 44 -2, 22 -2, 0 0 Z" fill={c.frond} />
              ))}
              <Circle cx={-3} cy={6} r={3} fill={c.trunk} />
              <Circle cx={3} cy={8} r={3} fill={c.trunk} />
            </G>
          </G>
        </G>
      </Svg>
    </View>
  );
}

const DOG_WIDTH = 26;
const DOG_HEIGHT = (DOG_WIDTH * 34) / 64;

/** One small, faint dog trotting across the sand, taking its time. */
function Dog({ c, reduce }: { c: Colours; reduce: boolean }) {
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;
  const [stretched, setStretched] = useState(true);

  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: 34000, easing: Easing.linear, useNativeDriver: native }));
    loop.start();
    // The legs swap between stretched out and gathered under.
    const legs = setInterval(() => setStretched((s) => !s), 230);
    return () => {
      loop.stop();
      clearInterval(legs);
    };
  }, [x, reduce]);

  const translateX = reduce ? width * 0.22 : x.interpolate({ inputRange: [0, 1], outputRange: [-DOG_WIDTH - 10, width + 10] });
  const leg = { stroke: c.dog, strokeWidth: 3.6, strokeLinecap: "round" as const, fill: "none" };
  return (
    <Animated.View style={{ position: "absolute", left: 0, bottom: 25, opacity: c.dogOpacity, transform: [{ translateX }] }}>
      <Svg viewBox="0 -2 64 36" width={DOG_WIDTH} height={DOG_HEIGHT}>
        <G fill={c.dog}>
          <Ellipse cx={30} cy={16} rx={15} ry={6.2} />
          <Path d="M40 13 Q 45 6 50 6 L 52 12 Q 47 15 42 19 Z" />
          <Ellipse cx={53} cy={8} rx={5.6} ry={4.2} />
          <Ellipse cx={58.5} cy={10} rx={4} ry={2.4} />
          <Polygon points="49,5 51,-1 54,5" />
        </G>
        <Path d="M16 13 Q 9 6 4 8" {...leg} strokeWidth={3} />
        {stretched ? (
          <G>
            <Path d="M42 19 L 55 27" {...leg} />
            <Path d="M39 20 L 49 30" {...leg} />
            <Path d="M20 19 L 7 26" {...leg} />
            <Path d="M23 20 L 13 30" {...leg} />
          </G>
        ) : (
          <G>
            <Path d="M42 19 L 38 31" {...leg} />
            <Path d="M39 20 L 33 30" {...leg} />
            <Path d="M20 19 L 26 31" {...leg} />
            <Path d="M23 20 L 30 30" {...leg} />
          </G>
        )}
      </Svg>
    </Animated.View>
  );
}
