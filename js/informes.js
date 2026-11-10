/* Bolsillo · informes: periodos, comparativas, tendencias y exportación a Excel */
(function (B) {
  'use strict';
  const esc = B.esc;
  const ico = n => B.icono(n);
  const punto = c => `<span class="punto" style="--c:${c}"></span>`;
  const est = () => {
    if (!B.ui.informe) B.ui.informe = { modo: 'mes', anio: new Date().getFullYear() };
    return B.ui.informe;
  };

  /* ---------- Periodo actual y periodo con el que se compara ---------- */
  B.periodoInforme = () => {
    const s = est(), actual = B.mesActual(), hoyDia = new Date().getDate();
    const rango = (fin, n) => Array.from({ length: n }, (_, i) => B.sumarMes(fin, i - n + 1));
    let meses, ant, etiqueta, etiquetaAnt;
    if (s.modo === 'anio') {
      meses = rango(`${s.anio}-12`, 12).filter(m => m <= actual);
      ant = meses.map(m => B.sumarMes(m, -12));
      etiqueta = String(s.anio);
      etiquetaAnt = String(s.anio - 1);
    } else if (s.modo === '12m') {
      meses = rango(actual, 12);
      ant = meses.map(m => B.sumarMes(m, -12));
      etiqueta = 'Últimos 12 meses';
      etiquetaAnt = 'los 12 meses anteriores';
    } else {
      meses = [B.ui.mes];
      ant = [B.sumarMes(B.ui.mes, -1)];
      etiqueta = B.nombreMes(B.ui.mes);
      etiquetaAnt = B.nombreMes(ant[0]).toLowerCase();
    }
    // Si el periodo llega hasta hoy, se compara con el mismo tramo del periodo anterior
    const corte = meses[meses.length - 1] === actual ? hoyDia : null;
    if (corte && s.modo !== '12m') etiquetaAnt += s.modo === 'mes' ? ` (hasta el día ${corte})` : ' (mismo tramo)';
    return { modo: s.modo, meses, ant, etiqueta, etiquetaAnt, corte };
  };

  B.agregarPeriodo = (meses, corteUltimo) => {
    const set = new Set(meses), ultimo = meses[meses.length - 1];
    const r = { ingresos: 0, gastos: 0, fijos: 0, porCat: {}, porMes: {}, movs: [] };
    meses.forEach(m => { r.porMes[m] = { ingresos: 0, gastos: 0 }; });
    for (const m of B.estado.movimientos) {
      const mes = m.fecha.slice(0, 7);
      if (!set.has(mes)) continue;
      if (corteUltimo && mes === ultimo && Number(m.fecha.slice(8)) > corteUltimo) continue;
      r.movs.push(m);
      if (m.tipo === 'transferencia') continue;
      const v = B.aPrincipal(m.importe, B.monedaMov(m));
      if (m.tipo === 'ingreso') { r.ingresos += v; r.porMes[mes].ingresos += v; }
      else {
        r.gastos += v; r.porMes[mes].gastos += v;
        r.porCat[m.categoriaId] = (r.porCat[m.categoriaId] || 0) + v;
        if (m.recurrenteId) r.fijos += v;
      }
    }
    return r;
  };

  /* ---------- Gráfico de líneas (gasto acumulado) ---------- */
  function paso(max) {
    const bruto = max / 3, mag = Math.pow(10, Math.floor(Math.log10(bruto))), n = bruto / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  }
  B.lineas = ({ series, n, etiquetasX, ajustar = false, tooltip = null }) => {
    const todos = series.flatMap(s => s.valores).filter(v => isFinite(v));
    const maxV = Math.max(...todos, 0), minV = Math.min(...todos, maxV);
    let lo = 0, p, tope;
    if (ajustar && todos.length && maxV > minV) {
      p = paso(Math.max(maxV - minV, maxV * 0.002));
      lo = Math.floor(minV / p) * p;
      tope = Math.ceil(maxV / p) * p;
      if (tope === lo) tope = lo + p;
    } else {
      p = paso(Math.max(1, maxV));
      tope = p * Math.ceil(Math.max(1, maxV) / p);
    }
    const marcas = []; for (let v = lo; v <= tope + p * 1e-6; v += p) marcas.push(v);
    const X = i => (n > 1 ? i / (n - 1) : 0) * 1000, Y = v => 200 - (v - lo) / (tope - lo) * 200;
    const pct = v => ((v - lo) / (tope - lo) * 100).toFixed(2);
    const camino = vals => vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
    const svg = series.map(s => {
      if (!s.valores.length) return '';
      const d = camino(s.valores);
      const area = s.area ? `<path d="${d} L${X(s.valores.length - 1).toFixed(1)} 200 L${X(0).toFixed(1)} 200 Z" style="fill:${s.color}" fill-opacity=".13" stroke="none"/>` : '';
      return `${area}<path d="${d}" fill="none" style="stroke:${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" ${s.discontinua ? 'stroke-dasharray="5 5"' : ''}/>`;
    }).join('');
    const puntos = series.filter(s => s.puntoFinal && s.valores.length).map(s => {
      const i = s.valores.length - 1, v = s.valores[i];
      return `<span class="linea-punto" style="left:${(X(i) / 10).toFixed(2)}%;bottom:${pct(v)}%;--c:${s.color}" title="${esc(s.nombre)}: ${B.dinero(v)}"></span>`;
    }).join('');
    return `<div class="barras grafico-linea" role="img" aria-label="${esc(series.map(s => s.nombre).join(' frente a '))}">
      <div class="barras-eje">${marcas.map(v => `<span style="bottom:${pct(v)}%">${B.compacto(v)}</span>`).join('')}</div>
      <div class="linea-zona"${tooltip ? ` data-tt="${esc(JSON.stringify({ e: tooltip.etiquetas, m: tooltip.moneda || null, s: series.map(s => ({ n: s.nombre, c: s.color, v: s.valores.map(v => +(+v).toFixed(6)) })), lo, hi: tope }))}"` : ''}>
        ${marcas.map(v => `<i class="barras-linea" style="bottom:${pct(v)}%"></i>`).join('')}
        <svg viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>
        ${puntos}
      </div>
      <span></span>
      <div class="linea-x">${etiquetasX.map(e => `<span style="left:${(X(e.i) / 10).toFixed(2)}%">${esc(e.txt)}</span>`).join('')}</div>
    </div>`;
  };

  /* Etiqueta flotante al pasar el ratón o el dedo por un gráfico de líneas */
  function moverTooltip(ev) {
    const zona = ev.target.closest && ev.target.closest('.linea-zona[data-tt]');
    document.querySelectorAll('.linea-tt, .linea-guia').forEach(x => { if (!zona || !zona.contains(x)) x.remove(); });
    if (!zona) return;
    let d = zona._tt;
    if (!d) { try { d = zona._tt = JSON.parse(zona.dataset.tt); } catch (err) { return; } }
    const r = zona.getBoundingClientRect();
    const n = d.e.length;
    if (!n) return;
    const i = Math.max(0, Math.min(n - 1, Math.round((ev.clientX - r.left) / r.width * (n - 1))));
    const x = n > 1 ? i / (n - 1) * 100 : 0;
    let guia = zona.querySelector('.linea-guia');
    if (!guia) { guia = document.createElement('i'); guia.className = 'linea-guia'; zona.appendChild(guia); }
    guia.style.left = x + '%';
    let tt = zona.querySelector('.linea-tt');
    if (!tt) { tt = document.createElement('div'); tt.className = 'linea-tt'; zona.appendChild(tt); }
    tt.innerHTML = `<strong>${esc(d.e[i])}</strong>` + d.s.filter(s => s.v[i] != null).map(s =>
      `<span><i class="punto" style="--c:${s.c}"></i>${esc(s.n)}: <b class="num">${B.dinero(s.v[i], d.m)}</b></span>`).join('');
    tt.style.left = x + '%';
    tt.classList.toggle('a-la-izquierda', x > 60);
  }
  document.addEventListener('pointermove', moverTooltip);
  document.addEventListener('pointerdown', moverTooltip);

  function acumulado(mes, hastaDia) {
    const dias = B.diasDelMes(mes), porDia = Array(dias).fill(0);
    for (const m of B.estado.movimientos) {
      if (m.tipo !== 'gasto' || !m.fecha.startsWith(mes)) continue;
      porDia[Number(m.fecha.slice(8)) - 1] += B.aPrincipal(m.importe, B.monedaMov(m));
    }
    let s = 0;
    const r = porDia.map(v => (s += v));
    return hastaDia ? r.slice(0, hastaDia) : r;
  }

  /* ---------- Piezas ---------- */
  const variacion = (v, a, subirEsBueno) => {
    if (!a && !v) return '';
    if (!a) return '<span class="chip">Nuevo</span>';
    const d = (v - a) / Math.abs(a);
    const p = Math.round(d * 100);
    const clase = Math.abs(d) < 0.05 ? '' : (d > 0) === subirEsBueno ? 'ok' : 'mal';
    return `<span class="chip ${clase}">${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)} %</span>`;
  };
  const vacio = (t, x) => `<div class="vacio"><strong>${t}</strong><p>${x}</p></div>`;

  function selectorPeriodo(p) {
    const s = est();
    const modos = [['mes', 'Mes'], ['anio', 'Año'], ['12m', '12 meses']];
    const botones = `<div class="pildoras" role="group" aria-label="Periodo">${modos.map(([v, t]) =>
      `<button type="button" class="${s.modo === v ? 'activo' : ''}" data-accion="informe-modo" data-modo="${v}" aria-pressed="${s.modo === v}">${t}</button>`).join('')}</div>`;
    let nav = '';
    if (p.modo === 'mes') nav = B.selectorMes();
    else if (p.modo === 'anio') nav = `<div class="selector-mes">
      <button type="button" class="boton-icono" data-accion="anio-anterior" aria-label="Año anterior">${ico('izq')}</button>
      <span>${s.anio}</span>
      <button type="button" class="boton-icono" data-accion="anio-siguiente" aria-label="Año siguiente" ${s.anio >= new Date().getFullYear() ? 'disabled' : ''}>${ico('der')}</button>
    </div>`;
    return botones + nav;
  }

  /* ---------- Pantalla ---------- */
  function informes() {
    const p = B.periodoInforme();
    const act = B.agregarPeriodo(p.meses);
    const ant = B.agregarPeriodo(p.ant, p.corte);
    const acciones = selectorPeriodo(p) + `<button type="button" class="boton" data-accion="exportar-informe" ${act.movs.length ? '' : 'disabled'}>${ico('exportar')}<span>Exportar a Excel</span></button>`;
    const cab = `<header class="vista-cab">
      <div class="vista-tit"><h1>Informes</h1><p class="sub">${esc(p.etiqueta)} comparado con ${esc(p.etiquetaAnt)}</p></div>
      <div class="vista-acciones">${acciones}</div>
    </header>`;
    if (!act.movs.length) return { html: cab + `<div class="tarjeta">${vacio('Sin movimientos en este periodo', 'Elige otro mes o año, o registra movimientos para ver tus informes.')}</div>` };

    const hayAnt = ant.movs.some(m => m.tipo !== 'transferencia');
    const sinAnt = `Sin datos de ${esc(p.etiquetaAnt.replace(/ \(.*\)$/, ''))}`;
    const ahorro = act.ingresos - act.gastos, ahorroAnt = ant.ingresos - ant.gastos;
    const tasa = act.ingresos > 0 ? Math.round(ahorro / act.ingresos * 100) : null;
    const tasaAnt = ant.ingresos > 0 ? Math.round(ahorroAnt / ant.ingresos * 100) : null;

    const kpis = `<section class="kpis">
      <div class="tarjeta kpi"><span class="kpi-etq">Ingresos</span><div class="kpi-valor num pos">${B.dinero(act.ingresos)}</div><div class="kpi-pie">${hayAnt ? `${variacion(act.ingresos, ant.ingresos, true)} antes ${B.dinero(ant.ingresos, null, { sinDecimales: true })}` : sinAnt}</div></div>
      <div class="tarjeta kpi"><span class="kpi-etq">Gastos</span><div class="kpi-valor num">${B.dinero(act.gastos)}</div><div class="kpi-pie">${hayAnt ? `${variacion(act.gastos, ant.gastos, false)} antes ${B.dinero(ant.gastos, null, { sinDecimales: true })}` : sinAnt}</div></div>
      <div class="tarjeta kpi"><span class="kpi-etq">Ahorro</span><div class="kpi-valor num ${ahorro < 0 ? 'rojo' : ''}">${B.dinero(ahorro)}</div><div class="kpi-pie">${hayAnt ? `${variacion(ahorro, ahorroAnt, true)} antes ${B.dinero(ahorroAnt, null, { sinDecimales: true })}` : sinAnt}</div></div>
      <div class="tarjeta kpi destacado"><span class="kpi-etq">Tasa de ahorro</span><div class="kpi-valor num">${tasa === null ? '—' : tasa + ' %'}</div><div class="kpi-pie">${tasaAnt === null ? 'Sin ingresos antes' : `Antes ${tasaAnt} %`}</div></div>
    </section>`;

    // Categorías comparadas
    const ids = new Set([...Object.keys(act.porCat), ...Object.keys(ant.porCat)]);
    const filas = [...ids].map(id => ({ cat: B.categoria(id), v: act.porCat[id] || 0, a: ant.porCat[id] || 0 }))
      .filter(x => x.cat).sort((x, y) => y.v - x.v || y.a - x.a);
    const maxV = Math.max(1, ...filas.map(x => x.v));

    // Lo más destacado
    const frases = [];
    if (tasa !== null) frases.push(`Has ahorrado el <b>${tasa} %</b> de lo que has ingresado${tasaAnt !== null ? ` (antes, el ${tasaAnt} %)` : ''}.`);
    const comparables = filas.filter(x => x.a > 0 || x.v > 0).map(x => ({ ...x, d: x.v - x.a }));
    const sube = [...comparables].sort((x, y) => y.d - x.d)[0];
    const baja = [...comparables].sort((x, y) => x.d - y.d)[0];
    if (!hayAnt) frases.push(`No hay movimientos de ${esc(p.etiquetaAnt.replace(/ \(.*\)$/, ''))} para comparar; las variaciones aparecerán cuando los haya.`);
    if (hayAnt && sube && sube.d > 1) frases.push(`Lo que más ha subido es <b>${esc(sube.cat.nombre)}</b>: ${B.dinero(sube.d)} más que en ${esc(p.etiquetaAnt.replace(/ \(.*\)$/, ''))}.`);
    if (hayAnt && baja && baja.d < -1) frases.push(`Donde más has recortado es <b>${esc(baja.cat.nombre)}</b>: ${B.dinero(-baja.d)} menos.`);
    if (p.modo === 'mes') {
      const dias = p.corte || B.diasDelMes(p.meses[0]);
      frases.push(`De media has gastado <b>${B.dinero(act.gastos / dias)}</b> al día.`);
    } else {
      const mesesConDatos = p.meses.filter(m => act.porMes[m].gastos > 0);
      const caro = [...mesesConDatos].sort((x, y) => act.porMes[y].gastos - act.porMes[x].gastos)[0];
      if (mesesConDatos.length) frases.push(`De media has gastado <b>${B.dinero(act.gastos / mesesConDatos.length)}</b> al mes. El mes más caro fue <b>${B.nombreMes(caro).toLowerCase()}</b> (${B.dinero(act.porMes[caro].gastos, null, { sinDecimales: true })}).`);
    }
    if (act.fijos > 0 && act.gastos > 0) frases.push(`El <b>${Math.round(act.fijos / act.gastos * 100)} %</b> de tus gastos fueron pagos fijos (recurrentes).`);
    const destacados = `<section class="tarjeta s5"><div class="tarjeta-cab"><h2>Lo más destacado</h2></div>
      <ul class="destacados">${frases.map(f => `<li>${f}</li>`).join('')}</ul></section>`;

    // Gráfico principal
    let grafico;
    if (p.modo === 'mes') {
      const mes = p.meses[0], dias = B.diasDelMes(mes), prev = p.ant[0];
      const hasta = mes === B.mesActual() ? new Date().getDate() : null;
      const serieAct = acumulado(mes, hasta), serieAnt = acumulado(prev).slice(0, dias);
      const marcasX = [1, 8, 15, 22, dias].map(d => ({ i: d - 1, txt: String(d) }));
      grafico = `<section class="tarjeta s7">
        <div class="tarjeta-cab"><h2>Gasto acumulado del mes</h2>
          <div class="leyenda-mini"><span>${punto('var(--accent)')}${esc(B.mesCorto(mes))}</span><span>${punto('var(--faint)')}${esc(B.mesCorto(prev))}</span></div></div>
        ${B.lineas({ n: dias, etiquetasX: marcasX, tooltip: { etiquetas: Array.from({ length: dias }, (_, i) => `Día ${i + 1}`) }, series: [
          { nombre: B.nombreMes(prev), valores: serieAnt, color: 'var(--faint)', discontinua: true },
          { nombre: B.nombreMes(mes), valores: serieAct, color: 'var(--accent)', area: true, puntoFinal: true },
        ] })}
        <p class="sub pie-grafico">${hasta && serieAnt[hasta - 1] != null ? (serieAct[hasta - 1] <= serieAnt[hasta - 1]
          ? `Vas <b class="num">${B.dinero(serieAnt[hasta - 1] - serieAct[hasta - 1])}</b> por debajo del mes pasado a estas alturas.`
          : `Vas <b class="num">${B.dinero(serieAct[hasta - 1] - serieAnt[hasta - 1])}</b> por encima del mes pasado a estas alturas.`) : 'Cada línea suma lo gastado día a día.'}</p>
      </section>`;
    } else {
      grafico = `<section class="tarjeta s7">
        <div class="tarjeta-cab"><h2>Ingresos y gastos por mes</h2>
          <div class="leyenda-mini"><span>${punto('var(--ok)')}Ingresos</span><span>${punto('var(--bad)')}Gastos</span></div></div>
        ${B.barras(p.meses.map(m => ({ etiqueta: B.mesCorto(m), ingresos: act.porMes[m].ingresos, gastos: act.porMes[m].gastos, actual: m === B.mesActual() })))}
      </section>`;
    }

    const categorias = `<section class="tarjeta s7">
      <div class="tarjeta-cab"><h2>Gasto por categoría</h2><span class="sub">frente a ${esc(p.etiquetaAnt)}</span></div>
      ${filas.length ? `<div class="cat-filas">${filas.map(x => `
        <${p.modo === 'mes' ? `button type="button" data-accion="ver-categoria" data-id="${x.cat.id}"` : 'div'} class="cat-fila">
          <div class="cat-fila-top">${punto(x.cat.color)}<span class="txt">${esc(x.cat.nombre)}</span><span class="num importe">${B.dinero(x.v, null, { sinDecimales: true })}</span>${hayAnt ? variacion(x.v, x.a, false) : ''}</div>
          <div class="progreso fino"><i style="width:${(x.v / maxV * 100).toFixed(1)}%;--c:${x.cat.color}"></i></div>
          <small class="sub num">${act.gastos ? Math.round(x.v / act.gastos * 100) : 0} % del gasto · antes ${B.dinero(x.a, null, { sinDecimales: true })}</small>
        </${p.modo === 'mes' ? 'button' : 'div'}>`).join('')}</div>` : '<p class="sub">Sin gastos en este periodo.</p>'}
    </section>`;

    // Dónde gastas más (agrupado por concepto)
    const grupos = {};
    act.movs.filter(m => m.tipo === 'gasto' && m.nota).forEach(m => {
      const k = B.norm(m.nota).replace(/[\d*#/]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!k) return;
      const g = grupos[k] || (grupos[k] = { nombre: m.nota, n: 0, total: 0, cat: B.categoria(m.categoriaId) });
      g.n++; g.total += B.aPrincipal(m.importe, B.monedaMov(m));
    });
    const comercios = Object.values(grupos).sort((x, y) => y.total - x.total).slice(0, 8);
    const htmlComercios = `<section class="tarjeta s5">
      <div class="tarjeta-cab"><h2>Dónde gastas más</h2></div>
      ${comercios.length ? `<div class="lista-simple">${comercios.map(g => `<div class="fila-simple">
        ${punto(g.cat?.color || 'var(--faint)')}<span class="txt"><strong>${esc(g.nombre)}</strong><small class="sub">${g.n} ${g.n === 1 ? 'vez' : 'veces'}</small></span><span class="num importe">${B.dinero(g.total)}</span>
      </div>`).join('')}</div>` : '<p class="sub">Sin gastos con concepto en este periodo.</p>'}
    </section>`;

    const top = act.movs.filter(m => m.tipo === 'gasto')
      .sort((x, y) => B.aPrincipal(y.importe, B.monedaMov(y)) - B.aPrincipal(x.importe, B.monedaMov(x))).slice(0, 8);
    const htmlTop = `<section class="tarjeta s12">
      <div class="tarjeta-cab"><h2>Gastos más grandes</h2></div>
      ${top.length ? `<div class="lista dos-columnas">${top.map(m => B.filaMov(m).replace('</small>', ` · ${B.fechaCorta(m.fecha)}</small>`)).join('')}</div>` : '<p class="sub">Sin gastos en este periodo.</p>'}
    </section>`;

    return {
      html: cab + kpis + `<div class="rejilla">${grafico}${destacados}${categorias}${htmlComercios}${htmlTop}</div>`,
    };
  }

  B.vistas.informes = informes;

  /* ---------- Exportar a Excel ---------- */
  B.exportarInforme = () => {
    const p = B.periodoInforme();
    const act = B.agregarPeriodo(p.meses);
    const ant = B.agregarPeriodo(p.ant, p.corte);
    const mon = B.estado.ajustes.moneda;
    const TIPO = { gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia' };
    const movs = [...act.movs].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const aFecha = f => { const [y, m, d] = f.split('-').map(Number); return new Date(y, m - 1, d); };
    const firmado = m => m.tipo === 'gasto' ? -m.importe : m.importe;

    const cabMov = ['Fecha', 'Tipo', 'Concepto', 'Categoría', 'Cuenta', 'Cuenta destino', 'Importe', 'Moneda', `Importe en ${mon}`];
    const filasMov = movs.map(m => {
      const cta = B.cuenta(m.cuentaId);
      return [aFecha(m.fecha), TIPO[m.tipo], m.nota || '', m.tipo === 'transferencia' ? '' : (B.categoria(m.categoriaId)?.nombre || ''), cta?.nombre || '',
        m.tipo === 'transferencia' ? (B.cuenta(m.cuentaDestinoId)?.nombre || '') : '', B.redondear(firmado(m)), cta?.moneda || mon,
        m.tipo === 'transferencia' ? 0 : B.redondear(B.aPrincipal(firmado(m), cta?.moneda || mon))];
    });
    const ids = new Set([...Object.keys(act.porCat), ...Object.keys(ant.porCat)]);
    const cabCat = ['Categoría', `Gasto (${mon})`, `Antes (${mon})`, 'Diferencia', '% del gasto'];
    const filasCat = [...ids].map(id => [B.categoria(id)?.nombre || id, B.redondear(act.porCat[id] || 0), B.redondear(ant.porCat[id] || 0),
      B.redondear((act.porCat[id] || 0) - (ant.porCat[id] || 0)), act.gastos ? B.redondear((act.porCat[id] || 0) / act.gastos * 100) : 0])
      .sort((a, b) => b[1] - a[1]);
    const cabMes = ['Mes', `Ingresos (${mon})`, `Gastos (${mon})`, `Ahorro (${mon})`, 'Tasa de ahorro %'];
    const filasMes = p.meses.map(m => {
      const x = act.porMes[m];
      return [B.nombreMes(m), B.redondear(x.ingresos), B.redondear(x.gastos), B.redondear(x.ingresos - x.gastos), x.ingresos ? B.redondear((x.ingresos - x.gastos) / x.ingresos * 100) : 0];
    });

    const nombre = `bolsillo-informe-${p.modo === 'mes' ? p.meses[0] : p.modo === 'anio' ? est().anio : 'ultimos-12-meses'}.xlsx`;
    // Texto tabulado para pegar directamente en Excel o Google Sheets
    const celda = v => v instanceof Date ? v.toLocaleDateString('es-ES') : typeof v === 'number' ? String(v).replace('.', ',') : String(v).replace(/[\t\n]/g, ' ');
    const tsv = [cabMov, ...filasMov].map(f => f.map(celda).join('\t')).join('\n');

    B.abrirModal({
      titulo: 'Exportar a Excel', clase: 'estrecho',
      cuerpo: `<div class="formulario">
        <p class="sub"><b>${esc(p.etiqueta)}</b> · ${movs.length} movimientos.</p>
        <p class="sub">El archivo de Excel trae tres hojas: <b>Movimientos</b>, <b>Categorías</b> (comparadas con ${esc(p.etiquetaAnt)}) y <b>Meses</b>.</p>
        <p class="ayuda">Si la descarga no empieza (pasa dentro de algunas apps), usa «Copiar movimientos» y pégalos en una hoja de Excel o de Google.</p>
        <p class="error" id="ei-error" hidden></p>
      </div>`,
      pie: `<button type="button" class="boton" id="ei-copiar">Copiar movimientos</button><button type="button" class="boton primario" id="ei-bajar">${ico('exportar')}<span>Descargar .xlsx</span></button>`,
      alMontar(md) {
        md.querySelector('#ei-copiar').addEventListener('click', () => B.copiar(tsv));
        md.querySelector('#ei-bajar').addEventListener('click', async ev => {
          const btn = ev.currentTarget;
          btn.disabled = true;
          try {
            const XLSX = await B.cargarLectorExcel();
            const hoja = (filas, anchos) => {
              const h = XLSX.utils.aoa_to_sheet(filas, { cellDates: true, dateNF: 'dd/mm/yyyy' });
              h['!cols'] = anchos.map(w => ({ wch: w }));
              for (const k of Object.keys(h)) {
                if (k[0] === '!') continue;
                if (h[k].t === 'n') h[k].z = '#,##0.00';
                if (h[k].t === 'd') h[k].z = 'dd/mm/yyyy';
              }
              return h;
            };
            const libro = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(libro, hoja([cabMov, ...filasMov], [11, 13, 34, 22, 20, 20, 12, 8, 14]), 'Movimientos');
            XLSX.utils.book_append_sheet(libro, hoja([cabCat, ...filasCat], [24, 14, 14, 12, 12]), 'Categorías');
            XLSX.utils.book_append_sheet(libro, hoja([cabMes, ...filasMes], [18, 14, 14, 14, 16]), 'Meses');
            XLSX.writeFile(libro, nombre);
            B.aviso(`Descargando ${nombre}`);
          } catch (err) {
            const e = md.querySelector('#ei-error'); e.textContent = err.message || 'No se pudo crear el archivo. Usa «Copiar movimientos».'; e.hidden = false;
          }
          btn.disabled = false;
        });
      },
    });
  };
})(window.B);
