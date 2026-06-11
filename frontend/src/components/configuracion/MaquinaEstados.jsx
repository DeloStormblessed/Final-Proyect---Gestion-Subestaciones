// Referencia visual de la máquina de estados V2 (solo lectura).
// Los datos están verificados contra backend/lib/transiciones.js, la fuente de verdad:
// si algo no coincide con el código, es un bug de este panel, no del backend.

// ── Paleta local provisional ──────────────────────────────────────────────────
// Este mapa no toca EstadoBadge ni TipoBadge: son componentes compartidos que usan
// las variables CSS globales (--color-primario, --color-rojo, etc.). Cambiarlos aquí
// se propagaría a Activos y OrdenesTrabajo. Cuando se unifique la paleta global estos
// valores se promoverán a tokens compartidos y los componentes globales los consumirán.
//
// Tres familias semánticas sin solapes de color:
// · Semáforo (verde/naranja/rojo) → salud operativa (disponibilidad). Reservado solo a
//   este eje: ningún tipo de OT usa estos colores para no confundir "qué trabajo se hizo"
//   con "cómo quedó el equipo".
// · Neutros (gris azulado) → ciclo de vida. INSTALACION comparte tono con OPERATIVO porque
//   es la OT que da de alta el activo (el activo nace OPERATIVO); la OT se pinta del color
//   del estado que produce. BAJA comparte tono con DADO_DE_BAJA por el mismo parentesco.
// · Espectro frío (cian/azul/violeta) → tipos de mantenimiento puro (sin rol en el ciclo
//   de vida). Se distinguen del semáforo para que el tipo de trabajo no se confunda con
//   el estado resultante.
const PALETA = {
  // Semáforo — disponibilidad / salud operativa
  EN_SERVICIO:       { bg: '#DCFCE7', texto: '#15803D' },
  AVERIADO:          { bg: '#FFEDD5', texto: '#C2410C' },
  FUERA_DE_SERVICIO: { bg: '#FEE2E2', texto: '#B91C1C' },
  DADO_DE_BAJA:      { bg: '#F1F5F9', texto: '#475569' },

  // Neutros — ciclo de vida y las OTs que lo mueven
  OPERATIVO:         { bg: '#E2E8F0', texto: '#1E293B' },
  INSTALACION:       { bg: '#E2E8F0', texto: '#334155' }, // misma familia que OPERATIVO
  BAJA:              { bg: '#F1F5F9', texto: '#64748B' }, // misma familia que DADO_DE_BAJA

  // Espectro frío — tipos de mantenimiento
  INSPECCION:        { bg: '#CFFAFE', texto: '#0E7490' },
  PREVENTIVO:        { bg: '#DBEAFE', texto: '#1D4ED8' },
  CORRECTIVO:        { bg: '#EDE9FE', texto: '#6D28D9' },
};

const ETIQUETAS_PANEL = {
  EN_SERVICIO:       'En servicio',
  AVERIADO:          'Averiado',
  FUERA_DE_SERVICIO: 'Fuera de servicio',
  DADO_DE_BAJA:      'Dado de baja',
  OPERATIVO:         'Operativo',
  INSTALACION:       'Instalación',
  BAJA:              'Baja',
  INSPECCION:        'Inspección',
  PREVENTIVO:        'Preventivo',
  CORRECTIVO:        'Correctivo',
};

export default function MaquinaEstados() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Sección A: Los dos ejes ── */}
      <Tarjeta titulo="Los dos ejes del estado">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <EjeCard
            nombre="ciclo de Vida"
            nota="El ciclo de vida solo avanza en un sentido. Cuando un activo se da de baja, queda retirado de forma definitiva: no se reactiva ni admite nuevas intervenciones."
          >
            <BadgePanel chave="OPERATIVO" />
            <BadgePanel chave="DADO_DE_BAJA" />
          </EjeCard>
          <EjeCard
            nombre="estado"
            nota="Refleja si el equipo opera con normalidad, está averiado o se ha retirado temporalmente del servicio. Solo es relevante mientras el activo sigue operativo; tras la baja queda congelada en su último valor."
          >
            <BadgePanel chave="EN_SERVICIO" />
            <BadgePanel chave="AVERIADO" />
            <BadgePanel chave="FUERA_DE_SERVICIO" />
          </EjeCard>
        </div>
      </Tarjeta>

      {/* ── Sección B: Tabla OT → eje afectado ── */}
      <Tarjeta titulo="Qué hace cada orden de trabajo">
        <div style={{ overflowX: 'auto' }}>
          <table style={estiloTabla}>
            <thead>
              <tr style={{ background: '#F6F6F6' }}>
                {['Tipo OT', 'ciclo de Vida', 'estado', 'Para qué sirve'].map(h => (
                  <th key={h} style={estiloCabecera}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FILAS_OT.map((fila, i) => (
                <tr key={fila.tipo} style={{ background: i % 2 === 0 ? '#fff' : '#F9F9F9' }}>
                  <td style={estilocelda}>
                    <BadgePanel chave={fila.tipo} />
                  </td>
                  <td style={estilocelda}><CeldaEje cell={fila.cicloVida} /></td>
                  <td style={estilocelda}><CeldaEje cell={fila.disponibilidad} /></td>
                  <td style={{ ...estilocelda, color: '#666', fontSize: '0.82rem' }}>
                    {fila.proposito}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Reglas transversales que aplican a varias filas: se enuncian una vez aquí
            en lugar de repetirlas en cada celda. La de inspección vencida (Regla B)
            vive en el service, no en transiciones.js, pero es una puerta real sobre el preventivo. */}
        <p style={estiloNotaPie}>
          Un activo dado de baja no admite ninguna orden de trabajo. El preventivo, además,
          se bloquea si el equipo está averiado o tiene la inspección vencida: primero hay
          que repararlo con un correctivo o cerrar una inspección conforme.
        </p>
      </Tarjeta>

      {/* ── Sección C: Modificadores declarados ── */}
      <Tarjeta titulo="El resultado que se anota en la orden">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

          <div style={estiloModificador}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-violeta)', marginBottom: '0.5rem' }}>
              Resultado de Inspección
            </div>
            <div style={{ fontSize: '0.82rem', color: '#666', marginBottom: '0.75rem' }}>
              Se anota en las inspecciones. Indica si el equipo cumple o no.
            </div>
            <TablaModificador variante="inspeccion" filas={[
              { valor: 'CONFORME',    resultado: 'EN_SERVICIO' },
              { valor: 'NO CONFORME', resultado: 'AVERIADO'    },
            ]} />
            <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#aaa' }}>
              Si el equipo ya estaba averiado o fuera de servicio, la inspección deja constancia pero no cambia su estado.
            </div>
          </div>

          <div style={estiloModificador}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-primario)', marginBottom: '0.5rem' }}>
              Resultado de Intervención
            </div>
            <div style={{ fontSize: '0.82rem', color: '#666', marginBottom: '0.75rem' }}>
              Se anota en preventivos y correctivos. Indica en qué condición queda el equipo.
            </div>
            <TablaModificador variante="intervencion" filas={[
              { valor: 'OPERATIVO',   resultado: 'EN_SERVICIO'       },
              { valor: 'DEFECTUOSO',  resultado: 'AVERIADO'          },
              { valor: 'EN DESCARGO', resultado: 'FUERA_DE_SERVICIO' },
            ]} />
            <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#aaa' }}>
              El tipo de orden registra qué trabajo se hizo; este valor declara en qué condición quedó el equipo al terminarlo.
            </div>
          </div>
        </div>
      </Tarjeta>

    </div>
  );
}

// ── Sub-componentes ──

function Tarjeta({ titulo, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', overflow: 'hidden' }}>
      <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #eee', fontWeight: 700, fontSize: '0.88rem', color: '#1A1A1A' }}>
        {titulo}
      </div>
      <div style={{ padding: '1.25rem' }}>
        {children}
      </div>
    </div>
  );
}

function EjeCard({ nombre, nota, children }) {
  return (
    <div style={{ background: '#F6F6F6', borderRadius: 8, padding: '1rem' }}>
      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
        {nombre}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {children}
      </div>
      <p style={{ fontSize: '0.78rem', color: '#888', margin: 0, lineHeight: 1.5 }}>{nota}</p>
    </div>
  );
}

// Renderiza una celda de eje: o bien la raya (eje no afectado), o las badges del resultado.
function CeldaEje({ cell }) {
  if (cell.texto) {
    return <span style={{ color: '#bbb', fontSize: '1.1rem', fontWeight: 700 }}>—</span>;
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
      {cell.badges.map(chave => <BadgePanel key={chave} chave={chave} />)}
    </div>
  );
}

// Badge local del panel — tira del mapa PALETA. No usar fuera de MaquinaEstados:
// cuando la paleta global se unifique, BadgePanel se promoverá a tokens compartidos.
function BadgePanel({ chave, label }) {
  const { bg, texto } = PALETA[chave] ?? { bg: '#eee', texto: '#444' };
  return (
    <span style={{
      display: 'inline-block',
      background: bg,
      color: texto,
      padding: '0.25rem 0.5rem',
      borderRadius: '6px',
      fontSize: '0.75rem',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {label ?? ETIQUETAS_PANEL[chave] ?? chave}
    </span>
  );
}

function TablaModificador({ filas, variante = 'texto' }) {
  // ResultadoIntervencion se pinta del color del estado que produce, no de su propio nombre:
  // OPERATIVO→EN_SERVICIO (verde), DEFECTUOSO→AVERIADO (naranja), EN DESCARGO→FUERA_DE_SERVICIO (rojo).
  const mapIntervencion = {
    'OPERATIVO':    { chave: 'EN_SERVICIO',      label: 'Operativo'   },
    'DEFECTUOSO':   { chave: 'AVERIADO',          label: 'Defectuoso'  },
    'EN DESCARGO':  { chave: 'FUERA_DE_SERVICIO', label: 'En descargo' },
  };

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', tableLayout: 'fixed' }}>
      <thead>
        <tr>
          <th style={estiloThMod}>Valor</th>
          <th style={estiloThMod}>Disponibilidad resultante</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila, i) => (
          <tr key={fila.valor} style={{ background: i % 2 === 0 ? '#fff' : '#F9F9F9' }}>
            <td style={estiloTdMod}>
              {variante === 'inspeccion' && (
                <span style={{
                  color: fila.valor === 'NO CONFORME' ? PALETA.AVERIADO.texto : PALETA.EN_SERVICIO.texto,
                  fontWeight: 600,
                  fontSize: '0.88rem',
                }}>
                  {fila.valor}
                </span>
              )}
              {variante === 'intervencion' && mapIntervencion[fila.valor] && (
                <BadgePanel
                  chave={mapIntervencion[fila.valor].chave}
                  label={mapIntervencion[fila.valor].label}
                />
              )}
              {variante === 'texto' && (
                <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#555' }}>
                  {fila.valor}
                </span>
              )}
            </td>
            <td style={estiloTdMod}>
              <BadgePanel chave={fila.resultado} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Datos verificados contra transiciones.js ──
// cicloVida/disponibilidad describen el EFECTO de la OT sobre cada eje:
// badges = estados que puede dejar; texto = el eje no se toca o se congela.

const FILAS_OT = [
  {
    tipo: 'INSTALACION',
    cicloVida: { badges: ['OPERATIVO'] },
    disponibilidad: { badges: ['EN_SERVICIO'] },
    proposito: 'Da de alta un activo nuevo en el sistema.',
  },
  {
    tipo: 'BAJA',
    cicloVida: { badges: ['DADO_DE_BAJA'] },
    disponibilidad: { texto: 'Se congela' },
    proposito: 'Retira el activo de forma definitiva.',
  },
  {
    tipo: 'INSPECCION',
    cicloVida: { texto: 'Sin cambio' },
    // Resultado posible según ResultadoInspeccion: conforme deja el equipo en servicio,
    // no conforme lo marca averiado. Sobre un equipo ya averiado/fuera de servicio, no-op.
    disponibilidad: { badges: ['EN_SERVICIO', 'AVERIADO'] },
    proposito: 'Revisión periódica para verificar el estado del equipo.',
  },
  {
    tipo: 'PREVENTIVO',
    cicloVida: { texto: 'Sin cambio' },
    disponibilidad: { badges: ['EN_SERVICIO', 'AVERIADO', 'FUERA_DE_SERVICIO'] },
    proposito: 'Mantenimiento programado para anticiparse a los fallos.',
  },
  {
    tipo: 'CORRECTIVO',
    cicloVida: { texto: 'Sin cambio' },
    disponibilidad: { badges: ['EN_SERVICIO', 'AVERIADO', 'FUERA_DE_SERVICIO'] },
    proposito: 'Reparación de un equipo averiado o defectuoso.',
  },
];

// Mismo patrón que Activos.jsx y OrdenesTrabajo.jsx
const estiloTabla = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' };
const estiloCabecera = {
  textAlign: 'left', padding: '0.5rem 0.75rem',
  fontWeight: 700, color: '#1A1A1A', fontSize: '0.72rem',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  background: '#F5F5F5', borderBottom: '1px solid #E8E8E8',
};
const estilocelda = { padding: '0.875rem 0.75rem', verticalAlign: 'middle', color: '#1A1A1A' };
const estiloNotaPie = { marginTop: '1rem', marginBottom: 0, fontSize: '0.78rem', color: '#888', lineHeight: 1.5 };
const estiloModificador = { background: '#F6F6F6', borderRadius: 8, padding: '1rem' };
const estiloThMod = {
  textAlign: 'left', padding: '0.5rem 0.75rem',
  fontWeight: 700, color: '#1A1A1A', fontSize: '0.72rem',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  background: '#ebebeb', borderBottom: '1px solid #E8E8E8',
};
const estiloTdMod = { padding: '0.6rem 0.75rem', verticalAlign: 'middle', textAlign: 'left' };
