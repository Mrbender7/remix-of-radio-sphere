
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

const svgBase = "absolute right-2 top-1/2 -translate-y-1/2 w-16 h-16 opacity-80";
const filterStyle: React.CSSProperties = { filter: "drop-shadow(0 0 6px #00d2ff) drop-shadow(0 0 2px #9d50bb)" };
const strokeProps = { strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

function Vinyl() {
  const gid = "neon-70s";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={gid} />
      <circle cx="40" cy="40" r="30" stroke={`url(#${gid})`} strokeWidth="2" {...strokeProps} />
      <circle cx="40" cy="40" r="18" stroke={`url(#${gid})`} strokeWidth="1.5" {...strokeProps} />
      <circle cx="40" cy="40" r="6" stroke={`url(#${gid})`} strokeWidth="2" {...strokeProps} />
      <animateTransform attributeName="transform" type="rotate" from="0 40 40" to="360 40 40" dur="8s" repeatCount="indefinite" />
    </svg>
  );
}

function NeonZigzag() {
  const gid = "neon-80s";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={gid} />
      <polyline points="10,60 25,20 40,55 55,15 70,50" stroke={`url(#${gid})`} strokeWidth="2.5" {...strokeProps}>
        <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite" />
      </polyline>
      <polyline points="15,70 30,35 45,65 60,25 75,60" stroke={`url(#${gid})`} strokeWidth="1.5" {...strokeProps} opacity="0.5">
        <animate attributeName="opacity" values="0.2;0.7;0.2" dur="2s" repeatCount="indefinite" />
      </polyline>
    </svg>
  );
}

function Equalizer() {
  const gid = "neon-90s";
  const bars = [15, 28, 41, 54, 67];
  const durs = ["0.8s", "0.6s", "1s", "0.7s", "0.9s"];
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={gid} />
      {bars.map((x, i) => (
        <line key={i} x1={x} x2={x} y1="70" y2="30" stroke={`url(#${gid})`} strokeWidth="6" {...strokeProps}>
          <animate attributeName="y2" values="30;10;50;30" dur={durs[i]} repeatCount="indefinite" />
        </line>
      ))}
    </svg>
  );
}

function ConcentricCircles() {
  const gid = "neon-ambient";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={gid} />
      {[12, 22, 32].map((r, i) => (
        <circle key={i} cx="40" cy="40" r={r} stroke={`url(#${gid})`} strokeWidth="1.5" {...strokeProps}>
          <animate attributeName="r" values={`${r};${r + 3};${r}`} dur={`${3 + i}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0.2;0.6" dur={`${3 + i}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

function SineWave() {
  const gid = "neon-chill";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={gid} />
      <path d="M5,40 Q20,20 40,40 T75,40" stroke={`url(#${gid})`} strokeWidth="2" {...strokeProps}>
        <animate attributeName="d" values="M5,40 Q20,20 40,40 T75,40;M5,40 Q20,55 40,40 T75,40;M5,40 Q20,20 40,40 T75,40" dur="4s" repeatCount="indefinite" />
      </path>
      <path d="M5,50 Q20,30 40,50 T75,50" stroke={`url(#${gid})`} strokeWidth="1.5" {...strokeProps} opacity="0.5">
        <animate attributeName="d" values="M5,50 Q20,30 40,50 T75,50;M5,50 Q20,65 40,50 T75,50;M5,50 Q20,30 40,50 T75,50" dur="5s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

function TrebleClef() {
  const gid = "neon-classical";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={gid} />
      <path d="M40,65 C40,65 35,50 35,40 C35,28 42,20 45,25 C48,30 42,38 38,35 C34,32 36,22 40,15 L40,10" stroke={`url(#${gid})`} strokeWidth="2.5" {...strokeProps}>
        <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite" />
      </path>
      <circle cx="55" cy="30" r="3" stroke={`url(#${gid})`} strokeWidth="1.5" {...strokeProps}>
        <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function ElectricCircuit() {
  const gid = "neon-electronic";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={gid} />
      <polyline points="10,40 25,40 30,20 40,60 50,30 55,40 70,40" stroke={`url(#${gid})`} strokeWidth="2" {...strokeProps}>
        <animate attributeName="stroke-dashoffset" values="200;0" dur="2s" repeatCount="indefinite" />
      </polyline>
      <circle cx="40" cy="40" r="4" stroke={`url(#${gid})`} strokeWidth="2" {...strokeProps}>
        <animate attributeName="r" values="4;8;4" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function Microphone() {
  const gid = "neon-hiphop";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={gid} />
      <rect x="32" y="15" width="16" height="30" rx="8" stroke={`url(#${gid})`} strokeWidth="2" {...strokeProps} />
      <line x1="40" y1="45" x2="40" y2="60" stroke={`url(#${gid})`} strokeWidth="2" {...strokeProps} />
      <line x1="30" y1="60" x2="50" y2="60" stroke={`url(#${gid})`} strokeWidth="2" {...strokeProps} />
      {[18, 24, 30].map((r, i) => (
        <path key={i} d={`M${40 - r},35 A${r},${r} 0 0,0 ${40 + r},35`} stroke={`url(#${gid})`} strokeWidth="1.5" {...strokeProps} opacity="0.4">
          <animate attributeName="opacity" values="0.1;0.6;0.1" dur={`${1.5 + i * 0.3}s`} repeatCount="indefinite" />
        </path>
      ))}
    </svg>
  );
}

function Saxophone() {
  const gid = "neon-jazz";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={gid} />
      <path d="M25,15 L30,15 L35,45 C35,55 45,60 45,65 C45,72 38,72 35,68" stroke={`url(#${gid})`} strokeWidth="2.5" {...strokeProps} />
      {[{cx: 55, cy: 25}, {cx: 60, cy: 18}, {cx: 50, cy: 15}].map((n, i) => (
        <circle key={i} cx={n.cx} cy={n.cy} r="3" stroke={`url(#${gid})`} strokeWidth="1.5" {...strokeProps}>
          <animate attributeName="cy" values={`${n.cy};${n.cy - 6};${n.cy}`} dur={`${2 + i * 0.5}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.8;0" dur={`${2 + i * 0.5}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

function RadioWaves() {
  const gid = "neon-news";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={gid} />
      <line x1="35" y1="65" x2="40" y2="30" stroke={`url(#${gid})`} strokeWidth="2" {...strokeProps} />
      <circle cx="40" cy="28" r="3" stroke={`url(#${gid})`} strokeWidth="2" {...strokeProps} />
      {[12, 20, 28].map((r, i) => (
        <path key={i} d={`M${40 - r},28 A${r},${r} 0 0,1 ${40 + r},28`} stroke={`url(#${gid})`} strokeWidth="1.5" {...strokeProps}>
          <animate attributeName="opacity" values="0.2;0.8;0.2" dur={`${1.2 + i * 0.4}s`} repeatCount="indefinite" />
        </path>
      ))}
    </svg>
  );
}

function Star() {
  const gid = "neon-pop";
  const points = "40,10 46,30 68,30 50,42 56,62 40,50 24,62 30,42 12,30 34,30";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={gid} />
      <polygon points={points} stroke={`url(#${gid})`} strokeWidth="2" {...strokeProps}>
        <animate attributeName="opacity" values="0.4;1;0.4" dur="2.5s" repeatCount="indefinite" />
      </polygon>
      {[{x: 18, y: 18}, {x: 65, y: 15}, {x: 62, y: 58}].map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.5" stroke={`url(#${gid})`} strokeWidth="1" {...strokeProps}>
          <animate attributeName="r" values="0.5;2.5;0.5" dur={`${1.5 + i * 0.4}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;0" dur={`${1.5 + i * 0.4}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

function HeartPulse() {
  const gid = "neon-rnb";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={gid} />
      <path d="M40,65 C25,50 10,40 10,28 C10,18 18,12 28,15 C34,17 38,22 40,26 C42,22 46,17 52,15 C62,12 70,18 70,28 C70,40 55,50 40,65Z" stroke={`url(#${gid})`} strokeWidth="2" {...strokeProps}>
        <animateTransform attributeName="transform" type="scale" values="1;1.06;1" dur="1.2s" repeatCount="indefinite" additive="sum" />
      </path>
    </svg>
  );
}

function ElectricGuitar() {
  const gid = "neon-rock";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={gid} />
      <path d="M55,10 L20,50 C15,55 18,65 28,65 C35,65 38,60 38,55 L42,50" stroke={`url(#${gid})`} strokeWidth="2.5" {...strokeProps} />
      <line x1="55" y1="10" x2="65" y2="5" stroke={`url(#${gid})`} strokeWidth="2" {...strokeProps} />
      {/* Lightning bolts */}
      <polyline points="60,25 65,30 62,32 68,40" stroke={`url(#${gid})`} strokeWidth="1.5" {...strokeProps}>
        <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" />
      </polyline>
      <polyline points="14,35 10,42 13,43 8,52" stroke={`url(#${gid})`} strokeWidth="1.5" {...strokeProps}>
        <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" begin="0.5s" />
      </polyline>
    </svg>
  );
}

function Flame() {
  const gid = "neon-soul";
  return (
    <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
      <NeonGradient id={gid} />
      <path d="M40,10 C45,25 60,35 55,55 C52,65 30,68 28,55 C26,45 35,45 38,50 C40,42 30,30 40,10Z" stroke={`url(#${gid})`} strokeWidth="2" {...strokeProps}>
        <animate attributeName="d" values="M40,10 C45,25 60,35 55,55 C52,65 30,68 28,55 C26,45 35,45 38,50 C40,42 30,30 40,10Z;M40,12 C48,22 58,38 53,55 C50,66 32,66 30,55 C28,46 37,46 39,52 C42,40 32,28 40,12Z;M40,10 C45,25 60,35 55,55 C52,65 30,68 28,55 C26,45 35,45 38,50 C40,42 30,30 40,10Z" dur="3s" repeatCount="indefinite" />
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
  classical: TrebleClef,
  electronic: ElectricCircuit,
  hiphop: Microphone,
  jazz: Saxophone,
  news: RadioWaves,
  pop: Star,
  "r&b": HeartPulse,
  rock: ElectricGuitar,
  soul: Flame,
};

export function GenreAnimation({ genre }: GenreAnimationProps) {
  const Component = GENRE_MAP[genre.toLowerCase()];
  if (!Component) {
    // Fallback: simple pulsing circle
    return (
      <svg viewBox="0 0 80 80" className={svgBase} style={filterStyle}>
        <defs>
          <linearGradient id="neon-fallback" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00d2ff" />
            <stop offset="100%" stopColor="#9d50bb" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r="20" stroke="url(#neon-fallback)" strokeWidth="2" fill="none" strokeLinecap="round">
          <animate attributeName="r" values="18;24;18" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0.8;0.4" dur="3s" repeatCount="indefinite" />
        </circle>
      </svg>
    );
  }
  return <Component />;
}
