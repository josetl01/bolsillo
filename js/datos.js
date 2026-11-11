/* Bolsillo · datos: estado, cálculos y guardado en este dispositivo */
window.B = window.B || {};
(function (B) {
  'use strict';

  const CLAVE = 'bolsillo.v1';
  B.VERSION = '0.5';

  B.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  B.redondear = n => Math.round(n * 100) / 100;

  /* ---------- Fechas ---------- */
  const dos = n => String(n).padStart(2, '0');
  const iso = (y, m0, d) => `${y}-${dos(m0 + 1)}-${dos(d)}`;
  B.iso = iso;
  B.hoyISO = () => { const d = new Date(); return iso(d.getFullYear(), d.getMonth(), d.getDate()); };
  B.mesActual = () => B.hoyISO().slice(0, 7);
  B.mesDe = f => String(f || '').slice(0, 7);
  B.sumarMes = (mes, n) => {
    const [y, m] = mes.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}`;
  };
  B.diasDelMes = mes => { const [y, m] = mes.split('-').map(Number); return new Date(y, m, 0).getDate(); };

  /* Convierte casi cualquier fecha de un extracto a AAAA-MM-DD (o null) */
  B.fechaISO = v => {
    if (v instanceof Date && !isNaN(v)) {
      const d = new Date(v.getTime() + 43200000); // evita desfases de zona horaria
      return iso(d.getFullYear(), d.getMonth(), d.getDate());
    }
    if (typeof v !== 'string') return null;
    const s = v.trim();
    let y, m, d, r;
    if ((r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[\sT])/))) { y = +r[1]; m = +r[2]; d = +r[3]; }
    else if ((r = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:$|\s)/))) { d = +r[1]; m = +r[2]; y = +r[3]; if (y < 100) y += 2000; }
    else return null;
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
    if (d > new Date(y, m, 0).getDate()) return null;
    return iso(y, m - 1, d);
  };

  /* Lee importes escritos como 1.234,56 · -45,20 · 1,234.56 · (12,00) · 45,20- */
  B.numero = v => {
    if (typeof v === 'number') return v;
    let s = String(v ?? '').replace(/[€$\s ]/g, '').replace(/EUR|USD|US/gi, '');
    if (!s) return NaN;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
    if (s.startsWith('+')) s = s.slice(1);
    if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
    const comas = (s.match(/,/g) || []).length, puntos = (s.match(/\./g) || []).length;
    if (comas && puntos) {
      s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (comas) {
      s = comas > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (puntos > 1 || /^\d{1,3}\.\d{3}$/.test(s)) {
      s = s.replace(/\./g, '');
    }
    if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
    const n = parseFloat(s);
    return neg ? -n : n;
  };

  B.norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

  /* ---------- Valores por defecto ---------- */
  const CATS = [
    ['vivienda', 'Vivienda', 'gasto', '#7c8cff'],
    ['super', 'Supermercado', 'gasto', '#3fbf8a'],
    ['restaurantes', 'Restaurantes', 'gasto', '#f0a35e'],
    ['transporte', 'Transporte', 'gasto', '#4fb0dd'],
    ['facturas', 'Facturas y suministros', 'gasto', '#b48af0'],
    ['suscripciones', 'Suscripciones', 'gasto', '#e57fa8'],
    ['salud', 'Salud', 'gasto', '#4fd1c1'],
    ['ocio', 'Ocio', 'gasto', '#e6c050'],
    ['compras', 'Compras', 'gasto', '#d9785f'],
    ['viajes', 'Viajes', 'gasto', '#5b8cff'],
    ['formacion', 'Formación', 'gasto', '#9ccc5a'],
    ['mascotas', 'Mascotas', 'gasto', '#c99a6b'],
    ['regalos', 'Regalos', 'gasto', '#ff8fa0'],
    ['comisiones', 'Impuestos y comisiones', 'gasto', '#8f97a8'],
    ['deudas', 'Préstamos y deudas', 'gasto', '#7aa0c4'],
    ['otros-gasto', 'Otros gastos', 'gasto', '#6b7385'],
    ['nomina', 'Nómina', 'ingreso', '#3ecf8e'],
    ['extra', 'Trabajos extra', 'ingreso', '#6fd6b0'],
    ['rendimientos', 'Intereses y dividendos', 'ingreso', '#7fc8ff'],
    ['devoluciones', 'Devoluciones', 'ingreso', '#a8dc6e'],
    ['regalos-ing', 'Regalos recibidos', 'ingreso', '#ffd27f'],
    ['cobros', 'Cobro de deudas', 'ingreso', '#8fd0e0'],
    ['otros-ingreso', 'Otros ingresos', 'ingreso', '#9fb0a8'],
  ];
  B.categoriasBase = () => CATS.map(([id, nombre, tipo, color]) => ({ id, nombre, tipo, color }));

  const REGLAS = {
    super: ['mercadona', 'carrefour', 'lidl', 'aldi', 'eroski', 'consum', 'alcampo', 'hipercor', 'supermercado', 'supercor', 'bonpreu', 'ahorramas'],
    transporte: ['repsol', 'cepsa', 'galp', 'gasolinera', 'renfe', 'uber', 'cabify', 'bolt', 'metro', 'parking', 'peaje', 'autopista', 'emt'],
    suscripciones: ['netflix', 'spotify', 'hbo', 'disney', 'prime video', 'youtube', 'icloud', 'apple.com', 'dazn'],
    facturas: ['iberdrola', 'endesa', 'naturgy', 'holaluz', 'vodafone', 'movistar', 'orange', 'digi', 'jazztel', 'masmovil', 'aguas'],
    salud: ['farmacia', 'clinica', 'dentista', 'optica', 'sanitas', 'adeslas'],
    restaurantes: ['glovo', 'just eat', 'uber eats', 'restaurante', 'cafeteria', 'burger', 'mcdonald', 'telepizza', 'starbucks'],
    compras: ['amazon', 'zara', 'decathlon', 'ikea', 'el corte ingles', 'aliexpress', 'primark', 'mediamarkt', 'fnac'],
    vivienda: ['alquiler', 'hipoteca', 'comunidad de propietarios', 'ibi'],
    viajes: ['booking', 'airbnb', 'ryanair', 'vueling', 'iberia', 'hotel'],
    ocio: ['cine', 'yelmo', 'cinesa', 'entradas', 'steam', 'playstation', 'nintendo', 'ticketmaster'],
    mascotas: ['veterinari', 'tiendanimal', 'kiwoko'],
    comisiones: ['comision', 'hacienda', 'aeat', 'impuesto'],
    nomina: ['nomina', 'salario', 'sueldo'],
    devoluciones: ['devolucion', 'reembolso', 'abono compra'],
    rendimientos: ['intereses', 'dividendo'],
    deudas: ['prestamo', 'financiacion', 'amortizacion'],
  };
  const VERSION_DATOS = 3;
  B.reglasBase = () => Object.entries(REGLAS).flatMap(([categoriaId, ts]) => ts.map(texto => ({ id: B.uid() + texto.length, texto, categoriaId })));

  const ajustesBase = () => ({ moneda: 'EUR', tasa: 0.92, tema: 'oscuro' });

  const vacio = () => ({
    version: VERSION_DATOS, ejemplo: false, ajustes: ajustesBase(),
    cuentas: [], categorias: B.categoriasBase(), movimientos: [], presupuestos: [], metas: [], reglas: B.reglasBase(),
    recurrentes: [], deudas: [], activos: [], operaciones: [], historial: {},
  });

  /* ---------- Fechas de repetición ---------- */
  B.FRECUENCIAS = { semanal: 'Cada semana', mensual: 'Cada mes', trimestral: 'Cada 3 meses', anual: 'Cada año' };
  B.FACTOR_MES = { semanal: 52 / 12, mensual: 1, trimestral: 1 / 3, anual: 1 / 12 };
  B.sumarDias = (f, n) => { const [y, m, d] = f.split('-').map(Number); const x = new Date(y, m - 1, d + n); return iso(x.getFullYear(), x.getMonth(), x.getDate()); };
  B.sumarMesesFecha = (f, n, dia) => {
    const [y, m, d] = f.split('-').map(Number);
    const base = new Date(y, m - 1 + n, 1);
    const ultimo = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    return iso(base.getFullYear(), base.getMonth(), Math.min(dia || d, ultimo));
  };
  B.siguienteFecha = (r, f) => {
    if (r.frecuencia === 'semanal') return B.sumarDias(f, 7);
    const meses = { mensual: 1, trimestral: 3, anual: 12 }[r.frecuencia] || 1;
    return B.sumarMesesFecha(f, meses, r.dia);
  };

  /* ---------- Datos de ejemplo (6 meses hasta hoy) ---------- */
  function azar(semilla) {
    return function () {
      semilla = (semilla + 0x6D2B79F5) | 0;
      let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function ejemplo() {
    const e = vacio();
    e.ejemplo = true;
    const r = azar(7);
    const hoy = new Date();
    e.cuentas = [
      { id: 'c-corriente', nombre: 'Cuenta corriente', tipo: 'banco', moneda: 'EUR', saldoInicial: 1450, color: '#8a9bff' },
      { id: 'c-ahorro', nombre: 'Cuenta de ahorro', tipo: 'ahorro', moneda: 'EUR', saldoInicial: 4800, color: '#3ecf8e' },
      { id: 'c-tarjeta', nombre: 'Tarjeta de crédito', tipo: 'tarjeta', moneda: 'EUR', saldoInicial: 0, color: '#e57fa8' },
      { id: 'c-efectivo', nombre: 'Efectivo', tipo: 'efectivo', moneda: 'EUR', saldoInicial: 80, color: '#e6c050' },
      { id: 'c-usd', nombre: 'Cuenta en dólares', tipo: 'banco', moneda: 'USD', saldoInicial: 650, color: '#4fb0dd' },
    ];
    const movs = e.movimientos;
    let n = 0;
    const add = (fecha, tipo, importe, cuentaId, categoriaId, nota, extra = {}) =>
      movs.push({ id: 'ej' + (n++), fecha, tipo, importe: B.redondear(importe), cuentaId, categoriaId, nota, ...extra });
    const elegir = lista => lista[Math.floor(r() * lista.length)];

    for (let k = 5; k >= 0; k--) {
      const base = new Date(hoy.getFullYear(), hoy.getMonth() - k, 1);
      const y = base.getFullYear(), m = base.getMonth();
      const dias = new Date(y, m + 1, 0).getDate();
      const tope = k === 0 ? hoy.getDate() : dias;
      const pon = (d, ...a) => { d = Math.min(d, dias); if (d <= tope) add(iso(y, m, d), ...a); };
      const dia = (desde, hasta) => desde + Math.floor(r() * (hasta - desde + 1));

      pon(1, 'ingreso', 2450, 'c-corriente', 'nomina', 'Nómina Talleres Levante SL');
      pon(1, 'gasto', 750, 'c-corriente', 'vivienda', 'Alquiler piso');
      pon(2, 'transferencia', 300, 'c-corriente', null, 'Ahorro mensual', { cuentaDestinoId: 'c-ahorro' });
      if (k > 0) pon(5, 'gasto', 38 + r() * 30, 'c-corriente', 'facturas', 'Iberdrola luz');
      pon(15, 'gasto', 285, 'c-corriente', 'deudas', 'Cuota préstamo coche');
      pon(8, 'gasto', 39.9, 'c-corriente', 'facturas', 'Movistar fibra y móvil');
      pon(10, 'gasto', 12.99, 'c-tarjeta', 'suscripciones', 'Netflix');
      pon(12, 'gasto', 10.99, 'c-tarjeta', 'suscripciones', 'Spotify');
      for (let i = 0; i < 6; i++) pon(dia(2, 28), 'gasto', 28 + r() * 62, 'c-tarjeta', 'super', elegir(['Mercadona', 'Lidl', 'Carrefour Express']));
      for (let i = 0; i < 4; i++) {
        const efectivo = r() > 0.6;
        pon(dia(1, 28), 'gasto', 14 + r() * 36, efectivo ? 'c-efectivo' : 'c-tarjeta', 'restaurantes', elegir(['Bar La Esquina', 'Glovo', 'Asador del Puerto', 'Cafetería Central']));
      }
      for (let i = 0; i < 2; i++) pon(dia(3, 27), 'gasto', 50 + r() * 15, 'c-tarjeta', 'transporte', 'Repsol gasolina');
      pon(dia(12, 22), 'gasto', 18 + r() * 55, 'c-tarjeta', 'ocio', elegir(['Cinesa', 'Entradas concierto', 'Escape room']));
      pon(dia(16, 27), 'gasto', 25 + r() * 80, 'c-tarjeta', 'compras', elegir(['Amazon', 'Decathlon', 'Zara']));
      if (r() > 0.45) pon(dia(6, 24), 'gasto', 8 + r() * 25, 'c-efectivo', 'salud', 'Farmacia');
      if (k % 2 === 0) pon(20, 'ingreso', 300 + Math.round(r() * 200), 'c-usd', 'extra', 'Proyecto web cliente EE. UU.');
      if (k === 3) pon(14, 'gasto', 189, 'c-tarjeta', 'viajes', 'Vueling Madrid–Lisboa');
      pon(4, 'transferencia', 60, 'c-corriente', null, 'Retirada cajero', { cuentaDestinoId: 'c-efectivo' });

      // Pago de la tarjeta a final de mes
      if (28 <= tope) {
        const mes = iso(y, m, 1).slice(0, 7);
        const gastoTarjeta = movs.filter(x => x.cuentaId === 'c-tarjeta' && x.tipo === 'gasto' && x.fecha.startsWith(mes)).reduce((a, x) => a + x.importe, 0);
        pon(28, 'transferencia', gastoTarjeta, 'c-corriente', null, 'Pago tarjeta de crédito', { cuentaDestinoId: 'c-tarjeta' });
      }
    }
    movs.sort((a, b) => a.fecha.localeCompare(b.fecha));

    e.presupuestos = [
      ['super', 380], ['restaurantes', 110], ['transporte', 130], ['ocio', 60], ['compras', 90], ['suscripciones', 30], ['facturas', 120],
    ].map(([categoriaId, limite]) => ({ id: 'p-' + categoriaId, categoriaId, limite }));

    const enMeses = k => { const d = new Date(hoy.getFullYear(), hoy.getMonth() + k, 1); return iso(d.getFullYear(), d.getMonth(), 1); };
    e.metas = [
      { id: 'm-emergencia', nombre: 'Fondo de emergencia', objetivo: 9000, ahorrado: 6600, fechaLimite: enMeses(10), color: '#3ecf8e' },
      { id: 'm-japon', nombre: 'Viaje a Japón', objetivo: 3500, ahorrado: 1150, fechaLimite: enMeses(11), color: '#e57fa8' },
      { id: 'm-portatil', nombre: 'Portátil nuevo', objetivo: 1400, ahorrado: 1400, fechaLimite: '', color: '#4fb0dd' },
    ];

    e.deudas = [
      { id: 'd-coche', nombre: 'Préstamo del coche', tipo: 'debo', persona: 'Banco Mediterráneo', total: 12000, pendiente: 7420, interes: 6.5, cuota: 285, moneda: 'EUR', color: '#7aa0c4' },
      { id: 'd-laura', nombre: 'Entradas del festival', tipo: 'me-deben', persona: 'Laura', total: 180, pendiente: 90, interes: 0, cuota: 0, moneda: 'EUR', color: '#ffd27f' },
    ];

    // Repeticiones: la próxima fecha es la primera a partir de hoy (la luz de este mes queda por confirmar)
    const hoyISO = B.hoyISO();
    const proxima = (dia, frecuencia = 'mensual', desde) => {
      let f = desde || iso(hoy.getFullYear(), hoy.getMonth() - 1, Math.min(dia, 28));
      const rr = { frecuencia, dia };
      f = B.sumarMesesFecha(f, 0, dia);
      while (f <= hoyISO) f = B.siguienteFecha(rr, f);
      return f;
    };
    const rec = (id, nombre, tipo, importe, cuentaId, categoriaId, dia, extra = {}) => ({
      id, nombre, tipo, importe, cuentaId, categoriaId, frecuencia: 'mensual', dia, proxima: proxima(dia), automatico: true, activo: true, ...extra,
    });
    e.recurrentes = [
      rec('r-nomina', 'Nómina Talleres Levante SL', 'ingreso', 2450, 'c-corriente', 'nomina', 1),
      rec('r-alquiler', 'Alquiler piso', 'gasto', 750, 'c-corriente', 'vivienda', 1),
      rec('r-ahorro', 'Ahorro mensual', 'transferencia', 300, 'c-corriente', null, 2, { cuentaDestinoId: 'c-ahorro' }),
      rec('r-luz', 'Iberdrola luz', 'gasto', 55, 'c-corriente', 'facturas', 5, { automatico: false, proxima: iso(hoy.getFullYear(), hoy.getMonth(), 5) }),
      rec('r-fibra', 'Movistar fibra y móvil', 'gasto', 39.9, 'c-corriente', 'facturas', 8),
      rec('r-netflix', 'Netflix', 'gasto', 12.99, 'c-tarjeta', 'suscripciones', 10),
      rec('r-spotify', 'Spotify', 'gasto', 10.99, 'c-tarjeta', 'suscripciones', 12),
      rec('r-coche', 'Cuota préstamo coche', 'gasto', 285, 'c-corriente', 'deudas', 15, { deudaId: 'd-coche' }),
      rec('r-seguro', 'Seguro del coche', 'gasto', 412, 'c-corriente', 'transporte', 20, { frecuencia: 'anual', proxima: B.sumarMesesFecha(hoyISO, 2, 20) }),
    ];
    if (B.ejemploInversiones) B.ejemploInversiones(e, proxima);
    return e;
  }

  /* ---------- Carga y guardado ---------- */
  function completar(e) {
    const base = vacio();
    const r = { ...base, ...e };
    r.ajustes = { ...base.ajustes, ...(e.ajustes || {}) };
    for (const k of ['cuentas', 'categorias', 'movimientos', 'presupuestos', 'metas', 'reglas', 'recurrentes', 'deudas', 'activos', 'operaciones']) if (!Array.isArray(r[k])) r[k] = base[k];
    if (!r.historial || typeof r.historial !== 'object' || Array.isArray(r.historial)) r.historial = {};
    if (!(e.version >= 2)) {
      // v2: categorías para préstamos y cobros de deudas
      for (const c of base.categorias) if (['deudas', 'cobros'].includes(c.id) && !r.categorias.some(x => x.id === c.id)) r.categorias.push(c);
      for (const t of REGLAS.deudas) if (!r.reglas.some(x => x.texto === t)) r.reglas.push({ id: B.uid() + t.length, texto: t, categoriaId: 'deudas' });
    }
    r.version = VERSION_DATOS;
    return r;
  }

  let avisoGuardado = false;
  B.cargar = () => {
    try {
      const raw = localStorage.getItem(CLAVE);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.ejemplo && !(d.version >= VERSION_DATOS)) {
          // Datos de ejemplo de una versión anterior: se regeneran para enseñar las novedades
          B.estado = ejemplo();
          if (d.ajustes?.tema) B.estado.ajustes.tema = d.ajustes.tema;
          B.guardar();
          return;
        }
        B.estado = completar(d);
        return;
      }
    } catch (err) { /* sin almacenamiento: seguimos con datos de ejemplo */ }
    B.estado = ejemplo();
    B.guardar();
  };
  B.guardar = () => {
    try { localStorage.setItem(CLAVE, JSON.stringify(B.estado)); }
    catch (err) {
      if (!avisoGuardado && B.aviso) { avisoGuardado = true; B.aviso('Este navegador no permite guardar: los cambios se perderán al cerrar'); }
    }
  };
  B.reiniciar = modo => {
    const tema = B.estado?.ajustes?.tema;
    B.estado = modo === 'ejemplo' ? ejemplo() : vacio();
    if (tema) B.estado.ajustes.tema = tema;
    B.guardar();
  };
  B.exportarJSON = () => {
    const copia = { app: 'Bolsillo', exportado: new Date().toISOString(), ...B.estado, ajustes: { ...B.estado.ajustes } };
    delete copia.ajustes.claveTwelve; // la clave de precios no viaja en las copias
    return JSON.stringify(copia, null, 2);
  };
  B.importarJSON = texto => {
    let d;
    try { d = JSON.parse(texto); } catch (err) { throw new Error('El archivo no es una copia válida (no se puede leer como JSON).'); }
    if (!d || !Array.isArray(d.cuentas) || !Array.isArray(d.movimientos)) throw new Error('El archivo no parece una copia de Bolsillo: faltan cuentas o movimientos.');
    delete d.app; delete d.exportado;
    B.estado = completar(d);
    B.estado.ejemplo = !!d.ejemplo;
    B.guardar();
  };

  /* ---------- Consultas ---------- */
  B.cuenta = id => B.estado.cuentas.find(c => c.id === id);
  B.categoria = id => B.estado.categorias.find(c => c.id === id);

  B.convertir = (importe, de, a) => {
    if (!importe) return importe;
    if (de === 'GBX') { importe /= 100; de = 'GBP'; } // la bolsa de Londres cotiza en peniques
    if (a === 'GBX') return B.convertir(importe, de, 'GBP') * 100;
    if (de === a) return importe;
    const t = Number(B.estado.ajustes.tasa) || 1; // 1 USD = t EUR
    if (de === 'USD' && a === 'EUR') return importe * t;
    if (de === 'EUR' && a === 'USD') return importe / t;
    // Otras divisas: tipos del BCE (1 EUR = r[X] X)
    const r = B.estado.ajustes.fx?.rates || {};
    const aEur = de === 'EUR' ? importe : de === 'USD' ? importe * t : r[de] ? importe / r[de] : importe;
    return a === 'EUR' ? aEur : a === 'USD' ? aEur / t : r[a] ? aEur * r[a] : aEur;
  };
  B.aPrincipal = (importe, moneda) => B.convertir(importe, moneda, B.estado.ajustes.moneda);
  B.monedaMov = m => B.cuenta(m.cuentaId)?.moneda || B.estado.ajustes.moneda;

  B.saldo = id => {
    const c = B.cuenta(id);
    if (!c) return 0;
    let s = Number(c.saldoInicial) || 0;
    for (const m of B.estado.movimientos) {
      if (m.cuentaId === id) s += m.tipo === 'ingreso' ? m.importe : -m.importe;
      if (m.tipo === 'transferencia' && m.cuentaDestinoId === id) s += m.importeDestino ?? m.importe;
    }
    return B.redondear(s);
  };
  B.saldoCuentas = () => B.estado.cuentas.reduce((a, c) => a + B.aPrincipal(B.saldo(c.id), c.moneda), 0);
  B.totalDeudas = tipo => B.estado.deudas.filter(d => d.tipo === tipo).reduce((a, d) => a + B.aPrincipal(d.pendiente, d.moneda || B.estado.ajustes.moneda), 0);
  B.patrimonio = () => B.saldoCuentas() + (B.valorCartera ? B.valorCartera() : 0) - B.totalDeudas('debo') + B.totalDeudas('me-deben');

  /* ---------- Recurrentes ---------- */
  B.recurrente = id => B.estado.recurrentes.find(r => r.id === id);
  B.deuda = id => B.estado.deudas.find(d => d.id === id);

  /* Crea el movimiento de una repetición y avanza a la siguiente fecha */
  B.registrarRecurrente = (r, fecha = r.proxima, importe = r.importe) => {
    const cta = B.cuenta(r.cuentaId);
    if (!cta) return null;
    if (r.tipo === 'inversion') {
      // Aportación periódica: compra por importe al precio del momento
      const op = B.comprarPorImporte && B.comprarPorImporte(r.activoId, importe, fecha, r.cuentaId, r.nombre);
      if (!op) return null;
      B.saltarRecurrente(r, false);
      return op;
    }
    const m = { id: B.uid() + Math.random().toString(36).slice(2, 4), fecha, tipo: r.tipo, importe: B.redondear(importe), cuentaId: r.cuentaId, categoriaId: r.tipo === 'transferencia' ? null : r.categoriaId, nota: r.nombre, recurrenteId: r.id };
    if (r.tipo === 'transferencia') {
      const dest = B.cuenta(r.cuentaDestinoId);
      if (!dest) return null;
      m.cuentaDestinoId = dest.id;
      if (dest.moneda !== cta.moneda) m.importeDestino = B.redondear(B.convertir(importe, cta.moneda, dest.moneda));
    }
    B.estado.movimientos.push(m);
    const d = r.deudaId && B.deuda(r.deudaId);
    if (d) d.pendiente = B.redondear(Math.max(0, d.pendiente - B.convertir(importe, cta.moneda, d.moneda || B.estado.ajustes.moneda)));
    B.saltarRecurrente(r, false);
    return m;
  };
  B.saltarRecurrente = (r, guardar = true) => {
    r.proxima = B.siguienteFecha(r, r.proxima);
    if (r.hasta && r.proxima > r.hasta) r.activo = false;
    if (guardar) B.guardar();
  };
  /* Registra solas las repeticiones automáticas que ya han vencido */
  B.procesarRecurrentes = () => {
    const hoy = B.hoyISO();
    let n = 0;
    for (const r of B.estado.recurrentes) {
      if (!r.activo || !r.automatico) continue;
      let vueltas = 0;
      while (r.activo && r.proxima && r.proxima <= hoy && vueltas++ < 120) {
        if (!B.registrarRecurrente(r)) break;
        n++;
      }
    }
    if (n) B.guardar();
    return n;
  };
  B.recurrentesPendientes = () => {
    const hoy = B.hoyISO();
    return B.estado.recurrentes.filter(r => r.activo && !r.automatico && r.proxima <= hoy).sort((a, b) => a.proxima.localeCompare(b.proxima));
  };
  B.proximosRecurrentes = dias => {
    const hoy = B.hoyISO(), limite = B.sumarDias(hoy, dias), lista = [];
    for (const r of B.estado.recurrentes) {
      if (!r.activo) continue;
      let f = r.proxima, i = 0;
      while (f && f <= limite && i++ < 12) {
        if (f > hoy || !r.automatico) lista.push({ r, fecha: f });
        f = B.siguienteFecha(r, f);
        if (r.hasta && f > r.hasta) break;
      }
    }
    return lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
  };
  B.fijoMensual = tipo => B.estado.recurrentes.filter(r => r.activo && r.tipo === tipo)
    .reduce((a, r) => a + B.aPrincipal(r.importe, B.cuenta(r.cuentaId)?.moneda || B.estado.ajustes.moneda) * (B.FACTOR_MES[r.frecuencia] || 1), 0);

  /* ---------- Deudas ---------- */
  /* Plan de pago aproximado con cuota fija e interés anual (TAE/TIN) */
  B.planDeuda = d => {
    const P = Number(d.pendiente) || 0, C = Number(d.cuota) || 0, r = (Number(d.interes) || 0) / 100 / 12;
    if (P <= 0) return { terminada: true };
    if (C <= 0) return null;
    let n;
    if (r === 0) n = Math.ceil(P / C);
    else {
      if (C <= P * r) return { noCubre: true, interesMes: P * r };
      n = Math.ceil(-Math.log(1 - r * P / C) / Math.log(1 + r));
    }
    return { n, intereses: r === 0 ? 0 : Math.max(0, n * C - P), fin: B.sumarMes(B.mesActual(), n) };
  };

  B.resumenMes = mes => {
    const r = { ingresos: 0, gastos: 0, porCategoria: {} };
    for (const m of B.estado.movimientos) {
      if (m.tipo === 'transferencia' || !m.fecha.startsWith(mes)) continue;
      const v = B.aPrincipal(m.importe, B.monedaMov(m));
      if (m.tipo === 'ingreso') r.ingresos += v; else r.gastos += v;
      if (m.tipo === 'gasto') r.porCategoria[m.categoriaId] = (r.porCategoria[m.categoriaId] || 0) + v;
    }
    return r;
  };
  B.gastoCategoria = (catId, mes) => B.estado.movimientos.reduce((a, m) =>
    m.tipo === 'gasto' && m.categoriaId === catId && m.fecha.startsWith(mes) ? a + B.aPrincipal(m.importe, B.monedaMov(m)) : a, 0);

  B.categorizar = (texto, tipo) => {
    const t = B.norm(texto);
    if (!t) return null;
    const reglas = B.estado.reglas
      .filter(r => B.categoria(r.categoriaId)?.tipo === tipo && r.texto)
      .sort((a, b) => b.texto.length - a.texto.length);
    const hit = reglas.find(r => t.includes(B.norm(r.texto)));
    return hit ? hit.categoriaId : null;
  };

  /* ---------- Cambios ---------- */
  const upsert = (lista, obj) => {
    const i = lista.findIndex(x => x.id === obj.id);
    if (i >= 0) lista[i] = obj; else lista.push(obj);
    B.guardar();
  };
  B.guardarMovimiento = m => upsert(B.estado.movimientos, m);
  B.borrarMovimiento = id => { B.estado.movimientos = B.estado.movimientos.filter(m => m.id !== id); B.guardar(); };
  B.guardarCuenta = c => upsert(B.estado.cuentas, c);
  B.borrarCuenta = id => {
    B.estado.cuentas = B.estado.cuentas.filter(c => c.id !== id);
    B.estado.movimientos = B.estado.movimientos.filter(m => m.cuentaId !== id && m.cuentaDestinoId !== id);
    B.estado.recurrentes = B.estado.recurrentes.filter(r => r.cuentaId !== id && r.cuentaDestinoId !== id);
    B.guardar();
  };
  B.guardarRecurrente = r => upsert(B.estado.recurrentes, r);
  B.borrarRecurrente = id => { B.estado.recurrentes = B.estado.recurrentes.filter(r => r.id !== id); B.guardar(); };
  B.guardarDeuda = d => upsert(B.estado.deudas, d);
  B.borrarDeuda = id => {
    B.estado.deudas = B.estado.deudas.filter(d => d.id !== id);
    B.estado.recurrentes.forEach(r => { if (r.deudaId === id) delete r.deudaId; });
    B.guardar();
  };
  B.guardarPresupuesto = p => upsert(B.estado.presupuestos, p);
  B.borrarPresupuesto = id => { B.estado.presupuestos = B.estado.presupuestos.filter(p => p.id !== id); B.guardar(); };
  B.guardarMeta = m => upsert(B.estado.metas, m);
  B.borrarMeta = id => { B.estado.metas = B.estado.metas.filter(m => m.id !== id); B.guardar(); };
  B.guardarCategoria = c => upsert(B.estado.categorias, c);
  B.borrarCategoria = id => {
    const c = B.categoria(id);
    if (!c) return;
    const destino = c.tipo === 'gasto' ? 'otros-gasto' : 'otros-ingreso';
    B.estado.movimientos.forEach(m => { if (m.categoriaId === id) m.categoriaId = destino; });
    B.estado.recurrentes.forEach(r => { if (r.categoriaId === id) r.categoriaId = destino; });
    B.estado.presupuestos = B.estado.presupuestos.filter(p => p.categoriaId !== id);
    B.estado.reglas = B.estado.reglas.filter(r => r.categoriaId !== id);
    B.estado.categorias = B.estado.categorias.filter(x => x.id !== id);
    B.guardar();
  };
  B.guardarRegla = r => upsert(B.estado.reglas, r);
  B.borrarRegla = id => { B.estado.reglas = B.estado.reglas.filter(r => r.id !== id); B.guardar(); };
})(window.B);
