/* Bolsillo · inversiones: posiciones, rentabilidad, historial y precios en vivo */
(function (B) {
  'use strict';

  B.TIPOS_ACTIVO = { cripto: 'Criptomoneda', accion: 'Acción', etf: 'ETF', fondo: 'Fondo', otro: 'Otro' };
  const ahora = () => new Date().toISOString();

  B.activo = id => B.estado.activos.find(a => a.id === id);
  B.operacion = id => B.estado.operaciones.find(o => o.id === id);
  B.opsDe = id => B.estado.operaciones.map((o, i) => ({ o, i })).filter(x => x.o.activoId === id)
    .sort((a, b) => a.o.fecha.localeCompare(b.o.fecha) || a.i - b.i).map(x => x.o);

  /* Precio actual en la moneda del activo (los fondos que siguen un índice se estiman) */
  B.precioActual = a => {
    if (!a) return 0;
    if (a.referencia && a.referencia.precio && a.referencia.precioBase && a.valorBase) {
      return a.valorBase * a.referencia.precio / a.referencia.precioBase;
    }
    return Number(a.precio) || 0;
  };
  const aMain = (v, a) => B.convertir(v, a.monedaPrecio, B.estado.ajustes.moneda);

  /* Posición con coste medio ponderado (todas las cifras en la moneda del activo) */
  B.posicion = (id, hasta) => {
    const a = B.activo(id);
    let cant = 0, coste = 0, realizado = 0, aportado = 0, retirado = 0, comisiones = 0;
    for (const o of B.opsDe(id)) {
      if (hasta && o.fecha > hasta) break;
      const com = Number(o.comision) || 0;
      comisiones += com;
      if (o.tipo === 'compra') {
        cant += o.cantidad; coste += o.cantidad * o.precio + com; aportado += o.cantidad * o.precio + com;
      } else {
        const frac = cant > 0 ? Math.min(1, o.cantidad / cant) : 0;
        const costeVendido = coste * frac;
        const neto = o.cantidad * o.precio - com;
        coste -= costeVendido; cant -= o.cantidad;
        realizado += neto - costeVendido; retirado += neto;
      }
    }
    if (cant < 1e-12) { cant = 0; coste = 0; }
    const precio = B.precioActual(a);
    const valor = cant * precio;
    const c = Number(a?.cambio24h) || 0;
    return {
      cant, coste, precio, valor, realizado, aportado, retirado, comisiones,
      precioMedio: cant > 0 ? coste / cant : 0,
      ganancia: valor - coste, gananciaPct: coste > 0 ? (valor - coste) / coste : 0,
      cambioDia: a?.precioFecha ? valor * c / (100 + c) : 0,
    };
  };

  B.resumenCartera = () => {
    const filas = B.estado.activos.map(a => {
      const p = B.posicion(a.id);
      return { a, p, valor: aMain(p.valor, a), coste: aMain(p.coste, a), realizado: aMain(p.realizado, a), cambioDia: aMain(p.cambioDia, a) };
    });
    const valor = filas.reduce((s, f) => s + f.valor, 0);
    const coste = filas.reduce((s, f) => s + f.coste, 0);
    const cambioDia = filas.reduce((s, f) => s + f.cambioDia, 0);
    return {
      filas, valor, coste, cambioDia, ganancia: valor - coste, gananciaPct: coste > 0 ? (valor - coste) / coste : 0,
      realizado: filas.reduce((s, f) => s + f.realizado, 0), cambioDiaPct: valor - cambioDia > 0 ? cambioDia / (valor - cambioDia) : 0,
    };
  };
  B.valorCartera = () => B.estado.activos.reduce((s, a) => s + aMain(B.posicion(a.id).valor, a), 0);

  /* ---------- Historial de precios (uno por día) ---------- */
  B.guardarPrecioDia = (id, precio, fecha = B.hoyISO()) => {
    if (!(precio > 0)) return;
    const h = B.estado.historial[id] || (B.estado.historial[id] = {});
    h[fecha] = precio;
    const claves = Object.keys(h);
    if (claves.length > 900) claves.sort().slice(0, claves.length - 900).forEach(k => delete h[k]);
  };

  /* Precio de un activo en una fecha: último conocido (historial u operaciones) */
  function preciosConocidos(a) {
    const mapa = { ...(B.estado.historial[a.id] || {}) };
    for (const o of B.opsDe(a.id)) if (!mapa[o.fecha]) mapa[o.fecha] = o.precio;
    mapa[B.hoyISO()] = B.precioActual(a) || mapa[B.hoyISO()];
    return Object.entries(mapa).filter(([, v]) => v > 0).sort((x, y) => x[0].localeCompare(y[0]));
  }

  /* Serie diaria de la cartera: valor y dinero aportado (en moneda principal) */
  B.serieCartera = dias => {
    const hoy = B.hoyISO();
    let inicio = B.sumarDias(hoy, -(dias - 1));
    const primera = B.estado.operaciones.map(o => o.fecha).sort()[0];
    if (!primera) return [];
    if (primera > inicio) inicio = primera;
    const fechas = [];
    for (let f = inicio; f <= hoy; f = B.sumarDias(f, 1)) fechas.push(f);
    const salto = Math.ceil(fechas.length / 220);
    const muestras = fechas.filter((_, i) => i % salto === 0 || i === fechas.length - 1);
    const datos = B.estado.activos.map(a => ({ a, precios: preciosConocidos(a), ops: B.opsDe(a.id) }));
    return muestras.map(f => {
      let valor = 0, aportado = 0;
      for (const { a, precios, ops } of datos) {
        let cant = 0, neto = 0;
        for (const o of ops) {
          if (o.fecha > f) break;
          const com = Number(o.comision) || 0;
          if (o.tipo === 'compra') { cant += o.cantidad; neto += o.cantidad * o.precio + com; }
          else { cant -= o.cantidad; neto -= o.cantidad * o.precio - com; }
        }
        if (cant <= 1e-12 && neto === 0) continue;
        let precio = precios.length ? precios[0][1] : 0;
        for (const [fp, v] of precios) { if (fp <= f) precio = v; else break; }
        valor += aMain(Math.max(cant, 0) * precio, a);
        aportado += aMain(neto, a);
      }
      return { fecha: f, valor, aportado };
    });
  };

  /* ---------- Operaciones ---------- */
  /* Crea o actualiza una operación y su movimiento de dinero en la cuenta */
  B.guardarOperacion = op => {
    const ops = B.estado.operaciones;
    const i = ops.findIndex(o => o.id === op.id);
    const previa = i >= 0 ? ops[i] : null;
    if (previa?.movimientoId) B.estado.movimientos = B.estado.movimientos.filter(m => m.id !== previa.movimientoId);
    delete op.movimientoId;
    const a = B.activo(op.activoId);
    const cta = op.cuentaId && B.cuenta(op.cuentaId);
    if (cta && a) {
      const bruto = op.cantidad * op.precio;
      const total = op.tipo === 'compra' ? bruto + (op.comision || 0) : bruto - (op.comision || 0);
      const importe = B.redondear(B.convertir(total, a.monedaPrecio, cta.moneda));
      const m = { id: B.uid(), fecha: op.fecha, tipo: 'transferencia', importe, operacionId: op.id, nota: `${op.tipo === 'compra' ? 'Compra' : 'Venta'} ${a.nombre}` };
      if (op.tipo === 'compra') m.cuentaId = cta.id;
      else { m.cuentaId = null; m.cuentaDestinoId = cta.id; m.importeDestino = importe; }
      B.estado.movimientos.push(m);
      op.movimientoId = m.id;
    }
    if (i >= 0) ops[i] = op; else ops.push(op);
    if (a && op.precio > 0 && !(B.estado.historial[a.id] || {})[op.fecha]) B.guardarPrecioDia(a.id, op.precio, op.fecha);
    B.guardar();
    return op;
  };
  B.borrarOperacion = id => {
    const op = B.operacion(id);
    if (!op) return;
    if (op.movimientoId) B.estado.movimientos = B.estado.movimientos.filter(m => m.id !== op.movimientoId);
    B.estado.operaciones = B.estado.operaciones.filter(o => o.id !== id);
    B.guardar();
  };
  B.comprarPorImporte = (activoId, importe, fecha, cuentaId, nota) => {
    const a = B.activo(activoId), cta = B.cuenta(cuentaId);
    const precio = B.precioActual(a);
    if (!a || !cta || !(precio > 0)) return null;
    const enActivo = B.convertir(importe, cta.moneda, a.monedaPrecio);
    return B.guardarOperacion({ id: B.uid(), activoId, tipo: 'compra', fecha, cantidad: enActivo / precio, precio, comision: 0, cuentaId, nota: nota || '' });
  };
  B.guardarActivo = a => {
    const l = B.estado.activos, i = l.findIndex(x => x.id === a.id);
    if (i >= 0) l[i] = a; else l.push(a);
    B.guardar();
  };
  B.borrarActivo = id => {
    const ops = B.estado.operaciones.filter(o => o.activoId === id);
    const movs = new Set(ops.map(o => o.movimientoId).filter(Boolean));
    B.estado.movimientos = B.estado.movimientos.filter(m => !movs.has(m.id));
    B.estado.operaciones = B.estado.operaciones.filter(o => o.activoId !== id);
    B.estado.recurrentes = B.estado.recurrentes.filter(r => r.activoId !== id);
    B.estado.activos = B.estado.activos.filter(a => a.id !== id);
    delete B.estado.historial[id];
    B.guardar();
  };

  /* ---------- Precios en vivo ---------- */
  const P = B.precios = { estado: 'inactivo', cargando: false, ultima: 0, ultimaBolsa: 0, mensaje: '', avisos: [] };
  const oyentes = [];
  B.alCambiarPrecios = fn => oyentes.push(fn);
  const avisar = () => oyentes.forEach(fn => { try { fn(); } catch (e) { /* nada */ } });

  async function pedir(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (r.status === 429) { const e = new Error('Demasiadas consultas seguidas; se reintentará en un minuto.'); e.limite = true; throw e; }
      if (!r.ok) throw new Error(`El servicio respondió con un error (${r.status}).`);
      return await r.json();
    } catch (err) {
      if (err.name === 'TypeError' || err.name === 'AbortError') err.red = true;
      throw err;
    } finally { clearTimeout(t); }
  }
  B.pedirJSON = pedir;

  const CG = 'https://api.coingecko.com/api/v3';
  const TD = 'https://api.twelvedata.com';
  B.urlTwelve = (ruta, params) => {
    const q = new URLSearchParams(params);
    if (B.estado.ajustes.claveTwelve) q.set('apikey', B.estado.ajustes.claveTwelve);
    return `${TD}/${ruta}?${q}`;
  };

  B.actualizarPrecios = async ({ forzar = false } = {}) => {
    if (P.cargando) return;
    const e = B.estado, aj = e.ajustes;
    P.cargando = true; P.avisos = []; avisar();
    let ok = false, red = false, cambios = false;

    // Tipo de cambio del BCE (cada 6 horas)
    if (forzar || !aj.fx || Date.now() - (aj.fx.at || 0) > 6 * 3600e3) {
      try {
        const d = await pedir('https://api.frankfurter.dev/v1/latest?base=EUR');
        aj.fx = { fecha: d.date, at: Date.now(), rates: { EUR: 1, ...d.rates } };
        if (aj.tasaAuto !== false && d.rates.USD) aj.tasa = Math.round(1 / d.rates.USD * 10000) / 10000;
        ok = true; cambios = true;
      } catch (err) { if (err.red) red = true; }
    }

    // Criptomonedas (CoinGecko, sin clave)
    const criptos = e.activos.filter(a => a.fuente === 'coingecko' && a.idFuente);
    if (criptos.length) {
      try {
        const ids = [...new Set(criptos.map(a => a.idFuente))].join(',');
        const d = await pedir(`${CG}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=eur,usd&include_24hr_change=true`);
        for (const a of criptos) {
          const k = (a.monedaPrecio || 'EUR').toLowerCase(), x = d[a.idFuente];
          if (x && x[k] != null) {
            a.precio = x[k]; a.cambio24h = x[`${k}_24h_change`] ?? 0; a.precioFecha = ahora(); a.mercadoAbierto = true;
            B.guardarPrecioDia(a.id, a.precio);
          }
        }
        ok = true; cambios = true;
      } catch (err) {
        if (err.red) red = true;
        P.avisos.push(err.red ? 'Criptomonedas: CoinGecko no responde ahora mismo (puede ser un límite de consultas); se reintentará en un minuto.' : `Criptomonedas: ${err.message}`);
      }
    }

    // Bolsa (Twelve Data, con clave gratuita; como mucho cada 5 minutos)
    const bolsa = e.activos.filter(a => (a.fuente === 'twelvedata' && a.idFuente) || (a.referencia && a.referencia.idFuente));
    if (bolsa.length && aj.claveTwelve && (forzar || Date.now() - P.ultimaBolsa > 5 * 60e3)) {
      P.ultimaBolsa = Date.now();
      for (const a of bolsa.slice(0, 8)) {
        const ref = a.fuente === 'twelvedata' ? a : a.referencia;
        try {
          const params = { symbol: ref.idFuente };
          if (ref.exchange) params.exchange = ref.exchange;
          const d = await pedir(B.urlTwelve('quote', params));
          if (d.status === 'error') { P.avisos.push(`${ref.idFuente}: ${d.message}`); continue; }
          const precio = parseFloat(d.close);
          if (!(precio > 0)) continue;
          if (a.fuente === 'twelvedata') {
            a.precio = precio; a.cambio24h = parseFloat(d.percent_change) || 0; a.precioFecha = ahora();
            a.mercadoAbierto = !!d.is_market_open;
            if (d.currency && d.currency !== a.monedaPrecio) a.monedaPrecio = d.currency === 'GBp' ? 'GBX' : d.currency;
            B.guardarPrecioDia(a.id, a.precio);
          } else {
            ref.precio = precio; ref.cambio24h = parseFloat(d.percent_change) || 0; ref.precioFecha = ahora();
            if (!ref.precioBase) ref.precioBase = precio;
            a.cambio24h = ref.cambio24h; a.precioFecha = ref.precioFecha;
            B.guardarPrecioDia(a.id, B.precioActual(a));
          }
          ok = true; cambios = true;
        } catch (err) {
          if (err.red) { red = true; break; }
          P.avisos.push(`${ref.idFuente}: ${err.message}`);
          if (err.limite) break;
        }
      }
    }

    const algoQuePedir = criptos.length || bolsa.length;
    if (ok) { P.estado = 'ok'; P.ultima = Date.now(); }
    else if (red) P.estado = 'bloqueado';
    else if (P.avisos.length) P.estado = 'error';
    else if (!algoQuePedir) P.estado = 'inactivo';
    if (cambios) B.guardar();
    P.cargando = false;
    avisar();
  };

  /* Rellena el historial de un activo con datos reales (para las gráficas) */
  B.rellenarHistorial = async a => {
    try {
      if (a.fuente === 'coingecko') {
        const d = await pedir(`${CG}/coins/${encodeURIComponent(a.idFuente)}/market_chart?vs_currency=${(a.monedaPrecio || 'EUR').toLowerCase()}&days=365&interval=daily`);
        (d.prices || []).forEach(([t, v]) => { const x = new Date(t); B.guardarPrecioDia(a.id, v, B.iso(x.getFullYear(), x.getMonth(), x.getDate())); });
      } else if (a.fuente === 'twelvedata' && B.estado.ajustes.claveTwelve) {
        const params = { symbol: a.idFuente, interval: '1day', outputsize: 365 };
        if (a.exchange) params.exchange = a.exchange;
        const d = await pedir(B.urlTwelve('time_series', params));
        (d.values || []).forEach(v => B.guardarPrecioDia(a.id, parseFloat(v.close), v.datetime.slice(0, 10)));
      } else return false;
      a.historialSintetico = false;
      B.guardar();
      return true;
    } catch (err) { return false; }
  };

  /* Historial de precio para la ficha de un activo (en vivo si se puede) */
  B.historialPrecio = async (a, dias) => {
    const local = () => Object.entries(B.estado.historial[a.id] || {}).sort((x, y) => x[0].localeCompare(y[0]))
      .filter(([f]) => f >= B.sumarDias(B.hoyISO(), -dias)).map(([f, v]) => ({ fecha: f, v }));
    try {
      if (a.fuente === 'coingecko') {
        const d = await pedir(`${CG}/coins/${encodeURIComponent(a.idFuente)}/market_chart?vs_currency=${(a.monedaPrecio || 'EUR').toLowerCase()}&days=${dias}${dias > 90 ? '&interval=daily' : ''}`);
        return { vivo: true, puntos: (d.prices || []).map(([t, v]) => ({ t, v })) };
      }
      if (a.fuente === 'twelvedata' && B.estado.ajustes.claveTwelve) {
        const params = { symbol: a.idFuente, interval: dias <= 7 ? '1h' : '1day', outputsize: dias <= 7 ? 7 * 8 : dias };
        if (a.exchange) params.exchange = a.exchange;
        const d = await pedir(B.urlTwelve('time_series', params));
        if (d.values) return { vivo: true, puntos: d.values.slice().reverse().map(v => ({ t: Date.parse(v.datetime.replace(' ', 'T')), v: parseFloat(v.close) })) };
      }
    } catch (err) { /* sin conexión: usamos lo guardado */ }
    return { vivo: false, puntos: local().map(x => ({ t: Date.parse(x.fecha + 'T12:00:00'), v: x.v })) };
  };

  /* Buscadores */
  B.buscarCripto = async q => {
    const d = await pedir(`${CG}/search?query=${encodeURIComponent(q)}`);
    return (d.coins || []).slice(0, 8).map(c => ({ id: c.id, nombre: c.name, simbolo: c.symbol, rango: c.market_cap_rank }));
  };
  B.buscarBolsa = async q => {
    const d = await pedir(`${TD}/symbol_search?symbol=${encodeURIComponent(q)}&outputsize=12`);
    return (d.data || []).map(x => ({ simbolo: x.symbol, nombre: x.instrument_name, exchange: x.exchange, mic: x.mic_code, moneda: x.currency === 'GBp' ? 'GBX' : x.currency, tipo: x.instrument_type, pais: x.country }));
  };

  /* ---------- Datos de ejemplo ---------- */
  function azar(semilla) {
    return () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646; };
  }
  /* Historial inventado y suave que termina en el precio indicado (solo para el ejemplo) */
  function historialEjemplo(e, id, desde, precioFinal, vol, semilla) {
    const r = azar(semilla), hoy = B.hoyISO(), fechas = [];
    for (let f = desde; f <= hoy; f = B.sumarDias(f, 1)) fechas.push(f);
    let v = 1; const serie = [];
    for (let i = fechas.length - 1; i >= 0; i--) { serie[i] = v; v *= 1 + (r() - 0.5) * vol; }
    const k = precioFinal / serie[serie.length - 1];
    const h = e.historial[id] = {};
    fechas.forEach((f, i) => { h[f] = +(serie[i] * k).toFixed(4); });
    return h;
  }

  B.ejemploInversiones = (e, proxima) => {
    const hoy = new Date();
    const fecha = (meses, dia) => { const x = new Date(hoy.getFullYear(), hoy.getMonth() - meses, dia); return B.iso(x.getFullYear(), x.getMonth(), x.getDate()); };
    const inicio = fecha(7, 1);
    e.activos = [
      { id: 'a-btc', nombre: 'Bitcoin', simbolo: 'BTC', tipo: 'cripto', fuente: 'coingecko', idFuente: 'bitcoin', monedaPrecio: 'EUR', color: '#f2a33a', precio: 66000, cambio24h: 0, precioFecha: null, historialSintetico: true },
      { id: 'a-eth', nombre: 'Ethereum', simbolo: 'ETH', tipo: 'cripto', fuente: 'coingecko', idFuente: 'ethereum', monedaPrecio: 'EUR', color: '#8a9bff', precio: 1830, cambio24h: 0, precioFecha: null, historialSintetico: true },
      { id: 'a-voo', nombre: 'Vanguard S&P 500 ETF', simbolo: 'VOO', tipo: 'etf', fuente: 'twelvedata', idFuente: 'VOO', exchange: 'NYSE', monedaPrecio: 'USD', color: '#3ecf8e', precio: 590, cambio24h: 0, precioFecha: null, historialSintetico: true },
      { id: 'a-fondo', nombre: 'Fondo indexado MSCI World', simbolo: 'MSCI World', tipo: 'fondo', fuente: 'manual', monedaPrecio: 'EUR', color: '#4fb0dd', precio: 21.48, cambio24h: 0, precioFecha: null, historialSintetico: true },
    ];
    const h = {
      btc: historialEjemplo(e, 'a-btc', inicio, 66000, 0.045, 11),
      eth: historialEjemplo(e, 'a-eth', inicio, 1830, 0.055, 23),
      voo: historialEjemplo(e, 'a-voo', inicio, 590, 0.014, 37),
      fondo: historialEjemplo(e, 'a-fondo', inicio, 21.48, 0.011, 41),
    };
    const precioEn = (serie, f) => serie[f] || Object.values(serie)[0];
    let n = 0;
    const op = (activoId, serie, tipo, f, cantidad, comision = 0) =>
      e.operaciones.push({ id: 'op' + (n++), activoId, tipo, fecha: f, cantidad, precio: precioEn(serie, f), comision });
    op('a-btc', h.btc, 'compra', fecha(6, 12), 0.04, 2.5);
    op('a-btc', h.btc, 'compra', fecha(3, 20), 0.015, 1.5);
    op('a-eth', h.eth, 'compra', fecha(5, 8), 1.2, 1.5);
    op('a-eth', h.eth, 'venta', fecha(1, 18), 0.4, 1);
    op('a-voo', h.voo, 'compra', fecha(6, 3), 3, 1);
    op('a-voo', h.voo, 'compra', fecha(2, 14), 1, 1);
    for (let k = 6; k >= 0; k--) {
      const f = fecha(k, 5);
      if (f <= B.hoyISO()) op('a-fondo', h.fondo, 'compra', f, 150 / precioEn(h.fondo, f));
    }
    e.recurrentes.push({
      id: 'r-fondo', nombre: 'Aportación fondo MSCI World', tipo: 'inversion', activoId: 'a-fondo', importe: 150, cuentaId: 'c-corriente',
      frecuencia: 'mensual', dia: 5, proxima: proxima(5), automatico: true, activo: true,
    });
  };
})(window.B);
