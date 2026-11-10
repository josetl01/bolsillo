/* Bolsillo · gráficos sin librerías (SVG y HTML) */
(function (B) {
  'use strict';

  /* Donut de reparto: segs = [{ valor, color, etiqueta }] */
  B.donut = (segs, centro, etiqueta = 'Reparto') => {
    const total = segs.reduce((a, s) => a + s.valor, 0);
    const R = 52, C = 2 * Math.PI * R;
    let off = 0;
    const arcos = total > 0 ? segs.map(s => {
      const largo = s.valor / total * C;
      const hueco = segs.length > 1 ? Math.min(2.2, largo * 0.35) : 0;
      const arco = `<circle r="${R}" cx="64" cy="64" fill="none" stroke-width="14" style="stroke:${s.color}"
        stroke-dasharray="${Math.max(largo - hueco, 0.01).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"><title>${B.esc(s.etiqueta)}</title></circle>`;
      off += largo;
      return arco;
    }).join('') : '';
    return `<div class="donut">
      <svg viewBox="0 0 128 128" role="img" aria-label="${B.esc(etiqueta)}">
        <circle r="${R}" cx="64" cy="64" fill="none" stroke-width="14" style="stroke:var(--surface-2)"/>
        <g transform="rotate(-90 64 64)">${arcos}</g>
      </svg>
      <div class="donut-centro">${centro}</div>
    </div>`;
  };

  /* Anillo de progreso pequeño */
  B.anillo = (pct, color) => {
    const R = 26, C = 2 * Math.PI * R, p = Math.max(0, Math.min(1, pct));
    return `<svg class="anillo" viewBox="0 0 64 64" aria-hidden="true">
      <circle r="${R}" cx="32" cy="32" fill="none" stroke-width="7" style="stroke:var(--surface-2)"/>
      <circle r="${R}" cx="32" cy="32" fill="none" stroke-width="7" stroke-linecap="round" style="stroke:${color}"
        stroke-dasharray="${(p * C).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 32 32)"/>
    </svg>`;
  };

  /* Escala con números redondos */
  function paso(max) {
    const bruto = max / 3;
    const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const n = bruto / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  }

  /* Barras emparejadas ingresos/gastos: datos = [{ etiqueta, ingresos, gastos, actual }] */
  B.barras = datos => {
    const max = Math.max(1, ...datos.flatMap(d => [d.ingresos, d.gastos]));
    const p = paso(max);
    const tope = p * Math.ceil(max / p);
    const marcas = [];
    for (let v = 0; v <= tope + 1e-9; v += p) marcas.push(v);
    const pct = v => (v / tope * 100).toFixed(2);
    return `<div class="barras" role="img" aria-label="Ingresos y gastos de los últimos ${datos.length} meses">
      <div class="barras-eje">${marcas.map(v => `<span style="bottom:${pct(v)}%">${B.compacto(v)}</span>`).join('')}</div>
      <div class="barras-zona">
        ${marcas.map(v => `<i class="barras-linea" style="bottom:${pct(v)}%"></i>`).join('')}
        ${datos.map(d => `<div class="barras-col${d.actual ? ' actual' : ''}">
          <div class="barras-par">
            <span class="barra ing" style="height:${pct(d.ingresos)}%" title="Ingresos ${B.esc(d.etiqueta)}: ${B.dinero(d.ingresos)}"></span>
            <span class="barra gas" style="height:${pct(d.gastos)}%" title="Gastos ${B.esc(d.etiqueta)}: ${B.dinero(d.gastos)}"></span>
          </div>
        </div>`).join('')}
      </div>
      <span></span>
      <div class="barras-meses">${datos.map(d => `<span class="${d.actual ? 'actual' : ''}">${B.esc(d.etiqueta)}</span>`).join('')}</div>
    </div>`;
  };
})(window.B);
