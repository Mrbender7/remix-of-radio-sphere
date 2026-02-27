
interface GenreAnimationProps {
  genre: string;
}

const NeonGradient = ({ id }: { id: string }) => (
  <defs>
    <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#00d2ff" />
      <stop offset="100%" stopColor="#9d50bb" />
    </linearGradient>
  </defs>
);

const svgBase = "absolute right-2 top-1/2 -translate-y-1/2 w-16 h-16";
const filterStyle: React.CSSProperties = { filter: "drop-shadow(0 0 4px rgba(0,210,255,0.6)) drop-shadow(0 0 8px rgba(157,80,187,0.4))", opacity: 0.9 };
const S = { strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

function Vinyl() {
  const g = "n-70s";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={g} />
      <circle cx="40" cy="40" r="32" stroke={`url(#${g})`} strokeWidth="2.5" {...S} />
      <circle cx="40" cy="40" r="22" stroke={`url(#${g})`} strokeWidth="1.5" {...S} />
      <circle cx="40" cy="40" r="12" stroke={`url(#${g})`} strokeWidth="1.5" {...S} />
      <circle cx="40" cy="40" r="5" stroke={`url(#${g})`} strokeWidth="2.5" {...S} />
      {/* grooves */}
      <circle cx="40" cy="40" r="27" stroke={`url(#${g})`} strokeWidth="0.5" {...S} opacity="0.4" />
      <circle cx="40" cy="40" r="17" stroke={`url(#${g})`} strokeWidth="0.5" {...S} opacity="0.4" />
      <g>
        <animateTransform attributeName="transform" type="rotate" from="0 40 40" to="360 40 40" dur="6s" repeatCount="indefinite" />
        <line x1="40" y1="8" x2="40" y2="14" stroke={`url(#${g})`} strokeWidth="1" {...S} opacity="0.3" />
      </g>
    </svg>
  );
}

function NeonZigzag() {
  const g = "n-80s";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={g} />
      <polyline points="5,55 18,18 32,52 46,12 60,48 75,15" stroke={`url(#${g})`} strokeWidth="3" {...S}>
        <animate attributeName="opacity" values="0.5;1;0.5" dur="1.2s" repeatCount="indefinite" />
      </polyline>
      <polyline points="8,68 22,32 36,62 50,22 64,58 78,28" stroke={`url(#${g})`} strokeWidth="2" {...S} opacity="0.4">
        <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1.8s" repeatCount="indefinite" />
      </polyline>
    </svg>
  );
}

function Equalizer() {
  const g = "n-90s";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={g} />
      <rect x="6" y="20" width="8" height="50" rx="2" stroke={`url(#${g})`} strokeWidth="2" {...S}>
        <animate attributeName="height" values="50;20;40;50" dur="0.7s" repeatCount="indefinite" />
        <animate attributeName="y" values="20;50;30;20" dur="0.7s" repeatCount="indefinite" />
      </rect>
      <rect x="19" y="10" width="8" height="60" rx="2" stroke={`url(#${g})`} strokeWidth="2" {...S}>
        <animate attributeName="height" values="60;30;55;60" dur="0.5s" repeatCount="indefinite" />
        <animate attributeName="y" values="10;40;15;10" dur="0.5s" repeatCount="indefinite" />
      </rect>
      <rect x="32" y="25" width="8" height="45" rx="2" stroke={`url(#${g})`} strokeWidth="2" {...S}>
        <animate attributeName="height" values="45;15;50;45" dur="0.9s" repeatCount="indefinite" />
        <animate attributeName="y" values="25;55;20;25" dur="0.9s" repeatCount="indefinite" />
      </rect>
      <rect x="45" y="15" width="8" height="55" rx="2" stroke={`url(#${g})`} strokeWidth="2" {...S}>
        <animate attributeName="height" values="55;25;45;55" dur="0.6s" repeatCount="indefinite" />
        <animate attributeName="y" values="15;45;25;15" dur="0.6s" repeatCount="indefinite" />
      </rect>
      <rect x="58" y="30" width="8" height="40" rx="2" stroke={`url(#${g})`} strokeWidth="2" {...S}>
        <animate attributeName="height" values="40;18;48;40" dur="0.8s" repeatCount="indefinite" />
        <animate attributeName="y" values="30;52;22;30" dur="0.8s" repeatCount="indefinite" />
      </rect>
      <rect x="71" y="20" width="8" height="50" rx="2" stroke={`url(#${g})`} strokeWidth="2" {...S}>
        <animate attributeName="height" values="50;28;42;50" dur="0.55s" repeatCount="indefinite" />
        <animate attributeName="y" values="20;42;28;20" dur="0.55s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

function ConcentricCircles() {
  const g = "n-ambient";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={g} />
      {[10, 20, 30].map((r, i) => (
        <circle key={i} cx="40" cy="40" r={r} stroke={`url(#${g})`} strokeWidth="2" {...S}>
          <animate attributeName="r" values={`${r};${r + 4};${r}`} dur={`${3 + i}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur={`${3 + i}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

function SineWave() {
  const g = "n-chill";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={g} />
      <path d="M2,40 Q20,15 40,40 T78,40" stroke={`url(#${g})`} strokeWidth="2.5" {...S}>
        <animate attributeName="d" values="M2,40 Q20,15 40,40 T78,40;M2,40 Q20,60 40,40 T78,40;M2,40 Q20,15 40,40 T78,40" dur="3.5s" repeatCount="indefinite" />
      </path>
      <path d="M2,52 Q20,28 40,52 T78,52" stroke={`url(#${g})`} strokeWidth="1.5" {...S} opacity="0.5">
        <animate attributeName="d" values="M2,52 Q20,28 40,52 T78,52;M2,52 Q20,70 40,52 T78,52;M2,52 Q20,28 40,52 T78,52" dur="4.5s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

function GrandPiano() {
  const g = "n-classical";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={g} />
      {/* Grand piano body - top view silhouette */}
      <path d="M20,55 L20,25 C20,15 35,8 50,12 C62,15 68,25 68,35 L68,55 C68,58 65,60 62,60 L26,60 C23,60 20,58 20,55Z" stroke={`url(#${g})`} strokeWidth="2.5" {...S} />
      {/* Lid prop */}
      <line x1="44" y1="15" x2="44" y2="58" stroke={`url(#${g})`} strokeWidth="1.5" {...S} opacity="0.5" />
      {/* Keys hint at bottom */}
      <rect x="22" y="54" width="44" height="5" rx="1" stroke={`url(#${g})`} strokeWidth="1.5" {...S} />
      {/* Black keys */}
      {[28, 34, 44, 50, 56].map((x, i) => (
        <line key={i} x1={x} y1="54" x2={x} y2="57" stroke={`url(#${g})`} strokeWidth="1.5" {...S} />
      ))}
      {/* Musical notes floating */}
      <g>
        <circle cx="14" cy="20" r="2.5" stroke={`url(#${g})`} strokeWidth="1.5" {...S}>
          <animate attributeName="cy" values="22;14;22" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;1;0.3" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <line x1="16.5" y1="20" x2="16.5" y2="12" stroke={`url(#${g})`} strokeWidth="1" {...S}>
          <animate attributeName="y1" values="22;14;22" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="y2" values="14;6;14" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;1;0.3" dur="2.5s" repeatCount="indefinite" />
        </line>
      </g>
      <g>
        <circle cx="72" cy="18" r="2" stroke={`url(#${g})`} strokeWidth="1.5" {...S}>
          <animate attributeName="cy" values="20;12;20" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.2;0.8;0.2" dur="3s" repeatCount="indefinite" />
        </circle>
        <line x1="74" y1="18" x2="74" y2="10" stroke={`url(#${g})`} strokeWidth="1" {...S}>
          <animate attributeName="y1" values="20;12;20" dur="3s" repeatCount="indefinite" />
          <animate attributeName="y2" values="12;4;12" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.2;0.8;0.2" dur="3s" repeatCount="indefinite" />
        </line>
      </g>
    </svg>
  );
}

function ElectricCircuit() {
  const g = "n-electronic";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={g} />
      <polyline points="5,40 20,40 25,15 35,65 45,25 55,55 60,40 75,40" stroke={`url(#${g})`} strokeWidth="2.5" {...S}>
        <animate attributeName="stroke-dashoffset" values="200;0" dur="2s" repeatCount="indefinite" />
      </polyline>
      <circle cx="40" cy="40" r="5" stroke={`url(#${g})`} strokeWidth="2.5" {...S}>
        <animate attributeName="r" values="4;9;4" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function Microphone() {
  const g = "n-hiphop";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={g} />
      {/* Mic head */}
      <rect x="30" y="10" width="20" height="32" rx="10" stroke={`url(#${g})`} strokeWidth="2.5" {...S} />
      {/* Grille lines */}
      {[18, 24, 30].map((y, i) => (
        <line key={i} x1="33" x2="47" y1={y} y2={y} stroke={`url(#${g})`} strokeWidth="1" {...S} opacity="0.4" />
      ))}
      {/* Stand */}
      <line x1="40" y1="42" x2="40" y2="60" stroke={`url(#${g})`} strokeWidth="2.5" {...S} />
      <line x1="28" y1="60" x2="52" y2="60" stroke={`url(#${g})`} strokeWidth="2.5" {...S} />
      {/* Sound waves */}
      {[16, 22, 28].map((r, i) => (
        <path key={i} d={`M${40 - r},30 A${r},${r} 0 0,0 ${40 + r},30`} stroke={`url(#${g})`} strokeWidth="1.5" {...S}>
          <animate attributeName="opacity" values="0.1;0.8;0.1" dur={`${1.2 + i * 0.3}s`} repeatCount="indefinite" />
        </path>
      ))}
    </svg>
  );
}

function Saxophone() {
  const g = "n-jazz";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={g} />
      {/* Mouthpiece */}
      <path d="M22,8 L28,8 L30,14" stroke={`url(#${g})`} strokeWidth="2.5" {...S} />
      {/* Neck going down */}
      <path d="M30,14 L32,28" stroke={`url(#${g})`} strokeWidth="2.5" {...S} />
      {/* Body curve - the characteristic saxophone bend */}
      <path d="M32,28 C32,34 34,40 38,46 C42,52 46,56 46,62 C46,68 42,72 36,72 C30,72 26,68 26,62" stroke={`url(#${g})`} strokeWidth="3" {...S} />
      {/* Bell flare */}
      <path d="M24,58 C22,62 22,68 26,72 C30,76 38,76 42,72 C46,68 48,64 48,60" stroke={`url(#${g})`} strokeWidth="2" {...S} opacity="0.6" />
      {/* Keys on body */}
      <circle cx="34" cy="34" r="2" stroke={`url(#${g})`} strokeWidth="1.5" {...S} />
      <circle cx="36" cy="42" r="2" stroke={`url(#${g})`} strokeWidth="1.5" {...S} />
      <circle cx="40" cy="50" r="2" stroke={`url(#${g})`} strokeWidth="1.5" {...S} />
      {/* Floating music notes */}
      <g>
        <ellipse cx="58" cy="20" rx="3" ry="2.5" stroke={`url(#${g})`} strokeWidth="1.5" {...S}>
          <animate attributeName="cy" values="22;12;22" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;1;0.3" dur="2.5s" repeatCount="indefinite" />
        </ellipse>
        <line x1="61" y1="20" x2="61" y2="10" stroke={`url(#${g})`} strokeWidth="1" {...S}>
          <animate attributeName="y1" values="22;12;22" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="y2" values="12;2;12" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;1;0.3" dur="2.5s" repeatCount="indefinite" />
        </line>
      </g>
      <g>
        <ellipse cx="64" cy="36" rx="2.5" ry="2" stroke={`url(#${g})`} strokeWidth="1.5" {...S}>
          <animate attributeName="cy" values="38;28;38" dur="3.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.2;0.8;0.2" dur="3.2s" repeatCount="indefinite" />
        </ellipse>
        <line x1="66.5" y1="36" x2="66.5" y2="26" stroke={`url(#${g})`} strokeWidth="1" {...S}>
          <animate attributeName="y1" values="38;28;38" dur="3.2s" repeatCount="indefinite" />
          <animate attributeName="y2" values="28;18;28" dur="3.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.2;0.8;0.2" dur="3.2s" repeatCount="indefinite" />
        </line>
      </g>
    </svg>
  );
}

function RadioWaves() {
  const g = "n-news";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={g} />
      {/* Antenna */}
      <line x1="36" y1="68" x2="40" y2="28" stroke={`url(#${g})`} strokeWidth="2.5" {...S} />
      <circle cx="40" cy="26" r="3" stroke={`url(#${g})`} strokeWidth="2.5" {...S} />
      {/* Base */}
      <line x1="26" y1="68" x2="46" y2="68" stroke={`url(#${g})`} strokeWidth="2.5" {...S} />
      {/* Waves */}
      {[14, 22, 30].map((r, i) => (
        <path key={i} d={`M${40 - r},26 A${r},${r} 0 0,1 ${40 + r},26`} stroke={`url(#${g})`} strokeWidth="2" {...S}>
          <animate attributeName="opacity" values="0.2;1;0.2" dur={`${1 + i * 0.4}s`} repeatCount="indefinite" />
        </path>
      ))}
    </svg>
  );
}

function Star() {
  const g = "n-pop";
  const points = "40,8 47,28 68,28 51,42 57,62 40,50 23,62 29,42 12,28 33,28";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={g} />
      <polygon points={points} stroke={`url(#${g})`} strokeWidth="2.5" {...S}>
        <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
      </polygon>
      {/* Sparkle dots */}
      {[{x: 16, y: 16}, {x: 68, y: 14}, {x: 65, y: 56}, {x: 10, y: 52}].map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.5" stroke={`url(#${g})`} strokeWidth="1.5" {...S}>
          <animate attributeName="r" values="0.5;3;0.5" dur={`${1.2 + i * 0.3}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;0" dur={`${1.2 + i * 0.3}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

function HeartPulse() {
  const g = "n-rnb";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={g} />
      <path d="M40,65 C25,50 8,40 8,26 C8,16 16,10 26,13 C33,15 37,20 40,25 C43,20 47,15 54,13 C64,10 72,16 72,26 C72,40 55,50 40,65Z" stroke={`url(#${g})`} strokeWidth="2.5" {...S}>
        <animateTransform attributeName="transform" type="scale" values="1;1.08;1" dur="1s" repeatCount="indefinite" additive="sum" />
      </path>
    </svg>
  );
}

function RockHand() {
  const g = "n-rock";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={g} />
      {/* Palm */}
      <path d="M25,55 L25,38 C25,36 27,34 29,34 L51,34 C53,34 55,36 55,38 L55,55 C55,62 48,68 40,68 C32,68 25,62 25,55Z" stroke={`url(#${g})`} strokeWidth="2.5" {...S} />
      {/* Index finger (up) */}
      <path d="M29,34 L29,12 C29,10 31,8 33,8 C35,8 37,10 37,12 L37,34" stroke={`url(#${g})`} strokeWidth="2.5" {...S} />
      {/* Pinky finger (up) */}
      <path d="M43,34 L43,14 C43,12 45,10 47,10 C49,10 51,12 51,14 L51,34" stroke={`url(#${g})`} strokeWidth="2.5" {...S} />
      {/* Middle + ring folded */}
      <path d="M34,34 C34,30 36,28 38,30" stroke={`url(#${g})`} strokeWidth="1.5" {...S} opacity="0.5" />
      <path d="M39,34 C39,30 41,28 43,30" stroke={`url(#${g})`} strokeWidth="1.5" {...S} opacity="0.5" />
      {/* Thumb tucked */}
      <path d="M25,42 L20,40 C18,39 18,36 20,35 L25,36" stroke={`url(#${g})`} strokeWidth="2" {...S} />
      {/* Shockwave lines */}
      <line x1="14" y1="10" x2="18" y2="16" stroke={`url(#${g})`} strokeWidth="2" {...S}>
        <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" />
      </line>
      <line x1="60" y1="8" x2="56" y2="14" stroke={`url(#${g})`} strokeWidth="2" {...S}>
        <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" begin="0.3s" />
      </line>
      <line x1="10" y1="22" x2="16" y2="24" stroke={`url(#${g})`} strokeWidth="1.5" {...S}>
        <animate attributeName="opacity" values="0;0.8;0" dur="2s" repeatCount="indefinite" begin="0.6s" />
      </line>
      <line x1="64" y1="20" x2="58" y2="22" stroke={`url(#${g})`} strokeWidth="1.5" {...S}>
        <animate attributeName="opacity" values="0;0.8;0" dur="2s" repeatCount="indefinite" begin="0.9s" />
      </line>
    </svg>
  );
}

function Flame() {
  const g = "n-soul";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={g} />
      <path d="M40,8 C46,22 62,32 58,52 C55,64 30,68 26,54 C24,44 34,44 37,50 C40,42 28,28 40,8Z" stroke={`url(#${g})`} strokeWidth="2.5" {...S}>
        <animate attributeName="d" values="M40,8 C46,22 62,32 58,52 C55,64 30,68 26,54 C24,44 34,44 37,50 C40,42 28,28 40,8Z;M40,10 C50,20 60,36 55,52 C52,65 32,65 28,54 C26,45 36,46 38,52 C42,40 30,26 40,10Z;M40,8 C46,22 62,32 58,52 C55,64 30,68 26,54 C24,44 34,44 37,50 C40,42 28,28 40,8Z" dur="2.5s" repeatCount="indefinite" />
      </path>
      {/* Inner flame */}
      <path d="M40,28 C44,36 50,42 48,52 C46,58 36,58 35,52 C34,48 38,48 40,28Z" stroke={`url(#${g})`} strokeWidth="1.5" {...S} opacity="0.5">
        <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

const GENRE_MAP: Record<string, () => JSX.Element> = {
  "70s": Vinyl,
  "80s": NeonZigzag,
  "90s": Equalizer,
  ambient: ConcentricCircles,
  chillout: SineWave,
  classical: GrandPiano,
  electronic: ElectricCircuit,
  hiphop: Microphone,
  jazz: Saxophone,
  news: RadioWaves,
  pop: Star,
  "r&b": HeartPulse,
  rock: RockHand,
  soul: Flame,
};

export function GenreAnimation({ genre }: GenreAnimationProps) {
  const Component = GENRE_MAP[genre.toLowerCase()];
  if (!Component) {
    return (
      <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
        <defs>
          <linearGradient id="n-fallback" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00d2ff" />
            <stop offset="100%" stopColor="#9d50bb" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r="20" stroke="url(#n-fallback)" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <animate attributeName="r" values="18;26;18" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite" />
        </circle>
      </svg>
    );
  }
  return <Component />;
}
