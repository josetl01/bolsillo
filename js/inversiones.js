/* Bolsillo · pantalla de inversiones, ficha de activo y formularios */
(function (B) {
  'use strict';
  const esc = B.esc;
  const ico = n => B.icono(n);
  const punto = c => `<span class="punto" style="--c:${c}"></span>`;
  const SIMBOLO = { EUR: '€', USD: '$', GBP: '£', GBX: 'p', CHF: 'CHF' };
  const COLORES = ['#f2a33a', '#8a9bff', '#3ecf8e', '#4fb0dd', '#e57fa8', '#b48af0', '#e6c050', '#4fd1c1', '#d9785f', '#9ccc5a'];
  const mon = () => B.estado.ajustes.moneda;

  /* Formato de cantidades y precios con los decimales que pide cada activo */
  B.cantidad = n => {
    const a = Math.abs(n);
    const dec = a === 0 ? 0 : a >= 100 ? 2 : a >= 1 ? 4 : 6;
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: dec }).format(n);
  };
  B.precioFmt = (v, moneda) => {
    if (moneda === 'GBX') return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(v)} p`;
    const a = Math.abs(v);
    const dec = a >= 1000 ? 0 : a >= 1 ? 2 : a >= 0.01 ? 4 : 8;
    try { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: moneda, currencyDisplay: 'narrowSymbol', minimumFractionDigits: Math.min(dec, 2), maximumFractionDigits: dec }).format(v); }
    catch (e) { return `${v.toFixed(2)} ${moneda}`; }
  };
  const pctFmt = (x, dec = 2) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${new Intl.NumberFormat('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(Math.abs(x))} %`;
  const firmado = (v, m) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${B.dinero(Math.abs(v), m)}`;
  const claseSigno = v => v > 0.004 ? 'pos' : v < -0.004 ? 'rojo' : '';
  const chipCambio = (pct, dec = 2) => `<span class="chip ${pct > 0.005 ? 'ok' : pct < -0.005 ? 'mal' : ''}">${pctFmt(pct, dec)}</span>`;

  const hace = ms => {
    const s = Math.round(ms / 1000);
    if (s < 45) return 'hace unos segundos';
    const m = Math.round(s / 60); if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
    return `hace ${Math.round(h / 24)} días`;
  };
  B.hace = hace;

  B.pildoraPrecios = () => {
    const P = B.precios;
    if (P.cargando) return '<span class="vivo cargando"><i></i>Actualizando precios…</span>';
    if (P.estado === 'ok') return `<span class="vivo ok"${P.avisos.length ? ` title="${esc(P.avisos.join(' · '))}"` : ''}><i></i>En vivo · <span data-desde="${P.ultima}">${hace(Date.now() - P.ultima)}</span>${P.avisos.length ? ' · <span class="aviso-texto">algunos precios no se actualizaron</span>' : ''}</span>`;
    if (P.estado === 'bloqueado') return '<span class="vivo bloqueado"><i></i>Sin conexión con los mercados</span>';
    if (P.estado === 'error') return `<span class="vivo error" title="${esc(P.avisos.join(' · '))}"><i></i>Algunos precios no se pudieron actualizar</span>`;
    return '';
  };
  setInterval(() => document.querySelectorAll('[data-desde]').forEach(el => { el.textContent = hace(Date.now() - Number(el.dataset.desde)); }), 15000);

  const fechaPrecio = a => {
    if (!a.precioFecha) return a.fuente === 'manual' || a.referencia ? 'Precio introducido a mano' : 'Precio de ejemplo, aún sin actualizar';
    const d = new Date(a.precioFecha);
    if (a.fuente === 'manual' && !a.referencia) return `Precio puesto a mano · ${hace(Date.now() - d)}`;
    return `Precio ${Date.now() - d < 5 * 60e3 ? 'en vivo' : 'guardado'} · ${hace(Date.now() - d)}`;
  };

  B.icoActivo = a => `<span class="mov-ico activo-ico" style="--c:${a.color}">${esc((a.simbolo || a.nombre).replace(/[^\p{L}\p{N}]/gu, '').slice(0, 3).toUpperCase() || '?')}</span>`;

  B.sparkline = (valores, color) => {
    const v = valores.filter(x => x > 0);
    if (v.length < 3) return '<span class="spark vacia"></span>';
    const min = Math.min(...v), max = Math.max(...v), r = max - min || 1;
    const pts = v.map((x, i) => `${(i / (v.length - 1) * 100).toFixed(2)},${(30 - (x - min) / r * 28 - 1).toFixed(2)}`).join(' ');
    const sube = v[v.length - 1] >= v[0];
    return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" style="stroke:${sube ? 'var(--ok)' : 'var(--bad)'}" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
  };
  const ultimos = (id, dias) => {
    const desde = B.sumarDias(B.hoyISO(), -dias);
    return Object.entries(B.estado.historial[id] || {}).filter(([f]) => f >= desde).sort((x, y) => x[0].localeCompare(y[0])).map(([, v]) => v);
  };

  /* ---------- Pantalla principal ---------- */
  const rangos = { '1M': 30, '3M': 91, '1A': 365, 'Todo': 3650 };

  function graficoCartera() {
    const rango = B.ui.rangoCartera || '3M';
    const serie = B.serieCartera(rangos[rango]);
    const pildoras = `<div class="pildoras pequenas" role="group" aria-label="Periodo">${Object.keys(rangos).map(k =>
      `<button type="button" class="${k === rango ? 'activo' : ''}" data-accion="rango-cartera" data-rango="${k}">${k}</button>`).join('')}</div>`;
    if (serie.length < 2) return `<div class="tarjeta-cab"><h2>Evolución de la cartera</h2>${pildoras}</div><p class="sub">Aún no hay historia suficiente para dibujar la evolución.</p>`;
    const ini = serie[0], fin = serie[serie.length - 1];
    const ganado = (fin.valor - ini.valor) - (fin.aportado - ini.aportado);
    const etiquetas = serie.map(s => B.fechaCorta(s.fecha));
    const marcasX = [0, Math.floor((serie.length - 1) / 2), serie.length - 1].map(i => ({ i, txt: B.fechaCorta(serie[i].fecha) }));
    return `<div class="tarjeta-cab"><h2>Evolución de la cartera</h2>${pildoras}</div>
      <div class="leyenda-mini"><span>${punto('var(--accent)')}Valor</span><span>${punto('var(--faint)')}Dinero aportado</span></div>
      ${B.lineas({ n: serie.length, etiquetasX: marcasX, ajustar: true, tooltip: { etiquetas },
        series: [
          { nombre: 'Aportado', valores: serie.map(s => s.aportado), color: 'var(--faint)', discontinua: true },
          { nombre: 'Valor', valores: serie.map(s => s.valor), color: 'var(--accent)', area: true, puntoFinal: true },
        ] })}
      <p class="sub pie-grafico">${rango === 'Todo' ? 'Desde tu primera compra' : `En ${rango === '1M' ? 'el último mes' : rango === '3M' ? 'los últimos 3 meses' : 'el último año'}`}, sin contar lo que has aportado, has ${ganado >= 0 ? 'ganado' : 'perdido'} <b class="num ${claseSigno(ganado)}">${B.dinero(Math.abs(ganado))}</b>.</p>`;
  }

  function filaPosicion(f, total) {
    const { a, p } = f;
    const peso = total > 0 ? f.valor / total : 0;
    const sub = p.cant > 0 ? `${B.cantidad(p.cant)} ${esc(a.simbolo || '')} · medio ${B.precioFmt(p.precioMedio, a.monedaPrecio)}` : 'En seguimiento';
    return `<button type="button" class="posicion" data-accion="ver-activo" data-id="${a.id}">
      ${B.icoActivo(a)}
      <span class="pos-nombre"><strong>${esc(a.nombre)}</strong><small>${sub}</small></span>
      <span class="pos-spark">${B.sparkline(ultimos(a.id, 30), a.color)}</span>
      <span class="pos-precio"><b class="num">${B.precioFmt(B.precioActual(a), a.monedaPrecio)}</b>${a.precioFecha ? chipCambio(a.cambio24h || 0) : '<small class="sub">sin actualizar</small>'}</span>
      <span class="pos-valor">${p.cant > 0 ? `<b class="num">${B.dinero(f.valor)}</b><small class="num ${claseSigno(p.ganancia)}">${firmado(B.convertir(p.ganancia, a.monedaPrecio, mon()))} (${pctFmt(p.gananciaPct * 100, 1)})</small>` : '<small class="sub">—</small>'}</span>
      ${p.cant > 0 ? `<span class="pos-peso" title="Peso en la cartera"><i style="width:${(peso * 100).toFixed(1)}%;--c:${a.color}"></i></span>` : ''}
    </button>`;
  }

  function inversiones() {
    const e = B.estado, P = B.precios;
    const acciones = `<button type="button" class="boton" data-accion="actualizar-precios" ${P.cargando ? 'disabled' : ''}>${ico('recurrentes')}<span>Actualizar</span></button>
      <button type="button" class="boton primario" data-accion="nuevo-activo">${ico('mas')}<span>Añadir inversión</span></button>`;
    const cab = `<header class="vista-cab">
      <div class="vista-tit"><h1>Inversiones</h1><p class="sub estado-precios">${B.pildoraPrecios() || 'Criptomonedas, acciones, ETF y fondos'}</p></div>
      <div class="vista-acciones">${acciones}</div>
    </header>`;
    if (!e.activos.length) {
      return { html: cab + `<div class="tarjeta"><div class="vacio">
        <strong>Empieza tu cartera</strong>
        <p>Añade tu Bitcoin, tus acciones, un ETF o un fondo indexado. Verás su precio en vivo, cuánto ganas o pierdes y cómo evoluciona todo junto.</p>
        <button type="button" class="boton primario" data-accion="nuevo-activo">Añadir mi primera inversión</button>
      </div></div>` };
    }

    const avisos = [];
    if (P.estado === 'bloqueado') avisos.push(`<div class="aviso-info">${ico('alerta')}<p>Esta vista no puede conectarse a internet para consultar precios (pasa, por ejemplo, dentro de la app de Claude). Ves el último precio guardado en este dispositivo. Para verlos en vivo, abre Bolsillo en el navegador o actualiza un precio a mano desde su ficha.</p></div>`);
    if (!e.ajustes.claveTwelve && e.activos.some(a => a.fuente === 'twelvedata' || a.referencia)) {
      avisos.push(`<div class="aviso-info">${ico('inversiones')}<p>Para ver en vivo el precio de acciones, ETF y fondos que siguen un índice hace falta una clave gratuita de Twelve Data (se consigue en un minuto). Las criptomonedas ya se actualizan solas.</p><button type="button" class="boton pequeno" data-accion="clave-twelve">Añadir clave</button></div>`);
    }

    const c = B.resumenCartera();
    const conPos = c.filas.filter(f => f.p.cant > 0).sort((x, y) => y.valor - x.valor);
    const seguimiento = c.filas.filter(f => f.p.cant <= 0);

    const kpis = `<section class="kpis">
      <div class="tarjeta kpi destacado"><span class="kpi-etq">Valor de la cartera</span><div class="kpi-valor num">${B.dinero(c.valor)}</div>
        <div class="kpi-pie">${c.cambioDia ? `<span class="chip ${c.cambioDia > 0 ? 'ok' : 'mal'}">${firmado(c.cambioDia)}</span> en 24 h` : 'Sin variación registrada hoy'}</div></div>
      <div class="tarjeta kpi"><span class="kpi-etq">Ganancia sin vender</span><div class="kpi-valor num ${claseSigno(c.ganancia)}">${firmado(c.ganancia)}</div>
        <div class="kpi-pie">${chipCambio(c.gananciaPct * 100, 1)} sobre lo invertido</div></div>
      <div class="tarjeta kpi"><span class="kpi-etq">Invertido</span><div class="kpi-valor num">${B.dinero(c.coste)}</div><div class="kpi-pie">Coste de lo que tienes ahora</div></div>
      <div class="tarjeta kpi"><span class="kpi-etq">Ganancias ya realizadas</span><div class="kpi-valor num ${claseSigno(c.realizado)}">${firmado(c.realizado)}</div><div class="kpi-pie">Por lo que has vendido</div></div>
    </section>`;

    const segs = conPos.map(f => ({ valor: f.valor, color: f.a.color, etiqueta: f.a.nombre }));
    const porTipo = {};
    conPos.forEach(f => { porTipo[f.a.tipo] = (porTipo[f.a.tipo] || 0) + f.valor; });
    const reparto = `<section class="tarjeta s4">
      <div class="tarjeta-cab"><h2>Reparto</h2></div>
      ${segs.length ? `${B.donut(segs, `<small>Total</small><strong class="num">${B.dinero(c.valor, null, { sinDecimales: true })}</strong>`, 'Reparto de la cartera')}
      <ul class="leyenda reparto-leyenda">${segs.map(s => `<li>${punto(s.color)}<span class="txt">${esc(s.etiqueta)}</span><span class="num">${B.dinero(s.valor, null, { sinDecimales: true })}</span><span class="pct num">${Math.round(s.valor / c.valor * 100)} %</span></li>`).join('')}</ul>
      <div class="por-tipo">${Object.entries(porTipo).sort((x, y) => y[1] - x[1]).map(([t, v]) => `<span class="chip">${B.TIPOS_ACTIVO[t] || t} ${Math.round(v / c.valor * 100)} %</span>`).join('')}</div>`
        : '<p class="sub">Aún no tienes posiciones.</p>'}
    </section>`;

    const posiciones = `<section class="tarjeta s12">
      <div class="tarjeta-cab"><h2>Tus posiciones</h2><span class="sub">Precio · 24 h · valor y ganancia</span></div>
      <div class="posiciones">${conPos.map(f => filaPosicion(f, c.valor)).join('') || '<p class="sub">Sin posiciones abiertas.</p>'}</div>
      ${seguimiento.length ? `<h3 class="mini-tit seguimiento-tit">En seguimiento</h3><div class="posiciones">${seguimiento.map(f => filaPosicion(f, c.valor)).join('')}</div>` : ''}
    </section>`;

    const ops = e.operaciones.map((o, i) => ({ o, i })).sort((x, y) => y.o.fecha.localeCompare(x.o.fecha) || y.i - x.i).slice(0, 6).map(x => x.o);
    const ultimasOps = `<section class="tarjeta s6">
      <div class="tarjeta-cab"><h2>Últimas operaciones</h2></div>
      ${ops.length ? `<div class="lista">${ops.map(filaOperacion).join('')}</div>` : '<p class="sub">Todavía no hay compras ni ventas.</p>'}
    </section>`;

    const aport = e.recurrentes.filter(r => r.tipo === 'inversion');
    const aportaciones = `<section class="tarjeta s6">
      <div class="tarjeta-cab"><h2>Aportaciones periódicas</h2></div>
      ${aport.length ? `<div class="lista">${aport.map(r => {
        const a = B.activo(r.activoId);
        return a ? B.filaRecurrente(r, `${B.FRECUENCIAS[r.frecuencia]} · ${r.activo ? `próxima ${B.fechaCorta(r.proxima)}` : 'en pausa'}`) : '';
      }).join('')}</div>` : '<p class="sub">Invierte una cantidad fija cada mes de forma automática (por ejemplo, 100 € en un fondo indexado). Se configura desde la ficha de cada inversión.</p>'}
    </section>`;

    return {
      html: cab + avisos.join('') + kpis + `<div class="rejilla">
        <section class="tarjeta s8 cartera-grafico">${graficoCartera()}</section>${reparto}${posiciones}${ultimasOps}${aportaciones}
      </div>`,
    };
  }
  B.vistas.inversiones = inversiones;

  function filaOperacion(o) {
    const a = B.activo(o.activoId);
    if (!a) return '';
    const total = o.cantidad * o.precio + (o.tipo === 'compra' ? 1 : -1) * (o.comision || 0);
    return `<button type="button" class="mov" data-accion="editar-operacion" data-id="${o.id}">
      ${B.icoActivo(a)}
      <span class="mov-txt"><strong>${o.tipo === 'compra' ? 'Compra' : 'Venta'} · ${esc(a.nombre)}</strong><small>${B.fechaCorta(o.fecha)} · ${B.cantidad(o.cantidad)} a ${B.precioFmt(o.precio, a.monedaPrecio)}</small></span>
      <span class="mov-imp num ${o.tipo === 'venta' ? 'pos' : ''}">${o.tipo === 'venta' ? '+' : '−'}${B.dinero(B.convertir(total, a.monedaPrecio, mon()))}</span>
    </button>`;
  }

  /* ---------- Tarjeta del resumen ---------- */
  B.tarjetaInversionesInicio = () => {
    const e = B.estado;
    if (!e.activos.length) {
      return `<section class="tarjeta s5"><div class="tarjeta-cab"><h2>Inversiones</h2><a class="enlace" href="#inversiones">Abrir</a></div>
        <div class="vacio"><p>Sigue tus criptomonedas, acciones y fondos con su precio en vivo.</p><button type="button" class="boton pequeno" data-accion="nuevo-activo">Añadir inversión</button></div></section>`;
    }
    const c = B.resumenCartera();
    const top = c.filas.filter(f => f.p.cant > 0).sort((x, y) => y.valor - x.valor).slice(0, 4);
    return `<section class="tarjeta s5">
      <div class="tarjeta-cab"><h2>Inversiones</h2><a class="enlace" href="#inversiones">Ver cartera</a></div>
      <div class="inv-mini-cab"><b class="num">${B.dinero(c.valor)}</b>${c.cambioDia ? `<span class="chip ${c.cambioDia > 0 ? 'ok' : 'mal'}">${firmado(c.cambioDia)} hoy</span>` : ''}</div>
      <p class="sub num">Ganancia sin vender <b class="${claseSigno(c.ganancia)}">${firmado(c.ganancia)} (${pctFmt(c.gananciaPct * 100, 1)})</b></p>
      <div class="lista inv-mini">${top.map(f => `<button type="button" class="mov" data-accion="ver-activo" data-id="${f.a.id}">
        ${B.icoActivo(f.a)}<span class="mov-txt"><strong>${esc(f.a.nombre)}</strong><small>${B.precioFmt(B.precioActual(f.a), f.a.monedaPrecio)}</small></span>
        <span class="mov-der">${f.a.precioFecha ? chipCambio(f.a.cambio24h || 0) : ''}</span></button>`).join('')}</div>
      <p class="sub estado-precios">${B.pildoraPrecios()}</p>
    </section>`;
  };

  /* ---------- Ficha de un activo ---------- */
  B.verActivo = id => {
    const a = B.activo(id);
    if (!a) return;
    const p = B.posicion(id);
    const c = B.resumenCartera();
    const valorMain = B.convertir(p.valor, a.monedaPrecio, mon());
    const peso = c.valor > 0 ? valorMain / c.valor : 0;
    const ops = B.opsDe(id).slice().reverse();
    const aport = B.estado.recurrentes.filter(r => r.tipo === 'inversion' && r.activoId === id);
    const rangosFicha = a.fuente === 'coingecko' ? [['1', '24 h'], ['7', '7 d'], ['30', '1 m'], ['365', '1 a']] : [['7', '7 d'], ['30', '1 m'], ['90', '3 m'], ['365', '1 a']];
    const dato = (t, v, cls = '') => `<div class="dato"><span>${t}</span><b class="num ${cls}">${v}</b></div>`;
    const fuente = { coingecko: 'CoinGecko', twelvedata: 'Twelve Data', manual: 'Precio manual' }[a.fuente] || 'Manual';

    const cuerpo = `<div class="ficha">
      <div class="ficha-cab">
        ${B.icoActivo(a)}
        <div class="ficha-precio">
          <div><b class="num grande" id="fa-precio">${B.precioFmt(B.precioActual(a), a.monedaPrecio)}</b> ${a.precioFecha ? chipCambio(a.cambio24h || 0) : ''}</div>
          <small class="sub">${esc([a.simbolo, B.TIPOS_ACTIVO[a.tipo], a.exchange, a.isin].filter(Boolean).join(' · '))} · ${fechaPrecio(a)}${a.referencia ? ` · sigue a ${esc(a.referencia.nombre || a.referencia.idFuente)}` : ''}${a.fuente === 'twelvedata' && a.precioFecha ? (a.mercadoAbierto ? ' · mercado abierto' : ' · mercado cerrado') : ''}</small>
        </div>
      </div>
      <div class="ficha-grafico">
        <div class="tarjeta-cab"><div class="pildoras pequenas" role="group" aria-label="Periodo del gráfico">${rangosFicha.map(([d, t], i) =>
          `<button type="button" data-dias="${d}" class="${i === 1 ? 'activo' : ''}">${t}</button>`).join('')}</div><small class="sub" id="fa-fuente">${fuente}</small></div>
        <div id="fa-grafico" class="grafico-carga"><span class="sub">Cargando gráfico…</span></div>
      </div>
      <div class="datos-ficha">
        ${dato('Tienes', `${B.cantidad(p.cant)} ${esc(a.simbolo || '')}`)}
        ${dato('Valor', B.dinero(valorMain))}
        ${dato('Precio medio', p.cant > 0 ? B.precioFmt(p.precioMedio, a.monedaPrecio) : '—')}
        ${dato('Invertido', B.dinero(B.convertir(p.coste, a.monedaPrecio, mon())))}
        ${dato('Ganancia', p.cant > 0 ? `${firmado(B.convertir(p.ganancia, a.monedaPrecio, mon()))} · ${pctFmt(p.gananciaPct * 100, 1)}` : '—', claseSigno(p.ganancia))}
        ${dato('Peso en la cartera', `${Math.round(peso * 100)} %`)}
        ${dato('Ganancias realizadas', firmado(B.convertir(p.realizado, a.monedaPrecio, mon())), claseSigno(p.realizado))}
        ${dato('Comisiones pagadas', B.dinero(B.convertir(p.comisiones, a.monedaPrecio, mon())))}
      </div>
      <div class="botonera">
        <button type="button" class="boton pequeno" data-accion="aportacion-activo" data-id="${a.id}">${ico('recurrentes')}<span>${aport.length ? 'Editar aportación periódica' : 'Aportación periódica'}</span></button>
        <button type="button" class="boton pequeno" data-accion="precio-manual" data-id="${a.id}">Poner precio a mano</button>
        <button type="button" class="boton pequeno" data-accion="editar-activo" data-id="${a.id}">${ico('editar')}<span>Editar</span></button>
      </div>
      <h3 class="mini-tit">Operaciones</h3>
      ${ops.length ? `<div class="lista">${ops.map(filaOperacion).join('')}</div>` : '<p class="sub">Sin operaciones. Está en seguimiento: añade una compra cuando inviertas.</p>'}
    </div>`;

    B.abrirModal({
      titulo: a.nombre, cuerpo, clase: 'ancho',
      pie: `${p.cant > 0 ? `<button type="button" class="boton" data-accion="operar" data-id="${a.id}" data-tipo="venta">Vender</button>` : ''}
        <button type="button" class="boton primario" data-accion="operar" data-id="${a.id}" data-tipo="compra">${ico('mas')}<span>Comprar</span></button>`,
      alMontar(md) {
        const cont = md.querySelector('#fa-grafico');
        let peticion = 0;
        const cargar = async dias => {
          const yo = ++peticion;
          cont.innerHTML = '<span class="sub">Cargando gráfico…</span>';
          const { vivo, puntos } = await B.historialPrecio(a, Number(dias));
          if (yo !== peticion || !md.isConnected) return;
          md.querySelector('#fa-fuente').textContent = vivo ? `${fuente} · en vivo` : (a.historialSintetico ? 'Historial de ejemplo' : 'Historial guardado en este dispositivo');
          if (puntos.length < 2) { cont.innerHTML = '<span class="sub">No hay suficientes precios para dibujar el gráfico.</span>'; return; }
          const corto = Number(dias) <= 1;
          const etiq = puntos.map(x => { const d = new Date(x.t); return corto ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : B.fechaCorta(B.iso(d.getFullYear(), d.getMonth(), d.getDate())); });
          const ini = puntos[0].v, fin = puntos[puntos.length - 1].v;
          const color = fin >= ini ? 'var(--ok)' : 'var(--bad)';
          cont.innerHTML = B.lineas({
            n: puntos.length, ajustar: true, tooltip: { etiquetas: etiq, moneda: a.monedaPrecio === 'GBX' ? 'GBP' : a.monedaPrecio },
            etiquetasX: [0, Math.floor((puntos.length - 1) / 2), puntos.length - 1].map(i => ({ i, txt: etiq[i] })),
            series: [{ nombre: 'Precio', valores: puntos.map(x => a.monedaPrecio === 'GBX' ? x.v / 100 : x.v), color, area: true, puntoFinal: true }],
          }) + `<p class="sub pie-grafico">En este periodo: <b class="num ${claseSigno(fin - ini)}">${pctFmt((fin - ini) / ini * 100)}</b></p>`;
        };
        md.querySelectorAll('[data-dias]').forEach(b => b.addEventListener('click', () => {
          md.querySelectorAll('[data-dias]').forEach(x => x.classList.toggle('activo', x === b));
          cargar(b.dataset.dias);
        }));
        cargar(rangosFicha[1][0]);
      },
    });
  };

  /* ---------- Formularios ---------- */
  const fallo = (md, sel) => t => { const p = md.querySelector(sel); p.textContent = t; p.hidden = !t; };
  const opcionesCuentas = (sel, conNinguna = true) => (conNinguna ? `<option value="">No descontar de ninguna cuenta</option>` : '') +
    B.estado.cuentas.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nombre)} (${c.moneda})</option>`).join('');
  const terminar = (texto, reabrir) => { B.cerrarModal(); B.render(); B.aviso(texto); if (reabrir) setTimeout(() => B.verActivo(reabrir), 60); };

  /* Bloque común de compra/venta: unidades o importe, precio, comisión, cuenta */
  const bloqueOperacion = (pref, v) => `
    <div class="segmentado" role="radiogroup" aria-label="Cómo lo indicas">
      <label><input type="radio" name="${pref}-modo" value="importe" ${v.modo === 'importe' ? 'checked' : ''}><span>Por importe</span></label>
      <label><input type="radio" name="${pref}-modo" value="unidades" ${v.modo !== 'importe' ? 'checked' : ''}><span>Por unidades</span></label>
    </div>
    <div class="fila2">
      <label class="campo" id="${pref}-c-cant"><span>Unidades</span><input id="${pref}-cant" inputmode="decimal" placeholder="Ej.: 0,015" value="${B.aInput(v.cantidad)}"></label>
      <label class="campo" id="${pref}-c-importe"><span id="${pref}-l-importe">Importe</span><input id="${pref}-importe" inputmode="decimal" placeholder="Ej.: 500"></label>
      <label class="campo"><span id="${pref}-l-precio">Precio por unidad</span><input id="${pref}-precio" inputmode="decimal" placeholder="0,00" value="${B.aInput(v.precio)}"></label>
    </div>
    <div class="fila2">
      <label class="campo"><span>Fecha</span><input id="${pref}-fecha" type="date" value="${v.fecha || B.hoyISO()}"></label>
      <label class="campo"><span>Comisión (opcional)</span><input id="${pref}-com" inputmode="decimal" placeholder="0" value="${v.comision ? B.aInput(v.comision) : ''}"></label>
    </div>
    <label class="campo"><span id="${pref}-l-cuenta">Pagado desde</span><select id="${pref}-cuenta">${opcionesCuentas(v.cuentaId)}</select>
      <small class="ayuda">Si eliges una cuenta, el dinero sale (o entra al vender) de ella. Déjalo en «ninguna» para inversiones que ya tenías.</small></label>
    <p class="ayuda" id="${pref}-resumen"></p>`;

  function montarOperacion(md, pref, monedaActivo, simbolo, esVenta) {
    const $ = s => md.querySelector(s);
    const modo = () => md.querySelector(`input[name=${pref}-modo]:checked`).value;
    const pintar = () => {
      const m = modo();
      $(`#${pref}-c-cant`).hidden = m === 'importe';
      $(`#${pref}-c-importe`).hidden = m !== 'importe';
      $(`#${pref}-l-precio`).textContent = `Precio por unidad (${SIMBOLO[monedaActivo()] || monedaActivo()})`;
      $(`#${pref}-l-importe`).textContent = `Importe (${SIMBOLO[monedaActivo()] || monedaActivo()})`;
      $(`#${pref}-l-cuenta`).textContent = esVenta && esVenta() ? 'El dinero entra en' : 'Pagado desde';
      const x = leer();
      $(`#${pref}-resumen`).textContent = x.cantidad > 0 && x.precio > 0
        ? `${B.cantidad(x.cantidad)} ${simbolo()} × ${B.precioFmt(x.precio, monedaActivo())} = ${B.precioFmt(x.cantidad * x.precio, monedaActivo())}${x.comision ? ` (+ ${B.precioFmt(x.comision, monedaActivo())} de comisión)` : ''}`
        : '';
    };
    const leer = () => {
      const precio = B.numero($(`#${pref}-precio`).value);
      const comision = B.numero($(`#${pref}-com`).value) || 0;
      let cantidad = B.numero($(`#${pref}-cant`).value);
      if (modo() === 'importe') { const imp = B.numero($(`#${pref}-importe`).value); cantidad = precio > 0 && imp > 0 ? imp / precio : NaN; }
      return { precio, comision, cantidad, fecha: $(`#${pref}-fecha`).value, cuentaId: $(`#${pref}-cuenta`).value || null };
    };
    md.querySelectorAll(`input[name=${pref}-modo]`).forEach(r => r.addEventListener('change', pintar));
    [`#${pref}-cant`, `#${pref}-importe`, `#${pref}-precio`, `#${pref}-com`].forEach(s => $(s).addEventListener('input', pintar));
    pintar();
    return { leer, pintar };
  }
  const validarOp = (x, error) => {
    if (!(x.precio > 0)) return error('Escribe el precio por unidad.'), false;
    if (!(x.cantidad > 0)) return error('Escribe cuántas unidades o el importe.'), false;
    if (!x.fecha) return error('Elige la fecha.'), false;
    if (x.comision < 0) return error('La comisión no puede ser negativa.'), false;
    return true;
  };

  /* Nueva inversión: buscar en vivo o añadir a mano */
  const PRESETS_INDICE = [
    ['', 'No seguir ningún índice'],
    ['SPY', 'S&P 500 (a través del ETF SPY)'],
    ['URTH', 'MSCI World (a través del ETF URTH)'],
    ['QQQ', 'Nasdaq 100 (a través del ETF QQQ)'],
    ['VGK', 'Bolsa europea (a través del ETF VGK)'],
    ['EEM', 'Mercados emergentes (a través del ETF EEM)'],
  ];

  B.formActivo = id => {
    const e = B.estado, a = id ? B.activo(id) : null;
    if (a) return formEditarActivo(a);
    let tipo = 'cripto', sel = null; // sel: activo elegido en la búsqueda
    const cuerpo = `<form id="fi" class="formulario" novalidate autocomplete="off">
      <div class="segmentado" role="radiogroup" aria-label="Tipo">
        ${[['cripto', 'Cripto'], ['bolsa', 'Acción o ETF'], ['fondo', 'Fondo'], ['otro', 'Otro']].map(([v, t]) =>
          `<label><input type="radio" name="fi-tipo" value="${v}" ${v === tipo ? 'checked' : ''}><span>${t}</span></label>`).join('')}
      </div>

      <div id="fi-buscador">
        <label class="campo buscar-activo"><span id="fi-l-buscar">Busca la criptomoneda</span>
          <span class="buscar">${ico('buscar')}<input id="fi-q" class="entrada" type="search" placeholder="Bitcoin, ETH, Solana…" autofocus></span>
        </label>
        <div id="fi-resultados" class="resultados" role="listbox"></div>
        <button type="button" class="enlace" id="fi-a-mano">No lo encuentro: añadir a mano</button>
      </div>

      <div id="fi-elegido" class="elegido" hidden></div>

      <div id="fi-manual" hidden>
        <label class="campo"><span>Nombre</span><input id="fi-nombre" maxlength="60" placeholder="Ej.: Fondo indexado S&P 500"></label>
        <div class="fila2">
          <label class="campo"><span>Símbolo o ISIN (opcional)</span><input id="fi-simbolo" maxlength="20" placeholder="Ej.: IE00BYX5MX67"></label>
          <label class="campo"><span>Moneda del precio</span><select id="fi-moneda"><option value="EUR">Euro (€)</option><option value="USD">Dólar ($)</option></select></label>
        </div>
        <label class="campo"><span id="fi-l-precio-actual">Precio actual por unidad (valor liquidativo)</span><input id="fi-precio-actual" inputmode="decimal" placeholder="0,00"></label>
        <label class="campo" id="fi-c-indice"><span>Estimar el precio a diario siguiendo un índice (opcional)</span>
          <select id="fi-indice">${PRESETS_INDICE.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
          <small class="ayuda">Los fondos indexados no publican su precio en tiempo real. Si sigues un índice, Bolsillo estima el valor del fondo con lo que se mueve el índice desde el último precio que pongas. Necesita la clave gratuita de Twelve Data.</small>
        </label>
      </div>

      <section id="fi-compra" class="bloque-compra" hidden>
        <label class="check"><input type="checkbox" id="fi-solo-seguir"> Solo quiero seguir su precio (sin compra)</label>
        <div id="fi-datos-compra">
          <h3 class="mini-tit">Tu compra</h3>
          ${bloqueOperacion('fi', { modo: 'unidades' })}
        </div>
      </section>
      <p class="error" id="fi-error" hidden></p>
    </form>`;

    B.abrirModal({
      titulo: 'Añadir inversión', cuerpo, clase: 'ancho',
      pie: `<button type="button" class="boton" data-cerrar>Cancelar</button><button type="submit" class="boton primario" form="fi" id="fi-ok" disabled>Guardar</button>`,
      alMontar(md) {
        const $ = s => md.querySelector(s);
        const error = fallo(md, '#fi-error');
        let manual = false, temporizador = null, consulta = 0;
        const monedaActivo = () => sel ? sel.moneda : $('#fi-moneda').value;
        const simbolo = () => sel ? (sel.simbolo || '').toUpperCase() : ($('#fi-simbolo').value.trim() || 'uds.');
        const op = montarOperacion(md, 'fi', monedaActivo, simbolo);

        const estado = () => {
          const listo = !!sel || (manual && $('#fi-nombre').value.trim());
          $('#fi-buscador').hidden = !!sel || manual;
          $('#fi-elegido').hidden = !sel;
          $('#fi-manual').hidden = !manual;
          $('#fi-c-indice').hidden = tipo !== 'fondo';
          $('#fi-compra').hidden = !listo;
          $('#fi-datos-compra').hidden = $('#fi-solo-seguir').checked;
          $('#fi-ok').disabled = !listo;
          $('#fi-l-precio-actual').textContent = tipo === 'fondo' ? 'Precio actual por participación (valor liquidativo)' : 'Precio actual por unidad';
          op.pintar();
        };
        const ponerTipo = t => {
          tipo = t; sel = null; manual = t === 'fondo' || t === 'otro';
          $('#fi-l-buscar').textContent = t === 'cripto' ? 'Busca la criptomoneda' : 'Busca la acción o el ETF por nombre, símbolo o ISIN';
          $('#fi-q').placeholder = t === 'cripto' ? 'Bitcoin, ETH, Solana…' : 'Apple, VUSA, IE00B3XXRP09…';
          $('#fi-q').value = ''; $('#fi-resultados').innerHTML = '';
          estado();
        };
        md.querySelectorAll('input[name=fi-tipo]').forEach(r => r.addEventListener('change', () => ponerTipo(r.value)));

        const elegir = async item => {
          sel = item;
          $('#fi-elegido').innerHTML = `<div class="elegido-info"><strong>${esc(item.nombre)}</strong><small class="sub">${esc([item.simbolo?.toUpperCase(), item.exchange, item.moneda].filter(Boolean).join(' · '))}</small></div>
            <span class="sub" id="fi-precio-vivo">Buscando precio…</span><button type="button" class="enlace" id="fi-cambiar">Cambiar</button>`;
          $('#fi-cambiar').addEventListener('click', () => { sel = null; estado(); $('#fi-q').focus(); });
          estado();
          let precio = null;
          try {
            if (item.fuente === 'coingecko') {
              const d = await B.pedirJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(item.idFuente)}&vs_currencies=eur,usd&include_24hr_change=true`);
              const k = item.moneda.toLowerCase();
              precio = d[item.idFuente]?.[k]; item.cambio24h = d[item.idFuente]?.[`${k}_24h_change`];
            } else if (B.estado.ajustes.claveTwelve) {
              const d = await B.pedirJSON(B.urlTwelve('quote', { symbol: item.idFuente, exchange: item.exchange }));
              precio = parseFloat(d.close); item.cambio24h = parseFloat(d.percent_change);
            }
          } catch (err) { /* sin precio en vivo */ }
          if (sel !== item || !md.isConnected) return;
          const pv = $('#fi-precio-vivo');
          if (precio > 0) {
            item.precio = precio;
            pv.innerHTML = `Ahora: <b class="num">${B.precioFmt(precio, item.moneda)}</b>`;
            if (!$('#fi-precio').value) { $('#fi-precio').value = B.aInput(+precio.toPrecision(8)); op.pintar(); }
          } else pv.textContent = item.fuente === 'twelvedata' && !B.estado.ajustes.claveTwelve ? 'Precio en vivo con clave de Twelve Data' : 'Sin precio en vivo ahora';
        };

        const buscar = async () => {
          const q = $('#fi-q').value.trim();
          const res = $('#fi-resultados');
          if (q.length < 2) { res.innerHTML = ''; return; }
          const yo = ++consulta;
          res.innerHTML = '<p class="sub">Buscando…</p>';
          try {
            let lista;
            if (tipo === 'cripto') {
              lista = (await B.buscarCripto(q)).map(c => ({ fuente: 'coingecko', idFuente: c.id, nombre: c.nombre, simbolo: c.simbolo, moneda: mon(), extra: c.rango ? `#${c.rango} por capitalización` : '' }));
            } else {
              lista = (await B.buscarBolsa(q)).map(x => ({ fuente: 'twelvedata', idFuente: x.simbolo, nombre: x.nombre, simbolo: x.simbolo, exchange: x.exchange, moneda: x.moneda || 'USD', tipoTD: x.tipo, extra: [x.exchange, x.pais, x.moneda === 'GBX' ? 'GBp' : x.moneda].filter(Boolean).join(' · ') }));
            }
            if (yo !== consulta) return;
            res._lista = lista;
            res.innerHTML = lista.length ? lista.map((x, i) => `<button type="button" class="resultado" data-i="${i}" role="option">
              <span class="mov-ico activo-ico" style="--c:var(--accent)">${esc((x.simbolo || '?').slice(0, 3).toUpperCase())}</span>
              <span class="mov-txt"><strong>${esc(x.nombre)}</strong><small>${esc((x.simbolo || '').toUpperCase())}${x.extra ? ' · ' + esc(x.extra) : ''}</small></span></button>`).join('')
              : '<p class="sub">Sin resultados. Prueba con otro nombre o añádelo a mano.</p>';
          } catch (err) {
            if (yo !== consulta) return;
            res.innerHTML = `<p class="sub">${err.red ? 'No hay conexión para buscar desde aquí. Puedes añadirlo a mano y poner el precio tú.' : esc(err.message)}</p>`;
          }
        };
        $('#fi-q').addEventListener('input', () => { clearTimeout(temporizador); temporizador = setTimeout(buscar, 350); });
        $('#fi-resultados').addEventListener('click', ev => {
          const b = ev.target.closest('.resultado');
          if (b) elegir({ ...$('#fi-resultados')._lista[Number(b.dataset.i)] });
        });
        $('#fi-a-mano').addEventListener('click', () => { manual = true; sel = null; estado(); $('#fi-nombre').focus(); });
        $('#fi-nombre').addEventListener('input', estado);
        $('#fi-solo-seguir').addEventListener('change', estado);
        $('#fi-moneda').addEventListener('change', () => op.pintar());
        $('#fi-precio-actual').addEventListener('input', () => { if (!$('#fi-precio').value) { $('#fi-precio').value = $('#fi-precio-actual').value; op.pintar(); } });
        ponerTipo('cripto');

        $('#fi').addEventListener('submit', ev => {
          ev.preventDefault();
          error('');
          const color = COLORES[e.activos.length % COLORES.length];
          let activo;
          if (sel) {
            const tipoFinal = tipo === 'cripto' ? 'cripto' : /etf|fund/i.test(sel.tipoTD || '') ? 'etf' : 'accion';
            activo = { id: B.uid(), nombre: sel.nombre, simbolo: (sel.simbolo || '').toUpperCase(), tipo: tipoFinal, fuente: sel.fuente, idFuente: sel.idFuente, exchange: sel.exchange, monedaPrecio: sel.moneda, color, precio: sel.precio || 0, cambio24h: sel.cambio24h || 0, precioFecha: sel.precio ? new Date().toISOString() : null };
          } else {
            const nombre = $('#fi-nombre').value.trim();
            if (!nombre) return error('Ponle un nombre.');
            const precioAct = B.numero($('#fi-precio-actual').value);
            if (!(precioAct > 0)) return error('Escribe el precio actual por unidad.');
            const sim = $('#fi-simbolo').value.trim();
            activo = { id: B.uid(), nombre, simbolo: /^[A-Z]{2}[A-Z0-9]{9}\d$/i.test(sim) ? '' : sim.toUpperCase(), isin: /^[A-Z]{2}[A-Z0-9]{9}\d$/i.test(sim) ? sim.toUpperCase() : '', tipo: tipo === 'fondo' ? 'fondo' : 'otro', fuente: 'manual', monedaPrecio: $('#fi-moneda').value, color, precio: precioAct, cambio24h: 0, precioFecha: new Date().toISOString() };
            const ind = tipo === 'fondo' && $('#fi-indice').value;
            if (ind) {
              activo.valorBase = precioAct;
              activo.referencia = { fuente: 'twelvedata', idFuente: ind, nombre: PRESETS_INDICE.find(x => x[0] === ind)[1].split(' (')[0], precio: null, precioBase: null };
            }
          }
          let compra = null;
          if (!$('#fi-solo-seguir').checked) {
            const x = op.leer();
            if (!validarOp(x, error)) return;
            compra = { id: B.uid(), activoId: activo.id, tipo: 'compra', fecha: x.fecha, cantidad: x.cantidad, precio: x.precio, comision: x.comision, cuentaId: x.cuentaId };
          }
          B.guardarActivo(activo);
          if (activo.precio > 0) B.guardarPrecioDia(activo.id, activo.precio);
          if (compra) B.guardarOperacion(compra);
          terminar(`${activo.nombre} añadido a tu cartera`, activo.id);
          B.rellenarHistorial(activo).then(ok => { if (ok && location.hash === '#inversiones' && !document.querySelector('.capa')) B.render(); });
          if (activo.referencia) B.actualizarPrecios({ forzar: true });
        });
      },
    });
  };

  function formEditarActivo(a) {
    const cuerpo = `<form id="fe" class="formulario" novalidate autocomplete="off">
      <label class="campo"><span>Nombre</span><input id="fe-nombre" maxlength="60" value="${esc(a.nombre)}"></label>
      <div class="fila2">
        <label class="campo"><span>Símbolo</span><input id="fe-simbolo" maxlength="20" value="${esc(a.simbolo || '')}"></label>
        <label class="campo"><span>Tipo</span><select id="fe-tipo">${Object.entries(B.TIPOS_ACTIVO).map(([k, t]) => `<option value="${k}" ${k === a.tipo ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      </div>
      ${a.tipo === 'fondo' || a.referencia ? `<label class="campo"><span>Seguir un índice</span><select id="fe-indice">${PRESETS_INDICE.map(([v, t]) => `<option value="${v}" ${v === (a.referencia?.idFuente || '') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
      <div class="campo"><span>Color</span><div class="colores" role="radiogroup">${(COLORES.includes(a.color) ? COLORES : [a.color, ...COLORES]).map(c =>
        `<label><input type="radio" name="fe-color" value="${c}" ${c === a.color ? 'checked' : ''} aria-label="Color ${c}"><span style="--c:${c}"></span></label>`).join('')}</div></div>
      <p class="ayuda">Precio de: ${esc({ coingecko: 'CoinGecko (en vivo)', twelvedata: 'Twelve Data (en vivo con clave)', manual: 'lo que tú pongas' }[a.fuente] || 'manual')}${a.idFuente ? ` · ${esc(a.idFuente)}` : ''}</p>
      <p class="error" id="fe-error" hidden></p>
    </form>`;
    B.abrirModal({
      titulo: 'Editar inversión', cuerpo, clase: 'estrecho',
      pie: `<button type="button" class="boton peligro izq" id="fe-borrar">Borrar</button><button type="button" class="boton" data-cerrar>Cancelar</button><button type="submit" class="boton primario" form="fe">Guardar</button>`,
      alMontar(md) {
        const $ = s => md.querySelector(s);
        $('#fe').addEventListener('submit', ev => {
          ev.preventDefault();
          const nombre = $('#fe-nombre').value.trim();
          if (!nombre) return fallo(md, '#fe-error')('Ponle un nombre.');
          a.nombre = nombre; a.simbolo = $('#fe-simbolo').value.trim().toUpperCase(); a.tipo = $('#fe-tipo').value;
          a.color = md.querySelector('input[name=fe-color]:checked').value;
          const ind = $('#fe-indice')?.value;
          if ($('#fe-indice')) {
            if (!ind) { if (a.referencia) { a.precio = B.precioActual(a); delete a.referencia; delete a.valorBase; } }
            else if (a.referencia?.idFuente !== ind) {
              a.valorBase = B.precioActual(a);
              a.referencia = { fuente: 'twelvedata', idFuente: ind, nombre: PRESETS_INDICE.find(x => x[0] === ind)[1].split(' (')[0], precio: null, precioBase: null };
              B.actualizarPrecios({ forzar: true });
            }
          }
          B.guardarActivo(a);
          terminar('Inversión actualizada', a.id);
        });
        $('#fe-borrar').addEventListener('click', async () => {
          const n = B.opsDe(a.id).length;
          if (await B.confirmar({ titulo: `¿Borrar «${a.nombre}»?`, texto: `Se borran ${n ? `sus ${n} operaciones y ` : ''}los movimientos de dinero que crearon en tus cuentas, además de su historial de precios y sus aportaciones periódicas. No se puede deshacer.`, boton: 'Borrar', peligro: true })) {
            B.borrarActivo(a.id); terminar('Inversión borrada');
          }
        });
      },
    });
  }

  /* Compra o venta de un activo existente */
  B.formOperacion = (activoId, tipo = 'compra', opId) => {
    const o = opId ? B.operacion(opId) : null;
    const a = B.activo(o ? o.activoId : activoId);
    if (!a) return;
    const tipo0 = o ? o.tipo : tipo;
    const v = o ? { ...o, modo: 'unidades' } : { modo: a.tipo === 'fondo' ? 'importe' : 'unidades', precio: +B.precioActual(a).toPrecision(8) || '', cuentaId: B.ui.ultimaCuenta || '' };
    const cuerpo = `<form id="fo" class="formulario" novalidate autocomplete="off">
      <div class="segmentado" role="radiogroup" aria-label="Operación">
        <label class="seg-ingreso"><input type="radio" name="fo-tipo" value="compra" ${tipo0 === 'compra' ? 'checked' : ''}><span>Compra</span></label>
        <label class="seg-gasto"><input type="radio" name="fo-tipo" value="venta" ${tipo0 === 'venta' ? 'checked' : ''}><span>Venta</span></label>
      </div>
      <p class="sub">Tienes ${B.cantidad(B.posicion(a.id).cant)} ${esc(a.simbolo || 'unidades')} · precio actual ${B.precioFmt(B.precioActual(a), a.monedaPrecio)}</p>
      ${bloqueOperacion('fo', v)}
      <label class="campo"><span>Nota (opcional)</span><input id="fo-nota" maxlength="80" value="${esc(o?.nota || '')}"></label>
      <p class="error" id="fo-error" hidden></p>
    </form>`;
    B.abrirModal({
      titulo: `${o ? 'Editar operación' : tipo0 === 'compra' ? 'Comprar' : 'Vender'} · ${a.nombre}`, cuerpo,
      pie: `${o ? '<button type="button" class="boton peligro izq" id="fo-borrar">Borrar</button>' : ''}<button type="button" class="boton" data-cerrar>Cancelar</button><button type="submit" class="boton primario" form="fo">Guardar</button>`,
      alMontar(md) {
        const $ = s => md.querySelector(s);
        const error = fallo(md, '#fo-error');
        const esVenta = () => md.querySelector('input[name=fo-tipo]:checked').value === 'venta';
        const op = montarOperacion(md, 'fo', () => a.monedaPrecio, () => a.simbolo || 'uds.', esVenta);
        md.querySelectorAll('input[name=fo-tipo]').forEach(r => r.addEventListener('change', op.pintar));
        $('#fo').addEventListener('submit', ev => {
          ev.preventDefault();
          const x = op.leer();
          if (!validarOp(x, error)) return;
          if (esVenta()) {
            const disponible = B.posicion(a.id, x.fecha).cant + (o && o.tipo === 'venta' ? o.cantidad : 0) - (o && o.tipo === 'compra' && o.fecha <= x.fecha ? o.cantidad : 0);
            if (x.cantidad > disponible + 1e-9) return error(`En esa fecha solo tenías ${B.cantidad(disponible)}. No puedes vender más.`);
          }
          B.guardarOperacion({ ...(o || {}), id: o?.id || B.uid(), activoId: a.id, tipo: esVenta() ? 'venta' : 'compra', fecha: x.fecha, cantidad: x.cantidad, precio: x.precio, comision: x.comision, cuentaId: x.cuentaId, nota: $('#fo-nota').value.trim() });
          if (x.cuentaId) B.ui.ultimaCuenta = x.cuentaId;
          terminar(o ? 'Operación actualizada' : esVenta() ? 'Venta registrada' : 'Compra registrada', a.id);
        });
        if (o) $('#fo-borrar').addEventListener('click', async () => {
          if (await B.confirmar({ titulo: '¿Borrar esta operación?', texto: 'También se quita el movimiento de dinero que creó en tu cuenta, si lo hubo.', boton: 'Borrar', peligro: true })) {
            B.borrarOperacion(o.id); terminar('Operación borrada', a.id);
          }
        });
      },
    });
  };

  /* Precio a mano (y nueva base si sigue un índice) */
  B.formPrecioManual = id => {
    const a = B.activo(id);
    if (!a) return;
    B.abrirModal({
      titulo: `Precio de ${a.nombre}`, clase: 'estrecho',
      cuerpo: `<form id="fp2" class="formulario" novalidate autocomplete="off">
        <label class="campo campo-importe"><span>${a.tipo === 'fondo' ? 'Valor liquidativo' : 'Precio por unidad'}</span><input id="fp2-precio" inputmode="decimal" value="${B.aInput(+B.precioActual(a).toPrecision(8))}" autofocus><em>${SIMBOLO[a.monedaPrecio] || a.monedaPrecio}</em></label>
        <p class="ayuda">${a.referencia ? 'A partir de este precio, Bolsillo seguirá estimando el valor con lo que se mueva el índice.' : a.fuente !== 'manual' ? 'Se sustituirá en cuanto llegue un precio en vivo.' : 'Mira el valor liquidativo en la web de tu banco o gestora y actualízalo cuando quieras.'}</p>
        <p class="error" id="fp2-error" hidden></p>
      </form>`,
      pie: '<button type="button" class="boton" data-cerrar>Cancelar</button><button type="submit" class="boton primario" form="fp2">Guardar precio</button>',
      alMontar(md) {
        md.querySelector('#fp2').addEventListener('submit', ev => {
          ev.preventDefault();
          const v = B.numero(md.querySelector('#fp2-precio').value);
          if (!(v > 0)) return fallo(md, '#fp2-error')('Escribe un precio mayor que cero.');
          if (a.referencia) { a.valorBase = v; a.referencia.precioBase = a.referencia.precio || null; }
          a.precio = v; a.precioFecha = new Date().toISOString(); a.cambio24h = 0;
          B.guardarPrecioDia(a.id, v);
          B.guardarActivo(a);
          terminar('Precio actualizado', a.id);
        });
      },
    });
  };

  /* Aportación periódica automática (recurrente de tipo inversión) */
  B.formAportacion = (activoId, recId) => {
    const e = B.estado;
    const r = recId ? B.recurrente(recId) : e.recurrentes.find(x => x.tipo === 'inversion' && x.activoId === activoId);
    const a = B.activo(r ? r.activoId : activoId);
    if (!a) return;
    if (!e.cuentas.length) { B.aviso('Primero crea una cuenta'); B.formCuenta(); return; }
    const cuerpo = `<form id="fa2" class="formulario" novalidate autocomplete="off">
      <p class="sub">Cada vez se compra <b>${esc(a.nombre)}</b> por el importe indicado, al precio de ese momento, y el dinero sale de la cuenta elegida.</p>
      <label class="campo campo-importe"><span>Importe de cada aportación</span><input id="fa2-importe" inputmode="decimal" value="${B.aInput(r?.importe)}" placeholder="100" autofocus><em id="fa2-sim"></em></label>
      <div class="fila2">
        <label class="campo"><span>Desde la cuenta</span><select id="fa2-cuenta">${opcionesCuentas(r?.cuentaId || e.cuentas[0].id, false)}</select></label>
        <label class="campo"><span>Cada cuánto</span><select id="fa2-frec">${Object.entries(B.FRECUENCIAS).map(([k, t]) => `<option value="${k}" ${k === (r?.frecuencia || 'mensual') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      </div>
      <label class="campo"><span>Próxima aportación</span><input id="fa2-fecha" type="date" value="${r?.proxima || B.sumarDias(B.hoyISO(), 1)}"></label>
      ${r ? `<label class="check"><input type="checkbox" id="fa2-pausa" ${r.activo ? '' : 'checked'}> En pausa</label>` : ''}
      <p class="ayuda">${a.fuente === 'manual' && !a.referencia ? 'Este activo usa precio manual: actualízalo de vez en cuando para que las compras automáticas se hagan a un precio realista.' : 'Si ese día no hay precio en vivo, se usa el último guardado.'}</p>
      <p class="error" id="fa2-error" hidden></p>
    </form>`;
    B.abrirModal({
      titulo: 'Aportación periódica', cuerpo, clase: 'estrecho',
      pie: `${r ? '<button type="button" class="boton peligro izq" id="fa2-borrar">Quitar</button>' : ''}<button type="button" class="boton" data-cerrar>Cancelar</button><button type="submit" class="boton primario" form="fa2">Guardar</button>`,
      alMontar(md) {
        const $ = s => md.querySelector(s);
        const sim = () => { $('#fa2-sim').textContent = SIMBOLO[B.cuenta($('#fa2-cuenta').value)?.moneda] || '€'; };
        $('#fa2-cuenta').addEventListener('change', sim); sim();
        $('#fa2').addEventListener('submit', ev => {
          ev.preventDefault();
          const imp = B.numero($('#fa2-importe').value), fecha = $('#fa2-fecha').value;
          if (!(imp > 0)) return fallo(md, '#fa2-error')('Escribe un importe mayor que cero.');
          if (!fecha) return fallo(md, '#fa2-error')('Elige la fecha de la próxima aportación.');
          B.guardarRecurrente({ ...(r || {}), id: r?.id || B.uid(), nombre: `Aportación ${a.nombre}`, tipo: 'inversion', activoId: a.id, importe: B.redondear(imp), cuentaId: $('#fa2-cuenta').value, frecuencia: $('#fa2-frec').value, proxima: fecha, dia: Number(fecha.slice(8)), automatico: true, activo: r ? !$('#fa2-pausa').checked : true });
          const n = B.procesarRecurrentes();
          terminar(n ? `Guardado · ${n} aportación${n === 1 ? '' : 'es'} con fecha pasada registrada${n === 1 ? '' : 's'}` : 'Aportación periódica guardada', a.id);
        });
        if (r) $('#fa2-borrar').addEventListener('click', () => { B.borrarRecurrente(r.id); terminar('Aportación periódica quitada', a.id); });
      },
    });
  };

  /* Clave gratuita de Twelve Data */
  B.formClaveTwelve = () => {
    const actual = B.estado.ajustes.claveTwelve || '';
    B.abrirModal({
      titulo: 'Precios de bolsa en vivo', clase: 'estrecho',
      cuerpo: `<form id="ft" class="formulario" novalidate autocomplete="off">
        <p class="sub">Las acciones, los ETF y los índices se consultan en Twelve Data. Su plan gratuito basta para una cartera personal, pero pide una clave:</p>
        <ol class="pasos">
          <li>Entra en <b>twelvedata.com</b> y crea una cuenta gratuita (plan Basic).</li>
          <li>En tu panel, copia tu <b>API key</b>.</li>
          <li>Pégala aquí y pulsa «Probar».</li>
        </ol>
        <label class="campo"><span>Tu clave (API key)</span><input id="ft-clave" class="num" value="${esc(actual)}" placeholder="Pega aquí tu clave" spellcheck="false" autocapitalize="off"></label>
        <p class="ayuda">Se guarda solo en este dispositivo y no se incluye en las copias de seguridad. El plan gratuito cubre sobre todo la bolsa de EE. UU.; algunas bolsas europeas pueden requerir un plan de pago (en ese caso usa el precio manual o «seguir un índice»).</p>
        <p class="ayuda" id="ft-prueba"></p>
      </form>`,
      pie: `${actual ? '<button type="button" class="boton peligro izq" id="ft-quitar">Quitar clave</button>' : ''}<button type="button" class="boton" id="ft-probar">Probar</button><button type="submit" class="boton primario" form="ft">Guardar</button>`,
      alMontar(md) {
        const $ = s => md.querySelector(s);
        $('#ft-probar').addEventListener('click', async () => {
          const clave = $('#ft-clave').value.trim();
          const p = $('#ft-prueba');
          if (!clave) { p.textContent = 'Pega primero la clave.'; return; }
          p.textContent = 'Probando…';
          try {
            const d = await B.pedirJSON(`https://api.twelvedata.com/quote?symbol=SPY&apikey=${encodeURIComponent(clave)}`);
            p.innerHTML = d.status === 'error' ? `<span class="rojo">No funciona: ${esc(d.message)}</span>` : `<span class="pos">Funciona. SPY cotiza ahora a ${B.precioFmt(parseFloat(d.close), d.currency || 'USD')}.</span>`;
          } catch (err) { p.innerHTML = `<span class="rojo">${err.red ? 'No hay conexión desde esta vista para probarla. Guárdala y se usará en cuanto haya conexión.' : esc(err.message)}</span>`; }
        });
        $('#ft').addEventListener('submit', ev => {
          ev.preventDefault();
          B.estado.ajustes.claveTwelve = $('#ft-clave').value.trim();
          B.guardar();
          B.precios.ultimaBolsa = 0;
          terminar('Clave guardada');
          B.actualizarPrecios({ forzar: true }).then(() => B.estado.activos.filter(a => a.fuente === 'twelvedata' && a.historialSintetico).forEach(a => B.rellenarHistorial(a)));
        });
        if (actual) $('#ft-quitar').addEventListener('click', () => { delete B.estado.ajustes.claveTwelve; B.guardar(); terminar('Clave quitada'); });
      },
    });
  };
})(window.B);
