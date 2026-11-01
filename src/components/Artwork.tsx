import type { DiscoveryCategory, DiscoveryRarity } from "../types/intel";

/**
 * Generated artwork for cards that have no image yet. Deterministic per id, so a card always gets the same art.
 * Data records can supply a real `imageUrl` instead.
 */

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Small seeded PRNG for scattering particles. */
function rng(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const RARITY_COLOR: Record<DiscoveryRarity, string> = {
  common: "#94a3b8",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

function Motif({ category, color }: { category: DiscoveryCategory; color: string }) {
  switch (category) {
    case "secret-location":
      return (
        <g>
          <path d="M40 90 C40 40 70 22 100 22 C130 22 160 40 160 90 Z" fill="#05060a" />
          <path d="M62 90 C62 54 80 40 100 40 C120 40 138 54 138 90 Z" fill={color} opacity="0.35" />
          <circle cx="100" cy="66" r="10" fill={color} opacity="0.9" />
        </g>
      );
    case "hidden-chest-area":
      return (
        <g>
          <rect x="66" y="52" width="68" height="36" rx="4" fill="#3b2410" stroke={color} strokeWidth="2.5" />
          <path d="M66 52 C66 36 80 30 100 30 C120 30 134 36 134 52 Z" fill="#4a2e14" stroke={color} strokeWidth="2.5" />
          <rect x="94" y="48" width="12" height="14" rx="2" fill={color} />
          <ellipse cx="100" cy="30" rx="44" ry="10" fill={color} opacity="0.25" />
        </g>
      );
    case "loot-route":
      return (
        <g fill="none" stroke={color} strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round">
          <path d="M24 80 C60 30 90 90 120 50 S170 30 182 40" />
          <g strokeDasharray="0" fill={color}>
            <rect x="18" y="74" width="12" height="10" rx="2" />
            <rect x="114" y="44" width="12" height="10" rx="2" />
            <rect x="176" y="34" width="12" height="10" rx="2" />
          </g>
        </g>
      );
    case "easter-egg":
      return (
        <g>
          <ellipse cx="100" cy="82" rx="70" ry="10" fill={color} opacity="0.2" />
          <path d="M50 82 C60 56 82 44 100 44 C124 44 140 58 152 82 Z" fill="#0f2a22" stroke={color} strokeWidth="2" />
          <path d="M92 44 L92 24 L112 30 L92 36" fill={color} />
          <text x="100" y="72" textAnchor="middle" fontSize="20" fontWeight="800" fill={color}>?</text>
        </g>
      );
    case "rotation-route":
      return (
        <g>
          <path d="M30 84 Q100 -10 172 70" fill="none" stroke={color} strokeWidth="3" strokeDasharray="8 6" />
          <path d="M20 88 L44 72 L50 82 L28 94 Z" fill="#1e2433" stroke={color} strokeWidth="2" />
          <circle cx="172" cy="70" r="7" fill={color} />
        </g>
      );
    case "npc-spawn":
      return (
        <g>
          <path d="M70 92 C70 60 80 34 100 30 C120 34 130 60 130 92 Z" fill="#05060a" stroke={color} strokeWidth="2" />
          <circle cx="92" cy="54" r="3.5" fill={color} />
          <circle cx="108" cy="54" r="3.5" fill={color} />
          <path d="M100 20 l4 8 -4 -2 -4 2 z" fill={color} />
        </g>
      );
    case "vehicle-spawn":
      return (
        <g fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
          <path d="M56 34 H144 M100 34 V44" />
          <path d="M70 60 C70 48 84 44 100 44 H120 C132 44 140 52 140 62 C140 72 132 76 120 76 H86 C76 76 70 70 70 60 Z" fill="#111827" />
          <path d="M140 60 H172 L178 52 M84 76 V84 M124 76 V84 M76 84 H136" />
        </g>
      );
    case "competitive-advantage":
      return (
        <g fill="none" stroke={color} strokeWidth="2.5">
          <circle cx="100" cy="58" r="28" />
          <circle cx="100" cy="58" r="12" />
          <path d="M100 22 V40 M100 76 V94 M64 58 H82 M118 58 H136" />
          <circle cx="100" cy="58" r="3" fill={color} />
        </g>
      );
  }
}

export function DiscoveryArt({ id, category, rarity }: { id: string; category: DiscoveryCategory; rarity: DiscoveryRarity }) {
  const color = RARITY_COLOR[rarity];
  const rand = rng(hashString(id));
  const gid = `da-${id}`;
  const stars = Array.from({ length: 14 }, () => ({ x: rand() * 200, y: rand() * 60, r: 0.4 + rand() * 1.2, o: 0.3 + rand() * 0.6 }));
  return (
    <svg className="art-tile" viewBox="0 0 200 112" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1024" />
          <stop offset="1" stopColor={color} stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id={`${gid}-glow`} cx="0.5" cy="0.55" r="0.6">
          <stop offset="0" stopColor={color} stopOpacity="0.45" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="200" height="112" fill={`url(#${gid})`} />
      <rect width="200" height="112" fill={`url(#${gid}-glow)`} />
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />
      ))}
      <path d="M0 96 C40 88 80 100 120 94 S180 86 200 92 V112 H0 Z" fill="#05060a" opacity="0.7" />
      <Motif category={category} color={color} />
    </svg>
  );
}

/** Map-style thumbnail for a POI: an island blob with contour lines, coloured per POI. */
export function POIThumb({ id, name }: { id: string; name: string }) {
  const h = hashString(id);
  const hue = h % 360;
  const rand = rng(h);
  const gid = `pt-${id}`;
  const blob = (scale: number) => {
    const pts = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      const r = (16 + rand() * 7) * scale;
      return [32 + Math.cos(a) * r, 32 + Math.sin(a) * r];
    });
    return `M${pts.map((p) => p.map((n) => n.toFixed(1)).join(" ")).join(" L")} Z`;
  };
  const initials = name
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <svg className="poi-thumb" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 70% 22%)`} />
          <stop offset="1" stopColor={`hsl(${(hue + 40) % 360} 70% 12%)`} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="10" fill="#0a1a2e" />
      <path d={blob(1.15)} fill={`url(#${gid})`} stroke={`hsl(${hue} 80% 60%)`} strokeOpacity="0.6" strokeLinejoin="round" />
      <path d={blob(0.72)} fill="none" stroke={`hsl(${hue} 80% 70%)`} strokeOpacity="0.35" strokeLinejoin="round" />
      <path d={blob(0.4)} fill="none" stroke={`hsl(${hue} 80% 75%)`} strokeOpacity="0.3" strokeLinejoin="round" />
      <text x="32" y="37" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" opacity="0.92">
        {initials}
      </text>
    </svg>
  );
}
