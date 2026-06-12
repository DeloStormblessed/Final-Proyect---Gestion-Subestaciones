// Referencia visual de la máquina de estados V2 (solo lectura).
// Los datos están verificados contra backend/lib/transiciones.js, la fuente de verdad:
// si algo no coincide con el código, es un bug de este panel, no del backend.
import TipoBadge from '../TipoBadge.jsx';
import EstadoBadge from '../EstadoBadge.jsx';

export default function MaquinaEstados() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Sección A: Los dos ejes ── */}
      <Tarjeta titulo="Los dos ejes del estado">
        <div className="grid-dos-columnas">
          <EjeCard
            nombre="ciclo de Vida"
            nota="El ciclo de vida solo avanza en un sentido. Cuando un activo se da de baja, queda retirado de forma definitiva: no se reactiva ni admite nuevas intervenciones."
          >
            {/* OPERATIVO no vive en EstadoBadge (es cicloVida, no disponibilidad) */}
            <BadgeSolido label="Operativo" bg="#0E7490" texto="#fff" />
            <EstadoBadge estado="DADO_DE_BAJA" />
          </EjeCard>
          <EjeCard
            nombre="estado"
            nota="Refleja si el equipo opera con normalidad, está averiado o se ha retirado temporalmente del servicio. Solo es relevante mientras el activo sigue operativo; tras la baja queda congelada en su último valor."
          >
            <EstadoBadge estado="EN_SERVICIO" />
            <EstadoBadge estado="AVERIADO" />
            <EstadoBadge estado="FUERA_DE_SERVICIO" />
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
                    <TipoBadge tipo={fila.tipo} />
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
        <div className="grid-dos-columnas">

          <div style={estiloModificador}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
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
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
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
// OPERATIVO es cicloVida, no disponibilidad, por eso no está en EstadoBadge.
function CeldaEje({ cell }) {
  if (cell.texto) {
    return <span style={{ color: '#bbb', fontSize: '1.1rem', fontWeight: 700 }}>—</span>;
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
      {cell.badges.map(estado =>
        estado === 'OPERATIVO'
          ? <BadgeSolido key={estado} label="Operativo" bg="#0E7490" texto="#fff" />
          : <EstadoBadge key={estado} estado={estado} />
      )}
    </div>
  );
}

// Badge mínimo para valores sin componente compartido: OPERATIVO (cicloVida) y
// los ResultadoIntervencion, que llevan etiqueta propia pero el color del estado que producen.
function BadgeSolido({ label, bg, texto }) {
  return (
    <span style={{
      display: 'inline-block',
      minWidth: '8.5rem',
      textAlign: 'center',
      background: bg,
      color: texto,
      padding: '0.25rem 0.5rem',
      borderRadius: '6px',
      fontSize: '0.75rem',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function TablaModificador({ filas, variante = 'texto' }) {
  // ResultadoIntervencion: etiqueta propia pero color del estado que produce,
  // para que coincida visualmente con la columna "Disponibilidad resultante".
  const mapIntervencion = {
    'OPERATIVO':   { bg: '#16A34A', texto: '#fff', label: 'Operativo'   },
    'DEFECTUOSO':  { bg: '#EF4444', texto: '#fff', label: 'Defectuoso'  },
    'EN DESCARGO': { bg: '#D97706', texto: '#fff', label: 'En descargo' },
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
                  color: fila.valor === 'NO CONFORME' ? '#EF4444' : '#16A34A',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                }}>
                  {fila.valor}
                </span>
              )}
              {variante === 'intervencion' && mapIntervencion[fila.valor] && (
                <BadgeSolido
                  bg={mapIntervencion[fila.valor].bg}
                  texto={mapIntervencion[fila.valor].texto}
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
              <EstadoBadge estado={fila.resultado} />
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
