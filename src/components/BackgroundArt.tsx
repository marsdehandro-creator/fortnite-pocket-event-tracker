import type { CSSProperties } from "react";

/**
 * Purely decorative atmosphere behind the dashboard (desktop only). Layers, back to front:
 * gradient wash → figure artwork → glow → (page content renders above at z-index 1).
 *
 * The figures are original stylised silhouettes. To use licensed renders instead, drop the files in
 * public/art/ and set FIGURE_IMAGES below — masking, grading and opacity apply the same way.
 */

const FIGURE_IMAGES: { left?: string; right?: string } = {
  // left: "art/left.webp",
  // right: "art/right.webp",
};

function SharedDefs() {
  return (
    <defs>
      <linearGradient id="bgart-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2a1e5c" />
        <stop offset="0.55" stopColor="#141633" />
        <stop offset="1" stopColor="#07080f" />
      </linearGradient>
      <linearGradient id="bgart-rim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#a78bfa" />
        <stop offset="1" stopColor="#22d3ee" />
      </linearGradient>
      <pattern id="bgart-scan" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
        <rect width="6" height="1.4" fill="#8b5cf6" opacity="0.55" />
      </pattern>
      <filter id="bgart-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="6" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

/** Body parts are drawn twice: a dark gradient fill + scanline texture, then a glowing rim stroke. */
function Silhouette({ paths }: { paths: string[] }) {
  return (
    <>
      <g fill="url(#bgart-body)">
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g fill="url(#bgart-scan)" opacity="0.35">
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g fill="none" stroke="url(#bgart-rim)" strokeWidth="3" strokeLinejoin="round" filter="url(#bgart-glow)">
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </>
  );
}

/** Left figure — headband, high-collared coat, a fan of glowing cards; turned toward the centre. */
function FigureLeft() {
  const body = [
    // coat + shoulders
    "M140 1100 L150 540 C154 462 196 408 268 386 L300 376 L346 376 L384 386 C456 406 494 452 500 530 L512 1100 Z",
    // neck
    "M296 318 L348 318 L354 366 L290 366 Z",
    // head
    "M262 250 C262 196 292 168 324 168 C362 168 388 200 386 250 C386 300 360 334 324 336 C288 334 262 302 262 250 Z",
    // spiky hair
    "M254 252 C240 192 262 150 300 138 L288 108 L322 130 L332 96 L354 134 L382 114 L376 160 C396 184 396 222 388 250 C374 212 344 198 314 202 C288 206 268 224 254 252 Z",
    // headband tails
    "M262 222 C212 232 170 266 112 254 C154 238 192 212 236 204 Z",
    "M258 232 C214 266 184 306 132 326 C170 292 202 258 240 230 Z",
    // collar
    "M268 388 C254 346 258 318 274 300 L302 356 Z",
    "M378 388 C392 346 386 318 370 302 L346 356 Z",
    // raised forearm toward the centre
    "M470 470 C512 512 528 586 520 650 C514 690 478 700 452 684 C474 628 472 560 446 504 Z",
    "M520 640 C486 646 436 610 404 570 L426 546 C456 578 494 604 526 602 Z",
  ];
  const cards = [-22, -4, 14];
  return (
    <svg className="bg-art__svg" viewBox="0 0 600 1100" preserveAspectRatio="xMidYMin meet">
      <Silhouette paths={body} />
      {/* headband */}
      <path d="M256 214 C300 200 350 198 388 206 L386 226 C348 218 300 220 258 234 Z" fill="#c026d3" opacity="0.75" filter="url(#bgart-glow)" />
      {/* playing cards */}
      <g transform="translate(404 556)" filter="url(#bgart-glow)">
        {cards.map((r) => (
          <g key={r} transform={`rotate(${r}) translate(-24 -78)`}>
            <rect width="48" height="68" rx="6" fill="#1e1036" stroke="#e879f9" strokeWidth="2.5" />
            <path d="M24 20 L32 34 L24 48 L16 34 Z" fill="#e879f9" opacity="0.9" />
          </g>
        ))}
      </g>
      <g className="bg-art__tag" transform="translate(60 900) rotate(-12)">
        <text>PLAY</text>
        <text y="64">ADAPT</text>
        <text y="128">WIN</text>
      </g>
    </svg>
  );
}

/** Right figure — long hair, sunglasses, hand raised toward the centre. */
function FigureRight() {
  const body = [
    // long hair, back mass
    "M214 250 C200 168 246 120 302 116 C370 114 414 164 410 244 C424 330 448 420 486 540 C430 520 396 480 384 430 C372 486 344 520 318 540 L318 330 Z",
    // torso + shoulders
    "M100 1100 L118 552 C124 470 170 420 240 400 L268 388 L316 388 L340 400 C410 420 452 468 462 552 L480 1100 Z",
    // neck
    "M262 322 L314 322 L320 372 L256 372 Z",
    // head
    "M228 256 C228 202 256 172 290 172 C326 172 352 204 350 256 C350 306 324 340 290 342 C256 340 228 308 228 256 Z",
    // fringe
    "M226 248 C222 196 252 160 296 158 C334 158 360 186 356 226 C330 206 300 196 270 210 C252 220 236 234 226 248 Z",
    // raised arm toward the centre
    "M196 452 C148 430 116 386 110 324 C106 284 118 254 138 234 L170 242 C156 274 150 304 156 334 C164 374 192 404 224 418 Z",
    // hand + two raised fingers
    "M134 240 C126 204 132 172 148 162 L152 118 L166 120 L166 160 L176 116 L190 118 L182 168 C188 192 184 222 174 244 Z",
  ];
  return (
    <svg className="bg-art__svg" viewBox="0 0 600 1100" preserveAspectRatio="xMidYMin meet">
      <Silhouette paths={body} />
      {/* hair streak */}
      <path d="M330 140 C372 170 396 260 404 340 C390 300 370 240 336 196 Z" fill="#f472b6" opacity="0.7" filter="url(#bgart-glow)" />
      {/* sunglasses */}
      <g filter="url(#bgart-glow)">
        <rect x="236" y="234" width="48" height="26" rx="9" fill="#0e7490" stroke="#22d3ee" strokeWidth="2.5" />
        <rect x="294" y="234" width="48" height="26" rx="9" fill="#0e7490" stroke="#22d3ee" strokeWidth="2.5" />
        <path d="M284 244 L294 244" stroke="#22d3ee" strokeWidth="3" />
      </g>
      {/* choker */}
      <path d="M262 352 C280 362 300 362 318 352" fill="none" stroke="#e879f9" strokeWidth="4" filter="url(#bgart-glow)" />
      <g className="bg-art__tag" transform="translate(330 120) rotate(-10)">
        <text>GOOD</text>
        <text y="64">VIBES</text>
      </g>
      <g className="bg-art__tag" transform="translate(250 820) rotate(-12)">
        <text>DUOS</text>
        <text y="64">MAKE IT</text>
        <text y="128">BETTER</text>
      </g>
    </svg>
  );
}

/** Strength presets. B is the default (set in art.css); `?art=a|b|c` previews the others. */
const VARIANTS: Record<string, number> = { a: 0.1, b: 0.15, c: 0.2 };

function previewStrength(): number | undefined {
  try {
    return VARIANTS[new URLSearchParams(window.location.search).get("art")?.toLowerCase() ?? ""];
  } catch {
    return undefined;
  }
}

export function BackgroundArt() {
  const strength = previewStrength();
  return (
    <div className="bg-art" aria-hidden="true" style={strength ? ({ "--art-base": strength } as CSSProperties) : undefined}>
      <svg className="bg-art__defs" width="0" height="0" focusable="false">
        <SharedDefs />
      </svg>
      <div className="bg-art__wash" />
      <div className="bg-art__side bg-art__side--left">
        <div className="bg-art__figure bg-art__figure--left">
          {FIGURE_IMAGES.left ? <img src={FIGURE_IMAGES.left} alt="" /> : <FigureLeft />}
        </div>
      </div>
      <div className="bg-art__side bg-art__side--right">
        <div className="bg-art__figure bg-art__figure--right">
          {FIGURE_IMAGES.right ? <img src={FIGURE_IMAGES.right} alt="" /> : <FigureRight />}
        </div>
      </div>
      <div className="bg-art__glow" />
      <div className="bg-art__vignette" />
    </div>
  );
}
