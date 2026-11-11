/* Bolsillo · pantallas */
(function (B) {
  'use strict';
  const esc = B.esc;
  const ico = n => B.icono(n);

  B.TIPOS_CUENTA = { banco: 'Cuenta bancaria', ahorro: 'Ahorro', tarjeta: 'Tarjeta de crédito', efectivo: 'Efectivo', inversion: 'Inversión' };

  /* ---------- Piezas comunes ---------- */
  const cabecera = (titulo, sub, acciones = '') => `
    <header class="vista-cab">
      <div class="vista-tit"><h1>${titulo}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
      ${acciones ? `<div class="vista-acciones">${acciones}</div>` : ''}
    </header>`;

  B.selectorMes = () => `
    <div class="selector-mes">
      <button type="button" class="boton-icono" data-accion="mes-anterior" aria-label="Mes anterior">${ico('izq')}</button>
      <span>${B.nombreMes(B.ui.mes)}</span>
      <button type="button" class="boton-icono" data-accion="mes-siguiente" aria-label="Mes siguiente" ${B.ui.mes >= B.mesActual() ? 'disabled' : ''}>${ico('der')}</button>
    </div>`;

  const vacio = (titulo, texto, boton = '') => `<div class="vacio"><strong>${titulo}</strong><p>${texto}</p>${boton}</div>`;
  const punto = color => `<span class="punto" style="--c:${color}"></span>`;
  const botonNuevo = `<button type="button" class="boton primario solo-escritorio" data-accion="nuevo-movimiento">${ico('mas')}<span>Nuevo movimiento</span></button>`;

  B.filaMov = m => {
    const cta = B.cuenta(m.cuentaId);
    const moneda = cta?.moneda || B.estado.ajustes.moneda;
    if (m.operacionId) {
      const op = B.operacion && B.operacion(m.operacionId);
      const a = op && B.activo(op.activoId);
      const venta = !m.cuentaId;
      const ctaDin = B.cuenta(venta ? m.cuentaDestinoId : m.cuentaId);
      return `<button type="button" class="mov" data-accion="${op ? 'editar-operacion' : 'editar-mov'}" data-id="${op ? op.id : m.id}">
        ${a ? B.icoActivo(a) : `<span class="mov-ico" style="--c:var(--muted)">${ico('inversiones')}</span>`}
        <span class="mov-txt"><strong>${esc(m.nota || 'Inversión')}</strong><small>${venta ? `Inversiones → ${esc(ctaDin?.nombre || '?')}` : `${esc(ctaDin?.nombre || '?')} → Inversiones`}</small></span>
        <span class="mov-imp num neutro">${venta ? '+' : '−'}${B.dinero(m.importe, ctaDin?.moneda)}</span>
      </button>`;
    }
    if (m.tipo === 'transferencia') {
      const dest = B.cuenta(m.cuentaDestinoId);
      return `<button type="button" class="mov" data-accion="editar-mov" data-id="${m.id}">
        <span class="mov-ico" style="--c:var(--muted)">${ico('transferir')}</span>
        <span class="mov-txt"><strong>${esc(m.nota || 'Transferencia')}</strong><small>${esc(cta?.nombre || '?')} → ${esc(dest?.nombre || '?')}</small></span>
        <span class="mov-imp neutro num">${B.dinero(m.importe, moneda)}</span>
      </button>`;
    }
    const cat = B.categoria(m.categoriaId) || { nombre: 'Sin categoría', color: '#6b7385' };
    const ing = m.tipo === 'ingreso';
    return `<button type="button" class="mov" data-accion="editar-mov" data-id="${m.id}">
      <span class="mov-ico" style="--c:${cat.color}">${esc(cat.nombre.charAt(0))}</span>
      <span class="mov-txt"><strong>${esc(m.nota || cat.nombre)}</strong><small>${esc(cat.nombre)} · ${esc(cta?.nombre || '?')}</small></span>
      <span class="mov-imp num ${ing ? 'pos' : ''}">${ing ? '+' : '−'}${B.dinero(m.importe, moneda)}</span>
    </button>`;
  };

  const estadoPres = pct => pct >= 1 ? 'mal' : pct >= 0.85 ? 'aviso' : 'ok';

  const filaPresupuesto = (p, mes, completa) => {
    const cat = B.categoria(p.categoriaId);
    if (!cat) return '';
    const g = B.gastoCategoria(p.categoriaId, mes);
    const pct = p.limite > 0 ? g / p.limite : 0;
    const est = estadoPres(pct);
    return `<div class="pres">
      <div class="pres-fila">
        <span class="pres-nombre">${punto(cat.color)}<span>${esc(cat.nombre)}</span></span>
        <span class="pres-cifras num"><b>${B.dinero(g, null, { sinDecimales: true })}</b> de ${B.dinero(p.limite, null, { sinDecimales: true })}</span>
        ${completa ? `<button type="button" class="boton-icono pequeno" data-accion="editar-presupuesto" data-id="${p.id}" aria-label="Editar presupuesto de ${esc(cat.nombre)}">${ico('editar')}</button>` : ''}
      </div>
      <div class="progreso ${est}"><i style="width:${(Math.min(pct, 1) * 100).toFixed(1)}%"></i></div>
      ${completa ? `<div class="pres-fila pres-pie">
        <span>${pct >= 1 ? `<span class="chip mal">Te has pasado ${B.dinero(g - p.limite)}</span>` : `Quedan <b class="num">${B.dinero(p.limite - g)}</b>`}</span>
        <span class="num">${Math.round(pct * 100)} %</span>
      </div>` : ''}
    </div>`;
  };

  const progresoMeta = m => {
    const pct = m.objetivo > 0 ? m.ahorrado / m.objetivo : 0;
    let ritmo = '';
    if (pct >= 1) ritmo = '<span class="chip ok">Conseguida</span>';
    else if (m.fechaLimite) {
      const hoy = new Date(), fin = new Date(m.fechaLimite + 'T00:00:00');
      const meses = (fin.getFullYear() - hoy.getFullYear()) * 12 + fin.getMonth() - hoy.getMonth();
      if (fin < hoy) ritmo = '<span class="chip mal">Fecha superada</span>';
      else ritmo = `Para llegar a tiempo: <b class="num">${B.dinero((m.objetivo - m.ahorrado) / Math.max(1, meses))}</b> al mes`;
    } else ritmo = `Faltan <b class="num">${B.dinero(m.objetivo - m.ahorrado)}</b>`;
    return { pct, ritmo };
  };

  /* ---------- Resumen ---------- */
  function inicio() {
    const e = B.estado, mes = B.ui.mes;
    const hoy = B.fechaDia(B.hoyISO(), true);
    if (!e.cuentas.length) {
      return {
        html: cabecera('Empecemos', 'Primero, añade dónde tienes el dinero.') +
          `<div class="tarjeta">${vacio('Todavía no tienes cuentas',
            'Añade tu cuenta del banco, la tarjeta o el efectivo. Después podrás registrar gastos o importar el extracto de tu banco.',
            '<button type="button" class="boton primario" data-accion="nueva-cuenta">Crear mi primera cuenta</button>')}</div>`,
      };
    }

    const r = B.resumenMes(mes), ant = B.resumenMes(B.sumarMes(mes, -1));
    const ahorro = r.ingresos - r.gastos;
    const tasa = r.ingresos > 0 ? Math.round(ahorro / r.ingresos * 100) : null;
    const varG = ant.gastos > 0 ? Math.round((r.gastos - ant.gastos) / ant.gastos * 100) : null;

    const kpis = `<section class="kpis" aria-label="Cifras del mes">
      <div class="tarjeta kpi destacado">
        <span class="kpi-etq">Patrimonio neto</span>
        <div class="kpi-valor num">${B.dinero(B.patrimonio())}</div>
        <div class="kpi-pie">${[e.activos.length ? 'Cuentas e inversiones' : `Tus ${e.cuentas.length} cuentas`, e.deudas.length ? 'menos deudas' : ''].filter(Boolean).join(', ')}, a día de hoy</div>
      </div>
      <div class="tarjeta kpi">
        <span class="kpi-etq">Ingresos</span>
        <div class="kpi-valor num pos">${B.dinero(r.ingresos)}</div>
        <div class="kpi-pie">${B.nombreMes(mes)}</div>
      </div>
      <div class="tarjeta kpi">
        <span class="kpi-etq">Gastos</span>
        <div class="kpi-valor num">${B.dinero(r.gastos)}</div>
        <div class="kpi-pie">${varG === null ? 'Sin datos del mes anterior' : `<span class="chip ${varG > 0 ? 'mal' : 'ok'}">${varG > 0 ? '+' : ''}${varG} %</span> respecto al mes anterior`}</div>
      </div>
      <div class="tarjeta kpi">
        <span class="kpi-etq">Ahorro del mes</span>
        <div class="kpi-valor num ${ahorro < 0 ? 'rojo' : ''}">${B.dinero(ahorro)}</div>
        <div class="kpi-pie">${tasa === null ? 'Sin ingresos este mes' : `<span class="chip ${tasa >= 20 ? 'ok' : tasa >= 0 ? 'aviso' : 'mal'}">${tasa} %</span> de lo que has ingresado`}</div>
      </div>
    </section>`;

    const alertas = e.presupuestos.map(p => ({ p, cat: B.categoria(p.categoriaId), g: B.gastoCategoria(p.categoriaId, mes) }))
      .filter(x => x.cat && x.p.limite > 0 && x.g >= x.p.limite * 0.85)
      .sort((a, b) => b.g / b.p.limite - a.g / a.p.limite);
    const pendientes = B.recurrentesPendientes();
    const itemsAlerta = alertas.map(({ p, cat, g }) => {
      const pasado = g >= p.limite;
      return `<a class="alerta ${pasado ? 'mal' : 'aviso'}" href="#presupuestos">${ico('alerta')}<span>${pasado
        ? `Te has pasado <b class="num">${B.dinero(g - p.limite)}</b> en ${esc(cat.nombre)}`
        : `Llevas el <b class="num">${Math.round(g / p.limite * 100)} %</b> del presupuesto de ${esc(cat.nombre)}`}</span></a>`;
    });
    if (pendientes.length) {
      itemsAlerta.unshift(`<a class="alerta aviso" href="#recurrentes">${ico('recurrentes')}<span>${pendientes.length === 1
        ? `Tienes que confirmar el importe de <b>${esc(pendientes[0].nombre)}</b>`
        : `Tienes <b>${pendientes.length} pagos recurrentes</b> por confirmar`}</span></a>`);
    }
    const htmlAlertas = itemsAlerta.length ? `<div class="alertas">${itemsAlerta.join('')}</div>` : '';

    // Reparto de gastos
    const cats = Object.entries(r.porCategoria).map(([id, v]) => ({ cat: B.categoria(id), v }))
      .filter(x => x.cat && x.v > 0).sort((a, b) => b.v - a.v);
    const segs = cats.slice(0, 6).map(x => ({ valor: x.v, color: x.cat.color, etiqueta: x.cat.nombre }));
    const resto = cats.slice(6).reduce((a, x) => a + x.v, 0);
    if (resto > 0) segs.push({ valor: resto, color: 'var(--faint)', etiqueta: 'Resto' });
    const reparto = `<section class="tarjeta s5">
      <div class="tarjeta-cab"><h2>¿En qué se va el dinero?</h2><a class="enlace" href="#movimientos">Ver movimientos</a></div>
      ${cats.length ? `<div class="donut-bloque">
        ${B.donut(segs, `<small>Gastado</small><strong class="num">${B.dinero(r.gastos, null, { sinDecimales: true })}</strong>`, 'Gastos por categoría')}
        <ul class="leyenda">${segs.map(s => `<li>${punto(s.color)}<span class="txt">${esc(s.etiqueta)}</span><span class="num">${B.dinero(s.valor, null, { sinDecimales: true })}</span><span class="pct num">${Math.round(s.valor / r.gastos * 100)} %</span></li>`).join('')}</ul>
      </div>` : vacio('Sin gastos este mes', 'Cuando registres gastos verás aquí en qué categorías se va tu dinero.')}
    </section>`;

    const meses = Array.from({ length: 6 }, (_, i) => B.sumarMes(mes, i - 5));
    const evolucion = `<section class="tarjeta s7">
      <div class="tarjeta-cab"><h2>Últimos 6 meses</h2>
        <div class="leyenda-mini"><span>${punto('var(--ok)')}Ingresos</span><span>${punto('var(--bad)')}Gastos</span><a class="enlace" href="#informes">Ver informes</a></div>
      </div>
      ${B.barras(meses.map(m => { const x = B.resumenMes(m); return { etiqueta: B.mesCorto(m), ingresos: x.ingresos, gastos: x.gastos, actual: m === mes }; }))}
    </section>`;

    const pres = e.presupuestos.filter(p => B.categoria(p.categoriaId))
      .map(p => ({ p, pct: p.limite ? B.gastoCategoria(p.categoriaId, mes) / p.limite : 0 }))
      .sort((a, b) => b.pct - a.pct).slice(0, 5);
    const presupuestos = `<section class="tarjeta s6">
      <div class="tarjeta-cab"><h2>Presupuestos</h2><a class="enlace" href="#presupuestos">Ver todos</a></div>
      ${pres.length ? `<div class="lista-pres">${pres.map(x => filaPresupuesto(x.p, mes, false)).join('')}</div>`
        : vacio('Sin presupuestos', 'Pon un límite al mes por categoría y te avisaremos al acercarte.', '<button type="button" class="boton pequeno" data-accion="nuevo-presupuesto">Crear presupuesto</button>')}
    </section>`;

    const metas = `<section class="tarjeta s6">
      <div class="tarjeta-cab"><h2>Metas de ahorro</h2><a class="enlace" href="#metas">Ver todas</a></div>
      ${e.metas.length ? `<div class="lista-metas">${e.metas.slice(0, 4).map(m => {
        const { pct } = progresoMeta(m);
        return `<div class="meta-mini">
          <div class="pres-fila"><span class="pres-nombre">${punto(m.color)}<span>${esc(m.nombre)}</span></span><span class="num pres-cifras"><b>${Math.round(pct * 100)} %</b></span></div>
          <div class="progreso"><i style="width:${(Math.min(pct, 1) * 100).toFixed(1)}%;--c:${m.color}"></i></div>
          <small class="sub num">${B.dinero(m.ahorrado, null, { sinDecimales: true })} de ${B.dinero(m.objetivo, null, { sinDecimales: true })}</small>
        </div>`;
      }).join('')}</div>` : vacio('Sin metas todavía', 'Un viaje, un coche o un colchón para imprevistos.', '<button type="button" class="boton pequeno" data-accion="nueva-meta">Crear meta</button>')}
    </section>`;

    const ultimos = e.movimientos.map((m, i) => ({ m, i })).filter(x => x.m.fecha.startsWith(mes))
      .sort((a, b) => b.m.fecha.localeCompare(a.m.fecha) || b.i - a.i).slice(0, 7).map(x => x.m);
    const recientes = `<section class="tarjeta s7">
      <div class="tarjeta-cab"><h2>Últimos movimientos</h2><a class="enlace" href="#movimientos">Ver todos</a></div>
      ${ultimos.length ? `<div class="lista">${ultimos.map(B.filaMov).join('')}</div>`
        : vacio('Nada registrado este mes', 'Añade un gasto o importa el extracto de tu banco.', '<button type="button" class="boton pequeno" data-accion="importar">Importar extracto</button>')}
    </section>`;

    const prox = B.proximosRecurrentes(30).slice(0, 6);
    const proximos = `<section class="tarjeta s5">
      <div class="tarjeta-cab"><h2>Próximos 30 días</h2><a class="enlace" href="#recurrentes">Ver recurrentes</a></div>
      ${prox.length ? `<div class="lista">${prox.map(B.filaProximo).join('')}</div>`
        : vacio('Nada programado', 'Añade tus pagos fijos (alquiler, suscripciones) y verás aquí lo que viene.', '<button type="button" class="boton pequeno" data-accion="nuevo-recurrente">Añadir recurrente</button>')}
    </section>`;

    const cuentas = `<section class="tarjeta s7">
      <div class="tarjeta-cab"><h2>Cuentas</h2><a class="enlace" href="#cuentas">Gestionar</a></div>
      <div class="lista-cuentas">${e.cuentas.map(c => {
        const s = B.saldo(c.id);
        return `<a class="cuenta-mini" href="#cuentas">
          <span class="mov-ico" style="--c:${c.color}">${ico(c.tipo)}</span>
          <span class="mov-txt"><strong>${esc(c.nombre)}</strong><small>${B.TIPOS_CUENTA[c.tipo] || ''}</small></span>
          <span class="num mov-imp ${s < 0 ? 'rojo' : ''}">${B.dinero(s, c.moneda)}</span>
        </a>`;
      }).join('')}</div>
    </section>`;

    return {
      html: cabecera('Resumen', hoy, B.selectorMes() + botonNuevo) + htmlAlertas + kpis +
        `<div class="rejilla">${reparto}${evolucion}${presupuestos}${metas}${recientes}${proximos}${cuentas}${B.tarjetaInversionesInicio ? B.tarjetaInversionesInicio() : ''}</div>`,
    };
  }

  /* ---------- Movimientos ---------- */
  function listaMovimientos() {
    const e = B.estado, f = B.ui.filtros, q = B.norm(f.texto);
    const lista = e.movimientos.map((m, i) => ({ m, i })).filter(({ m }) => {
      if (!m.fecha.startsWith(B.ui.mes)) return false;
      if (f.tipo && m.tipo !== f.tipo) return false;
      if (f.cuenta && m.cuentaId !== f.cuenta && m.cuentaDestinoId !== f.cuenta) return false;
      if (f.categoria && m.categoriaId !== f.categoria) return false;
      if (q && !B.norm(`${m.nota || ''} ${B.categoria(m.categoriaId)?.nombre || ''}`).includes(q)) return false;
      return true;
    }).sort((a, b) => b.m.fecha.localeCompare(a.m.fecha) || b.i - a.i).map(x => x.m);

    if (!lista.length) {
      const hayFiltros = f.texto || f.tipo || f.cuenta || f.categoria;
      return vacio(hayFiltros ? 'Ningún movimiento coincide' : 'Sin movimientos este mes',
        hayFiltros ? 'Prueba a quitar algún filtro o a cambiar de mes.' : 'Añade uno a mano o importa el extracto de tu banco.',
        hayFiltros ? '<button type="button" class="boton pequeno" data-accion="limpiar-filtros">Quitar filtros</button>' : '<button type="button" class="boton pequeno" data-accion="importar">Importar extracto</button>');
    }

    let ing = 0, gas = 0;
    lista.forEach(m => {
      if (m.tipo === 'transferencia') return;
      const v = B.aPrincipal(m.importe, B.monedaMov(m));
      if (m.tipo === 'ingreso') ing += v; else gas += v;
    });
    const grupos = [];
    lista.forEach(m => {
      const g = grupos[grupos.length - 1];
      if (g && g.fecha === m.fecha) g.items.push(m); else grupos.push({ fecha: m.fecha, items: [m] });
    });
    return `<div class="lista-resumen">
        <span>${lista.length} movimiento${lista.length === 1 ? '' : 's'}</span>
        <span class="num pos">+${B.dinero(ing)}</span>
        <span class="num">−${B.dinero(gas)}</span>
      </div>
      ${grupos.map(g => {
        const neto = g.items.reduce((a, m) => m.tipo === 'transferencia' ? a : a + (m.tipo === 'ingreso' ? 1 : -1) * B.aPrincipal(m.importe, B.monedaMov(m)), 0);
        return `<div class="dia">
          <div class="dia-cab"><span>${B.fechaDia(g.fecha)}</span><span class="num">${neto ? (neto > 0 ? '+' : '−') + B.dinero(Math.abs(neto)) : ''}</span></div>
          <div class="lista">${g.items.map(B.filaMov).join('')}</div>
        </div>`;
      }).join('')}`;
  }

  function movimientos() {
    const e = B.estado, f = B.ui.filtros;
    const op = (v, t, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(t)}</option>`;
    const html = cabecera('Movimientos', 'Ingresos, gastos y transferencias entre tus cuentas.',
      `<button type="button" class="boton" data-accion="importar">${ico('importar')}<span>Importar extracto</span></button>${botonNuevo}`) +
      `<div class="filtros">
        ${B.selectorMes()}
        <label class="buscar">${ico('buscar')}<input id="flt-texto" class="entrada" type="search" placeholder="Buscar concepto o categoría" value="${esc(f.texto)}" aria-label="Buscar"></label>
        <select id="flt-tipo" class="entrada" aria-label="Tipo">
          ${op('', 'Todos los tipos', f.tipo)}${op('gasto', 'Gastos', f.tipo)}${op('ingreso', 'Ingresos', f.tipo)}${op('transferencia', 'Transferencias', f.tipo)}
        </select>
        <select id="flt-cuenta" class="entrada" aria-label="Cuenta">${op('', 'Todas las cuentas', f.cuenta)}${e.cuentas.map(c => op(c.id, c.nombre, f.cuenta)).join('')}</select>
        <select id="flt-cat" class="entrada" aria-label="Categoría">${op('', 'Todas las categorías', f.categoria)}${e.categorias.map(c => op(c.id, c.nombre, f.categoria)).join('')}</select>
      </div>
      <section class="tarjeta lista-movs" id="lista-movs">${listaMovimientos()}</section>`;
    return {
      html,
      alMontar(raiz) {
        const pintar = () => { raiz.querySelector('#lista-movs').innerHTML = listaMovimientos(); };
        raiz.querySelector('#flt-texto').addEventListener('input', ev => { f.texto = ev.target.value; pintar(); });
        [['#flt-tipo', 'tipo'], ['#flt-cuenta', 'cuenta'], ['#flt-cat', 'categoria']].forEach(([sel, k]) =>
          raiz.querySelector(sel).addEventListener('change', ev => { f[k] = ev.target.value; pintar(); }));
      },
    };
  }

  /* ---------- Cuentas ---------- */
  function cuentas() {
    const e = B.estado, mes = B.mesActual(), mon = e.ajustes.moneda;
    const acciones = `${e.cuentas.length > 1 ? `<button type="button" class="boton" data-accion="transferir">${ico('transferir')}<span>Transferir</span></button>` : ''}
      <button type="button" class="boton primario" data-accion="nueva-cuenta">${ico('mas')}<span>Nueva cuenta</span></button>`;
    if (!e.cuentas.length) {
      return { html: cabecera('Cuentas', 'Dónde tienes el dinero.', acciones) + `<div class="tarjeta">${vacio('Sin cuentas', 'Crea tu primera cuenta para empezar a registrar movimientos.')}</div>` };
    }
    let activos = 0, deudas = 0;
    e.cuentas.forEach(c => { const v = B.aPrincipal(B.saldo(c.id), c.moneda); if (v >= 0) activos += v; else deudas += v; });

    const tarjetas = e.cuentas.map(c => {
      const s = B.saldo(c.id);
      let ent = 0, sal = 0;
      e.movimientos.forEach(m => {
        if (!m.fecha.startsWith(mes)) return;
        if (m.cuentaId === c.id) { if (m.tipo === 'ingreso') ent += m.importe; else sal += m.importe; }
        if (m.tipo === 'transferencia' && m.cuentaDestinoId === c.id) ent += m.importeDestino ?? m.importe;
      });
      return `<article class="tarjeta cuenta">
        <div class="cuenta-cab">
          <span class="mov-ico" style="--c:${c.color}">${ico(c.tipo)}</span>
          <div class="mov-txt"><strong>${esc(c.nombre)}</strong><small>${B.TIPOS_CUENTA[c.tipo] || ''} · ${c.moneda}</small></div>
          <button type="button" class="boton-icono" data-accion="editar-cuenta" data-id="${c.id}" aria-label="Editar ${esc(c.nombre)}">${ico('editar')}</button>
        </div>
        <div class="cuenta-saldo num ${s < 0 ? 'rojo' : ''}">${B.dinero(s, c.moneda)}</div>
        <small class="sub num">${c.moneda !== mon ? `≈ ${B.dinero(B.convertir(s, c.moneda, mon), mon)}` : (c.tipo === 'tarjeta' && s < 0 ? 'Pendiente de pagar' : '&nbsp;')}</small>
        <div class="cuenta-pie">
          <span>Este mes</span>
          <span class="num pos">+${B.dinero(ent, c.moneda, { sinDecimales: true })}</span>
          <span class="num">−${B.dinero(sal, c.moneda, { sinDecimales: true })}</span>
          <button type="button" class="enlace" data-accion="ver-cuenta" data-id="${c.id}">Movimientos</button>
        </div>
      </article>`;
    }).join('');

    return {
      html: cabecera('Cuentas', 'Dónde tienes el dinero.', acciones) +
        `<section class="kpis tres">
          <div class="tarjeta kpi destacado"><span class="kpi-etq">Saldo de tus cuentas</span><div class="kpi-valor num">${B.dinero(activos + deudas)}</div></div>
          <div class="tarjeta kpi"><span class="kpi-etq">Lo que tienes</span><div class="kpi-valor num pos">${B.dinero(activos)}</div></div>
          <div class="tarjeta kpi"><span class="kpi-etq">En negativo</span><div class="kpi-valor num ${deudas < 0 ? 'rojo' : ''}">${B.dinero(Math.abs(deudas))}</div><div class="kpi-pie">Tarjetas y descubiertos</div></div>
        </section>
        <div class="cuentas">${tarjetas}</div>
        ${e.cuentas.some(c => c.moneda !== mon) ? `<p class="nota">Las cuentas en otra moneda se suman al total con el cambio 1 US$ = ${B.aInput(e.ajustes.tasa)} €. Puedes ajustarlo en <a href="#ajustes">Ajustes</a>.</p>` : ''}`,
    };
  }

  /* ---------- Presupuestos ---------- */
  function presupuestos() {
    const e = B.estado, mes = B.ui.mes;
    const acciones = B.selectorMes() + `<button type="button" class="boton primario" data-accion="nuevo-presupuesto">${ico('mas')}<span>Nuevo</span></button>`;
    const lista = e.presupuestos.filter(p => B.categoria(p.categoriaId))
      .map(p => ({ p, g: B.gastoCategoria(p.categoriaId, mes) }))
      .sort((a, b) => b.g / (b.p.limite || 1) - a.g / (a.p.limite || 1));

    if (!lista.length) {
      return { html: cabecera('Presupuestos', 'Un límite mensual por categoría.', acciones) + `<div class="tarjeta">${vacio('Aún no tienes presupuestos', 'Elige una categoría, por ejemplo Restaurantes, y ponle un límite al mes. Te avisaremos en el resumen cuando te acerques.', '<button type="button" class="boton primario" data-accion="nuevo-presupuesto">Crear presupuesto</button>')}</div>` };
    }

    const limite = lista.reduce((a, x) => a + x.p.limite, 0);
    const gastado = lista.reduce((a, x) => a + x.g, 0);
    const pct = limite ? gastado / limite : 0;
    let ritmo = '';
    if (mes === B.mesActual()) {
      const quedan = B.diasDelMes(mes) - new Date().getDate() + 1;
      ritmo = gastado < limite
        ? `Puedes gastar <b class="num">${B.dinero((limite - gastado) / quedan)}</b> al día durante los ${quedan} días que quedan.`
        : 'Has superado el total presupuestado para este mes.';
    } else ritmo = gastado <= limite ? 'Mes cerrado dentro del presupuesto.' : `Mes cerrado con <b class="num">${B.dinero(gastado - limite)}</b> por encima.`;

    const sinPres = Object.entries(B.resumenMes(mes).porCategoria)
      .filter(([id, v]) => v > 0 && !e.presupuestos.some(p => p.categoriaId === id) && B.categoria(id))
      .sort((a, b) => b[1] - a[1]);

    return {
      html: cabecera('Presupuestos', 'Un límite mensual por categoría.', acciones) +
        `<section class="tarjeta total-pres">
          <div class="pres-fila"><span class="kpi-etq">Total de ${B.nombreMes(mes).toLowerCase()}</span><span class="chip ${estadoPres(pct)}">${Math.round(pct * 100)} %</span></div>
          <div class="kpi-valor num">${B.dinero(gastado)} <span class="de">de ${B.dinero(limite)}</span></div>
          <div class="progreso grande ${estadoPres(pct)}"><i style="width:${(Math.min(pct, 1) * 100).toFixed(1)}%"></i></div>
          <p class="sub">${ritmo}</p>
        </section>
        <div class="rejilla">
          <section class="tarjeta s8"><div class="tarjeta-cab"><h2>Por categoría</h2></div><div class="lista-pres">${lista.map(x => filaPresupuesto(x.p, mes, true)).join('')}</div></section>
          <section class="tarjeta s4"><div class="tarjeta-cab"><h2>Gastos sin presupuesto</h2></div>
            ${sinPres.length ? `<div class="lista-simple">${sinPres.map(([id, v]) => {
              const c = B.categoria(id);
              return `<div class="fila-simple">${punto(c.color)}<span class="txt">${esc(c.nombre)}</span><span class="num">${B.dinero(v, null, { sinDecimales: true })}</span><button type="button" class="boton pequeno" data-accion="nuevo-presupuesto" data-cat="${id}">Limitar</button></div>`;
            }).join('')}</div>` : '<p class="sub">Todos tus gastos de este mes tienen presupuesto.</p>'}
          </section>
        </div>`,
    };
  }

  /* ---------- Metas ---------- */
  function metas() {
    const e = B.estado;
    const acciones = `<button type="button" class="boton primario" data-accion="nueva-meta">${ico('mas')}<span>Nueva meta</span></button>`;
    if (!e.metas.length) {
      return { html: cabecera('Metas de ahorro', 'Lo que quieres conseguir y cuánto te falta.', acciones) + `<div class="tarjeta">${vacio('Sin metas todavía', 'Crea una meta con su importe y una fecha. Te diremos cuánto apartar cada mes para llegar.', '<button type="button" class="boton primario" data-accion="nueva-meta">Crear meta</button>')}</div>` };
    }
    const total = e.metas.reduce((a, m) => a + Number(m.ahorrado || 0), 0);
    const objetivo = e.metas.reduce((a, m) => a + Number(m.objetivo || 0), 0);
    return {
      html: cabecera('Metas de ahorro', `Llevas ${B.dinero(total, null, { sinDecimales: true })} de ${B.dinero(objetivo, null, { sinDecimales: true })} entre todas tus metas.`, acciones) +
        `<div class="metas">${e.metas.map(m => {
          const { pct, ritmo } = progresoMeta(m);
          return `<article class="tarjeta meta">
            <div class="meta-cab">
              <div class="meta-anillo">${B.anillo(pct, m.color)}<span class="num">${Math.round(pct * 100)}%</span></div>
              <div class="mov-txt"><strong>${esc(m.nombre)}</strong><small>${m.fechaLimite ? 'Para el ' + B.fechaLarga(m.fechaLimite) : 'Sin fecha límite'}</small></div>
              <button type="button" class="boton-icono" data-accion="editar-meta" data-id="${m.id}" aria-label="Editar ${esc(m.nombre)}">${ico('editar')}</button>
            </div>
            <div class="meta-cifras num"><b>${B.dinero(m.ahorrado)}</b><span>de ${B.dinero(m.objetivo)}</span></div>
            <div class="progreso"><i style="width:${(Math.min(pct, 1) * 100).toFixed(1)}%;--c:${m.color}"></i></div>
            <p class="sub">${ritmo}</p>
            <button type="button" class="boton pequeno" data-accion="aportar-meta" data-id="${m.id}">Añadir o retirar dinero</button>
          </article>`;
        }).join('')}</div>`,
    };
  }

  /* ---------- Ajustes ---------- */
  function ajustes() {
    const e = B.estado, a = e.ajustes;
    const seg = (nombre, valor, opciones) => `<div class="segmentado" role="radiogroup">${opciones.map(([v, t]) =>
      `<label><input type="radio" name="${nombre}" value="${v}" ${v === valor ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>`;
    const listaCats = tipo => e.categorias.filter(c => c.tipo === tipo).map(c =>
      `<button type="button" class="cat-item" data-accion="editar-categoria" data-id="${c.id}">${punto(c.color)}<span>${esc(c.nombre)}</span></button>`).join('');
    const reglas = [...e.reglas].sort((x, y) => (B.categoria(x.categoriaId)?.nombre || '').localeCompare(B.categoria(y.categoriaId)?.nombre || '') || x.texto.localeCompare(y.texto));
    const catsOpc = e.categorias.map(c => `<option value="${c.id}">${esc(c.nombre)} (${c.tipo})</option>`).join('');

    return {
      html: cabecera('Ajustes', 'Moneda, apariencia, categorías y tus datos.') +
        `<div class="ajustes">
          <section class="tarjeta">
            <div class="tarjeta-cab"><h2>General</h2></div>
            <div class="ajuste">
              <div><strong>Moneda principal</strong><p class="sub">Los totales y presupuestos se muestran en esta moneda.</p></div>
              ${seg('aj-moneda', a.moneda, [['EUR', 'Euro (€)'], ['USD', 'Dólar ($)']])}
            </div>
            <div class="ajuste">
              <div><strong>Tipo de cambio</strong><p class="sub">Para sumar cuentas en dólares y euros. Actualízalo cuando quieras.</p></div>
              <div class="cambio-bloque">
                <label class="cambio"><span>1 US$ =</span><input id="aj-tasa" class="entrada num" inputmode="decimal" value="${B.aInput(a.tasa)}" aria-label="Euros por dólar" ${a.tasaAuto !== false ? 'disabled' : ''}><span>€</span></label>
                <label class="check"><input type="checkbox" id="aj-tasa-auto" ${a.tasaAuto !== false ? 'checked' : ''}> Automático (BCE)${a.fx?.fecha ? ` · ${B.fechaCorta(a.fx.fecha)}` : ''}</label>
              </div>
            </div>
            <div class="ajuste">
              <div><strong>Precios en vivo</strong><p class="sub">Criptomonedas: CoinGecko, sin clave. Acciones, ETF e índices: Twelve Data, con tu clave gratuita.</p></div>
              <div class="botonera sin-margen">
                <button type="button" class="boton pequeno" data-accion="clave-twelve">${a.claveTwelve ? 'Clave de Twelve Data ✓' : 'Añadir clave de Twelve Data'}</button>
                <button type="button" class="boton pequeno" data-accion="actualizar-precios">Actualizar ahora</button>
              </div>
            </div>
            <div class="ajuste">
              <div><strong>Apariencia</strong><p class="sub">«Sistema» sigue el modo claro u oscuro de tu dispositivo.</p></div>
              ${seg('aj-tema', a.tema, [['oscuro', 'Oscuro'], ['claro', 'Claro'], ['sistema', 'Sistema']])}
            </div>
          </section>

          <section class="tarjeta">
            <div class="tarjeta-cab"><h2>Categorías</h2><button type="button" class="boton pequeno" data-accion="nueva-categoria">${ico('mas')}<span>Nueva</span></button></div>
            <h3 class="mini-tit">Gastos</h3><div class="cats">${listaCats('gasto')}</div>
            <h3 class="mini-tit">Ingresos</h3><div class="cats">${listaCats('ingreso')}</div>
          </section>

          <section class="tarjeta">
            <div class="tarjeta-cab"><h2>Reglas de importación</h2></div>
            <p class="sub">Si el concepto del extracto contiene este texto, el movimiento se clasifica en esa categoría. También se usan al escribir un concepto a mano.</p>
            <form class="regla-nueva" id="aj-regla">
              <input id="aj-regla-texto" class="entrada" placeholder="Texto, p. ej. «gimnasio»" maxlength="40" aria-label="Texto de la regla">
              <select id="aj-regla-cat" class="entrada" aria-label="Categoría">${catsOpc}</select>
              <button type="submit" class="boton">Añadir regla</button>
            </form>
            <div class="reglas">${reglas.map(r => {
              const c = B.categoria(r.categoriaId);
              return c ? `<span class="regla">${esc(r.texto)} <span class="flecha">→</span> ${punto(c.color)}${esc(c.nombre)}<button type="button" class="regla-x" data-accion="borrar-regla" data-id="${r.id}" aria-label="Borrar regla ${esc(r.texto)}">${ico('cerrar')}</button></span>` : '';
            }).join('')}</div>
          </section>

          <section class="tarjeta" id="aj-sync">
            <div class="tarjeta-cab"><h2>Sincronizar móvil y ordenador</h2></div>
            <div id="aj-sync-cuerpo">${B.tarjetaSync ? B.tarjetaSync() : ''}</div>
          </section>

          <section class="tarjeta">
            <div class="tarjeta-cab"><h2>Bloqueo con PIN</h2></div>
            ${B.tarjetaBloqueo ? B.tarjetaBloqueo() : ''}
          </section>

          <section class="tarjeta">
            <div class="tarjeta-cab"><h2>Tus datos</h2></div>
            <p class="sub">${B.sync?.cfg ? 'Tus datos se guardan en este navegador y, cifrados, en tu cuenta de GitHub para sincronizarlos. Aun así, una copia de vez en cuando nunca está de más.' : 'Todo se guarda solo en este navegador y no se envía a ningún servidor. Haz una copia de vez en cuando; también te sirve para pasar tus datos del ordenador al móvil.'}</p>
            <div class="botonera">
              <button type="button" class="boton" data-accion="exportar">${ico('exportar')}<span>Hacer copia</span></button>
              <button type="button" class="boton" data-accion="restaurar">${ico('importar')}<span>Restaurar copia</span></button>
              <button type="button" class="boton" data-accion="cargar-ejemplo">Cargar datos de ejemplo</button>
              <button type="button" class="boton peligro" data-accion="borrar-todo">Borrar todos los datos</button>
            </div>
          </section>
        </div>`,
      alMontar(raiz) {
        raiz.querySelectorAll('input[name=aj-moneda]').forEach(r => r.addEventListener('change', () => {
          a.moneda = r.value; B.guardar(); B.aviso(`Moneda principal: ${r.value === 'EUR' ? 'euro' : 'dólar'}`);
        }));
        raiz.querySelectorAll('input[name=aj-tema]').forEach(r => r.addEventListener('change', () => {
          a.tema = r.value; B.guardar(); B.aplicarTema();
        }));
        if (B.montarAjustesBloqueo) B.montarAjustesBloqueo(raiz);
        raiz.querySelector('#aj-tasa-auto').addEventListener('change', ev => {
          a.tasaAuto = ev.target.checked; B.guardar();
          raiz.querySelector('#aj-tasa').disabled = ev.target.checked;
          if (ev.target.checked) { if (a.fx) a.fx.at = 0; B.actualizarPrecios({ forzar: true }).then(() => { if (location.hash === '#ajustes') B.render(); }); }
          B.aviso(ev.target.checked ? 'El tipo de cambio se actualizará solo con el del BCE' : 'Ahora puedes poner el tipo de cambio a mano');
        });
        raiz.querySelector('#aj-tasa').addEventListener('change', ev => {
          const n = B.numero(ev.target.value);
          if (!isFinite(n) || n <= 0) { ev.target.value = B.aInput(a.tasa); B.aviso('Escribe un número mayor que cero, por ejemplo 0,92'); return; }
          a.tasa = n; B.guardar(); B.aviso('Tipo de cambio actualizado');
        });
        raiz.querySelector('#aj-regla').addEventListener('submit', ev => {
          ev.preventDefault();
          const texto = raiz.querySelector('#aj-regla-texto').value.trim();
          if (!texto) { B.aviso('Escribe el texto que debe contener el concepto'); return; }
          B.guardarRegla({ id: B.uid(), texto: texto.toLowerCase(), categoriaId: raiz.querySelector('#aj-regla-cat').value });
          B.render(); B.aviso('Regla añadida');
        });
      },
    };
  }

  /* ---------- Hoja de ruta ---------- */
  const FASES = [
    ['Fase 1 · Base', [['Cuentas en euros y dólares', 1], ['Gastos, ingresos y transferencias', 1], ['Categorías a tu medida', 1], ['Resumen con gráficas', 1]]],
    ['Fase 2 · Control', [['Presupuestos mensuales con avisos', 1], ['Importar el extracto del banco', 1], ['Movimientos recurrentes (alquiler, suscripciones)', 1]]],
    ['Fase 3 · Ahorro', [['Metas de ahorro', 1], ['Deudas y préstamos con plan de pago', 1]]],
    ['Fase 4 · Análisis', [['Informes por mes y por año', 1], ['Comparativas y tendencias', 1], ['Exportar a Excel', 1]]],
    ['Fase 5 · Extras', [['Modo oscuro y claro', 1], ['Inversiones y rentabilidad', 1], ['Precios en vivo: cripto, bolsa y divisas', 1], ['Sincronizar móvil y ordenador (cifrado)', 1], ['Bloqueo con PIN y Face ID o huella', 1], ['App instalable en el móvil', 1]]],
  ];
  function ruta() {
    return {
      html: cabecera('Hoja de ruta', `Qué tiene ya Bolsillo y qué viene después · versión ${B.VERSION}`) +
        `<div class="fases">${FASES.map(([titulo, items]) => {
          const hechos = items.filter(i => i[1]).length;
          const est = hechos === items.length ? ['ok', 'Hecho'] : hechos ? ['acento', 'En curso'] : ['', 'Pendiente'];
          return `<section class="tarjeta fase">
            <div class="tarjeta-cab"><h2>${titulo}</h2><span class="chip ${est[0]}">${est[1]}</span></div>
            <ul>${items.map(([t, ok]) => `<li class="${ok ? 'hecho' : ''}">${ok ? ico('check') : '<span class="pendiente"></span>'}<span>${t}</span></li>`).join('')}</ul>
          </section>`;
        }).join('')}</div>`,
    };
  }

  /* ---------- Recurrentes ---------- */
  const claseImporte = t => t === 'ingreso' ? 'pos' : t === 'transferencia' || t === 'inversion' ? 'neutro' : '';
  const signoTipo = t => t === 'ingreso' ? '+' : t === 'gasto' || t === 'inversion' ? '−' : '';
  const icoRec = r => {
    if (r.tipo === 'inversion') { const a = B.activo(r.activoId); return a ? B.icoActivo(a) : `<span class="mov-ico" style="--c:var(--muted)">${ico('inversiones')}</span>`; }
    const cat = r.tipo === 'transferencia' ? null : B.categoria(r.categoriaId);
    return cat ? `<span class="mov-ico" style="--c:${cat.color}">${esc(cat.nombre.charAt(0))}</span>` : `<span class="mov-ico" style="--c:var(--muted)">${ico('transferir')}</span>`;
  };
  B.filaRecurrente = (r, sub, extra = '') => {
    const cta = B.cuenta(r.cuentaId);
    return `<button type="button" class="mov ${r.activo ? '' : 'pausado'}" data-accion="editar-recurrente" data-id="${r.id}">
      ${icoRec(r)}
      <span class="mov-txt"><strong>${esc(r.nombre)}</strong><small>${sub}</small></span>
      <span class="mov-der">${extra}<span class="mov-imp num ${claseImporte(r.tipo)}">${signoTipo(r.tipo)}${B.dinero(r.importe, cta?.moneda)}</span></span>
    </button>`;
  };
  B.filaProximo = ({ r, fecha }) => B.filaRecurrente(r,
    `${fecha <= B.hoyISO() ? '<span class="chip aviso">Por confirmar</span>' : B.fechaDia(fecha)} · ${esc(B.cuenta(r.cuentaId)?.nombre || '?')}`);

  function recurrentes() {
    const e = B.estado, hoy = B.hoyISO();
    const acciones = `<button type="button" class="boton primario" data-accion="nuevo-recurrente">${ico('mas')}<span>Nuevo recurrente</span></button>`;
    const cab = cabecera('Recurrentes', 'Pagos y cobros que se repiten: alquiler, nómina, suscripciones, seguros.', acciones);
    if (!e.recurrentes.length) {
      return { html: cab + `<div class="tarjeta">${vacio('Sin recurrentes', 'Añade el alquiler, la nómina o tus suscripciones. Se apuntan solos en su fecha o, si el importe cambia cada vez (como la luz), te pedimos confirmarlo.', '<button type="button" class="boton primario" data-accion="nuevo-recurrente">Crear recurrente</button>')}</div>` };
    }
    const gastos = B.fijoMensual('gasto'), ingresos = B.fijoMensual('ingreso'), margen = ingresos - gastos;
    const pend = B.recurrentesPendientes();
    const prox = B.proximosRecurrentes(30).filter(x => x.fecha > hoy);
    const todos = [...e.recurrentes].sort((a, b) => (b.activo - a.activo) || a.proxima.localeCompare(b.proxima));

    const htmlPend = pend.length ? `<section class="tarjeta por-confirmar">
        <div class="tarjeta-cab"><h2>Por confirmar</h2><span class="chip aviso">${pend.length}</span></div>
        <p class="sub">Estos cargos no se apuntan solos porque el importe puede variar. Revisa la cantidad y regístralos.</p>
        <div class="lista">${pend.map(r => `<div class="pend">
          ${B.filaRecurrente(r, `Desde el ${B.fechaLarga(r.proxima)} · ${esc(B.cuenta(r.cuentaId)?.nombre || '?')}`)}
          <div class="pend-acciones">
            <button type="button" class="boton pequeno" data-accion="saltar-recurrente" data-id="${r.id}">Saltar esta vez</button>
            <button type="button" class="boton pequeno primario" data-accion="confirmar-recurrente" data-id="${r.id}">Registrar</button>
          </div>
        </div>`).join('')}</div>
      </section>` : '';

    return {
      html: cab + `
        <section class="kpis tres">
          <div class="tarjeta kpi"><span class="kpi-etq">Ingresos fijos al mes</span><div class="kpi-valor num pos">${B.dinero(ingresos)}</div></div>
          <div class="tarjeta kpi"><span class="kpi-etq">Gastos fijos al mes</span><div class="kpi-valor num">${B.dinero(gastos)}</div><div class="kpi-pie">${ingresos > 0 ? `${Math.round(gastos / ingresos * 100)} % de tus ingresos fijos` : 'Los anuales cuentan como 1/12'}</div></div>
          <div class="tarjeta kpi destacado"><span class="kpi-etq">Te queda libre</span><div class="kpi-valor num ${margen < 0 ? 'rojo' : ''}">${B.dinero(margen)}</div><div class="kpi-pie">Al mes, después de los fijos</div></div>
        </section>
        ${htmlPend}
        <div class="rejilla">
          <section class="tarjeta s5"><div class="tarjeta-cab"><h2>Próximos 30 días</h2></div>
            ${prox.length ? `<div class="lista">${prox.map(B.filaProximo).join('')}</div>` : '<p class="sub">Nada programado para los próximos 30 días.</p>'}
          </section>
          <section class="tarjeta s7"><div class="tarjeta-cab"><h2>Todos</h2><span class="sub">${e.recurrentes.length} en total</span></div>
            <div class="lista">${todos.map(r => B.filaRecurrente(r,
              `${B.FRECUENCIAS[r.frecuencia]} · ${r.activo ? `próximo ${B.fechaCorta(r.proxima)}${r.automatico ? '' : ' · se confirma'}` : 'en pausa'}`)).join('')}</div>
          </section>
        </div>`,
    };
  }

  /* ---------- Deudas ---------- */
  const tarjetaDeuda = d => {
    const mon = d.moneda || B.estado.ajustes.moneda;
    const pagado = d.total > 0 ? Math.max(0, Math.min(1, (d.total - d.pendiente) / d.total)) : 0;
    const plan = B.planDeuda(d);
    const debo = d.tipo === 'debo';
    let txt;
    if (plan?.terminada) txt = `<span class="chip ok">${debo ? 'Pagada' : 'Cobrada'}</span>`;
    else if (plan?.noCubre) txt = `<span class="chip mal">La cuota no cubre los intereses (${B.dinero(plan.interesMes, mon)} al mes)</span>`;
    else if (plan) txt = `${debo ? 'Terminas' : 'Te lo devuelven'} en <b>${B.nombreMes(plan.fin).toLowerCase()}</b> · ${plan.n} cuota${plan.n === 1 ? '' : 's'}${plan.intereses > 0.5 ? ` · unos <b class="num">${B.dinero(plan.intereses, mon, { sinDecimales: true })}</b> de intereses` : ''}`;
    else txt = debo ? 'Añade la cuota mensual para calcular cuándo terminas.' : 'Sin plazos acordados.';
    const automatica = B.estado.recurrentes.some(r => r.activo && r.deudaId === d.id);
    const datos = [
      d.interes > 0 ? `<span class="chip">${B.aInput(d.interes)} % interés</span>` : '',
      d.cuota > 0 ? `<span class="chip">${B.dinero(d.cuota, mon)} al mes</span>` : '',
      automatica ? `<span class="chip acento">${ico('recurrentes')}Cuota automática</span>` : '',
    ].join('');
    return `<article class="tarjeta meta deuda">
      <div class="meta-cab">
        <div class="meta-anillo">${B.anillo(pagado, d.color)}<span class="num">${Math.round(pagado * 100)}%</span></div>
        <div class="mov-txt"><strong>${esc(d.nombre)}</strong><small>${d.persona ? `${debo ? 'Con' : 'Te lo debe'} ${esc(d.persona)}` : (debo ? 'Lo que debes' : 'Lo que te deben')}</small></div>
        <button type="button" class="boton-icono" data-accion="editar-deuda" data-id="${d.id}" aria-label="Editar ${esc(d.nombre)}">${ico('editar')}</button>
      </div>
      <div class="meta-cifras num"><b class="${debo && d.pendiente > 0 ? 'rojo' : debo ? '' : 'pos'}">${B.dinero(d.pendiente, mon)}</b><span>pendiente de ${B.dinero(d.total, mon)}</span></div>
      <div class="progreso"><i style="width:${(pagado * 100).toFixed(1)}%;--c:${d.color}"></i></div>
      ${datos ? `<div class="deuda-datos">${datos}</div>` : ''}
      <p class="sub">${txt}</p>
      ${d.pendiente > 0 ? `<button type="button" class="boton pequeno" data-accion="pagar-deuda" data-id="${d.id}">${debo ? 'Registrar pago' : 'Registrar cobro'}</button>` : ''}
    </article>`;
  };

  function deudas() {
    const e = B.estado;
    const acciones = `<button type="button" class="boton primario" data-accion="nueva-deuda">${ico('mas')}<span>Nueva deuda</span></button>`;
    const cab = cabecera('Deudas y préstamos', 'Lo que debes, lo que te deben y cuándo queda saldado.', acciones);
    if (!e.deudas.length) {
      return { html: cab + `<div class="tarjeta">${vacio('Sin deudas registradas', 'Apunta un préstamo, la financiación de una compra o el dinero que le has dejado a alguien. Verás cuánto queda y cuándo terminas de pagarlo.', '<button type="button" class="boton primario" data-accion="nueva-deuda">Añadir deuda</button>')}</div>` };
    }
    const debo = e.deudas.filter(d => d.tipo === 'debo').sort((a, b) => (b.pendiente > 0) - (a.pendiente > 0) || b.pendiente - a.pendiente);
    const meDeben = e.deudas.filter(d => d.tipo === 'me-deben').sort((a, b) => (b.pendiente > 0) - (a.pendiente > 0) || b.pendiente - a.pendiente);
    const cuotas = debo.filter(d => d.pendiente > 0).reduce((a, d) => a + B.aPrincipal(d.cuota || 0, d.moneda || e.ajustes.moneda), 0);
    const caras = debo.filter(d => d.pendiente > 0 && d.interes > 0).sort((a, b) => b.interes - a.interes);
    const consejo = caras.length >= 2 ? `<div class="consejo">${ico('inversiones')}<p>Si un mes te sobra dinero, adelanta pagos de <b>${esc(caras[0].nombre)}</b>: es la que tiene el interés más alto (${B.aInput(caras[0].interes)} %). Así pagarás menos intereses en total.</p></div>` : '';
    return {
      html: cab + `
        <section class="kpis tres">
          <div class="tarjeta kpi"><span class="kpi-etq">Lo que debes</span><div class="kpi-valor num ${B.totalDeudas('debo') > 0 ? 'rojo' : ''}">${B.dinero(B.totalDeudas('debo'))}</div></div>
          <div class="tarjeta kpi"><span class="kpi-etq">Te deben</span><div class="kpi-valor num pos">${B.dinero(B.totalDeudas('me-deben'))}</div></div>
          <div class="tarjeta kpi"><span class="kpi-etq">Cuotas al mes</span><div class="kpi-valor num">${B.dinero(cuotas)}</div><div class="kpi-pie">Suma de las cuotas pendientes</div></div>
        </section>
        ${consejo}
        ${debo.length ? `<h2 class="seccion-tit">Lo que debes</h2><div class="metas">${debo.map(tarjetaDeuda).join('')}</div>` : ''}
        ${meDeben.length ? `<h2 class="seccion-tit">Lo que te deben</h2><div class="metas">${meDeben.map(tarjetaDeuda).join('')}</div>` : ''}
        <p class="nota">El patrimonio neto del Resumen ya descuenta lo que debes y suma lo que te deben. Si un préstamo ya lo llevas como cuenta (por ejemplo, una tarjeta de crédito), no lo apuntes también aquí.</p>`,
    };
  }

  B.vistas = { inicio, movimientos, cuentas, presupuestos, metas, recurrentes, deudas, ajustes, ruta };
})(window.B);
