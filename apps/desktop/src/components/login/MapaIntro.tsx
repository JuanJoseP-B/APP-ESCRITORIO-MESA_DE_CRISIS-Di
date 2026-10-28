/** Curvas de nivel finas: la última capa en dibujarse. */
const CURVAS = [
  'M920 200 C920 110 1200 110 1200 200 C1200 290 920 290 920 200',
  'M960 200 C960 145 1160 145 1160 200 C1160 255 960 255 960 200',
  'M1000 200 C1000 175 1120 175 1120 200 C1120 225 1000 225 1000 200',
  'M90 610 C90 520 380 520 380 610 C380 700 90 700 90 610',
  'M140 610 C140 560 330 560 330 610 C330 660 140 660 140 610',
  'M1050 640 C1110 560 1300 580 1340 660',
];

const CALLES = [
  'M-20 140 L1400 60',
  'M-20 330 L1400 190',
  'M-20 430 Q600 380 1400 450',
  'M-20 700 L1400 540',
  'M120 -20 L260 800',
  'M640 -20 L660 800',
  'M1120 -20 L1000 800',
  'M1260 -20 L1300 800',
  'M420 -20 L470 800',
];

const AVENIDAS = ['M-20 540 L1400 300', 'M300 -20 L540 800', 'M900 -20 L760 800'];

/** Anillos de riesgo alrededor del incidente (centro 683,384), de dentro hacia fuera. */
const ANILLOS = [
  { r: 70, relleno: 'rgba(168,38,30,.14)', trazo: 1.5 },
  { r: 160, relleno: 'rgba(168,38,30,.07)', trazo: 1.2 },
  { r: 270, relleno: 'rgba(168,38,30,.04)', trazo: 1 },
] as const;

/** Unidades que caen sobre el mapa; `ola` decide cuándo (1, 2 o 3). */
const UNIDADES = [
  { codigo: 'U01', x: 560, y: 300, color: '#1F5C5C', ola: 1 },
  { codigo: 'M10', x: 820, y: 470, color: '#1F5C5C', ola: 2 },
  { codigo: 'M12', x: 770, y: 250, color: '#1F5C5C', ola: 3 },
  { codigo: 'U02', x: 480, y: 480, color: '#1F5C5C', ola: 2 },
  { codigo: 'P01', x: 930, y: 340, color: '#4B5D7A', ola: 1 },
  { codigo: 'M11', x: 610, y: 540, color: '#1F5C5C', ola: 3 },
] as const;

function Trazos({ capa, rutas, color, grosor }: { capa: 'a' | 'b' | 'c'; rutas: readonly string[]; color: string; grosor: number }) {
  return (
    <g
      className={`ag-login-trazos ag-login-trazos--${capa}`}
      fill="none"
      stroke={color}
      strokeWidth={grosor}
      strokeLinecap={capa === 'a' ? 'round' : undefined}
    >
      {rutas.map((d) => (
        <path key={d} pathLength={1} d={d} />
      ))}
    </g>
  );
}

/** Mapa decorativo de la pantalla de acceso: calles que se trazan, un incidente con sus anillos y unidades que caen. */
export function MapaIntro() {
  return (
    <div className="ag-login-anim ag-login-mapa absolute inset-0" aria-hidden="true">
      <svg viewBox="0 0 1366 768" preserveAspectRatio="xMidYMid slice" className="block h-full w-full">
        <Trazos capa="c" rutas={CURVAS} color="#D3BFAB" grosor={1} />
        <Trazos capa="b" rutas={CALLES} color="#BFA994" grosor={1.5} />
        <Trazos capa="a" rutas={AVENIDAS} color="#A8927D" grosor={3.5} />
        {ANILLOS.map((a, i) => (
          <circle
            key={a.r}
            className={`ag-login-anim ag-login-anillo ag-login-anillo--${i + 1}`}
            cx={683}
            cy={384}
            r={a.r}
            fill={a.relleno}
            stroke="#A8261E"
            strokeWidth={a.trazo}
            strokeDasharray="5 5"
          />
        ))}
        <g className="ag-login-anim ag-login-caida ag-login-caida--incidente">
          <rect x={671} y={372} width={24} height={24} rx={5} fill="#A8261E" stroke="#FFF8F1" strokeWidth={2} />
          <rect x={679} y={380} width={8} height={8} fill="#FFF8F1" />
        </g>
        {UNIDADES.map((u) => (
          <g key={u.codigo} className={`ag-login-anim ag-login-caida ag-login-caida--${u.ola}`}>
            <circle cx={u.x} cy={u.y} r={9} fill={u.color} stroke="#FFF8F1" strokeWidth={2} />
            <text x={u.x + 14} y={u.y + 4} fontFamily="JetBrains Mono" fontSize={12} fontWeight={700} fill="#1A1A1A">
              {u.codigo}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
