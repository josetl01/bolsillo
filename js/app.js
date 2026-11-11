/* Bolsillo · arranque, navegación y acciones */
(function (B) {
  'use strict';
  const ico = n => B.icono(n);
  const RUTAS = ['inicio', 'movimientos', 'cuentas', 'presupuestos', 'metas', 'recurrentes', 'deudas', 'inversiones', 'informes', 'ajustes', 'ruta'];
  const EN_MAS = ['cuentas', 'metas', 'recurrentes', 'deudas', 'inversiones', 'informes', 'ajustes', 'ruta'];

  B.ui = { mes: B.mesActual(), filtros: { texto: '', tipo: '', cuenta: '', categoria: '' }, ultimaCuenta: null };

  const rutaActual = () => { const h = location.hash.slice(1); return RUTAS.includes(h) ? h : 'inicio'; };

  B.aplicarTema = () => {
    const t = B.estado.ajustes.tema, raiz = document.documentElement;
    if (t === 'sistema') raiz.removeAttribute('data-theme');
    else raiz.setAttribute('data-theme', t === 'claro' ? 'light' : 'dark');
  };

  function montarMarco() {
    const enlace = (r, n, t) => `<a href="#${r}" data-ruta="${r}">${ico(n)}<span>${t}</span></a>`;
    document.getElementById('lateral').innerHTML = `
      <a class="marca" href="#inicio"><span class="marca-logo">${ico('logo')}</span><span>Bolsillo</span></a>
      <button type="button" class="boton primario ancho" data-accion="nuevo-movimiento">${ico('mas')}<span>Nuevo movimiento</span></button>
      <nav class="nav" aria-label="Secciones">
        ${enlace('inicio', 'inicio', 'Resumen')}${enlace('movimientos', 'movimientos', 'Movimientos')}${enlace('cuentas', 'cuentas', 'Cuentas')}
        ${enlace('presupuestos', 'presupuestos', 'Presupuestos')}${enlace('recurrentes', 'recurrentes', 'Recurrentes')}
        ${enlace('metas', 'metas', 'Metas de ahorro')}${enlace('deudas', 'deudas', 'Deudas')}
        ${enlace('inversiones', 'inversiones', 'Inversiones')}${enlace('informes', 'informes', 'Informes')}
      </nav>
      <nav class="nav nav-pie" aria-label="Más">${enlace('ruta', 'ruta', 'Hoja de ruta')}${enlace('ajustes', 'ajustes', 'Ajustes')}</nav>`;
    const tab = (r, n, t) => `<a class="tab" href="#${r}" data-ruta="${r}">${ico(n)}<span>${t}</span></a>`;
    document.getElementById('barra-movil').innerHTML = `
      ${tab('inicio', 'inicio', 'Resumen')}${tab('movimientos', 'movimientos', 'Movimientos')}
      <button type="button" class="fab" data-accion="nuevo-movimiento" aria-label="Nuevo movimiento">${ico('mas')}</button>
      ${tab('presupuestos', 'presupuestos', 'Presupuestos')}
      <button type="button" class="tab" data-accion="abrir-mas" data-ruta-mas>${ico('puntos')}<span>Más</span></button>`;
  }

  B.render = () => {
    const r = rutaActual();
    const v = B.vistas[r]();
    const cont = document.getElementById('vista');
    const banner = B.estado.ejemplo ? `<div class="banner">
        <p><strong>Estás viendo datos de ejemplo.</strong> Explora con calma; cuando quieras, empieza con tus cuentas reales.</p>
        <button type="button" class="boton pequeno" data-accion="empezar-cero">Empezar con mis datos</button>
      </div>` : '';
    cont.innerHTML = banner + v.html;
    if (v.alMontar) v.alMontar(cont);
    document.querySelectorAll('[data-ruta]').forEach(a => {
      const activo = a.dataset.ruta === r;
      a.classList.toggle('activo', activo);
      if (activo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const mas = document.querySelector('[data-ruta-mas]');
    if (mas) mas.classList.toggle('activo', EN_MAS.includes(r));
  };

  function menuMas() {
    const item = (r, n, t, d) => `<a class="menu-item" href="#${r}">${ico(n)}<span><strong>${t}</strong><small>${d}</small></span></a>`;
    B.abrirModal({
      titulo: 'Más', clase: 'estrecho',
      cuerpo: `<nav class="menu-mas">
        ${item('inversiones', 'inversiones', 'Inversiones', 'Cripto, acciones, ETF y fondos en vivo')}
        ${item('informes', 'informes', 'Informes', 'Comparativas por mes y año, exportar a Excel')}
        ${item('cuentas', 'cuentas', 'Cuentas', 'Saldos y transferencias')}
        ${item('recurrentes', 'recurrentes', 'Recurrentes', 'Alquiler, nómina, suscripciones')}
        ${item('metas', 'metas', 'Metas de ahorro', 'Lo que quieres conseguir')}
        ${item('deudas', 'deudas', 'Deudas y préstamos', 'Lo que debes y lo que te deben')}
        <button type="button" class="menu-item" data-accion="importar">${ico('importar')}<span><strong>Importar extracto</strong><small>CSV o Excel de tu banco</small></span></button>
        ${item('ruta', 'ruta', 'Hoja de ruta', 'Qué viene después')}
        ${item('ajustes', 'ajustes', 'Ajustes', 'Moneda, sincronización, PIN y copias')}
        ${B.bloqueo?.cfg ? `<button type="button" class="menu-item" data-accion="bloquear-ya">${ico('candado')}<span><strong>Bloquear ahora</strong><small>Pide el PIN para volver a entrar</small></span></button>` : ''}
      </nav>`,
    });
  }

  /* ---------- Acciones (data-accion) ---------- */
  const id = el => el.dataset.id;
  B.acciones = {
    'nuevo-movimiento': () => B.formMovimiento(),
    'editar-mov': el => B.formMovimiento(id(el)),
    'transferir': () => B.formMovimiento(null, { tipo: 'transferencia' }),
    'importar': () => B.abrirImportador(),
    'mes-anterior': () => { B.ui.mes = B.sumarMes(B.ui.mes, -1); B.render(); },
    'mes-siguiente': () => { if (B.ui.mes < B.mesActual()) { B.ui.mes = B.sumarMes(B.ui.mes, 1); B.render(); } },
    'limpiar-filtros': () => { B.ui.filtros = { texto: '', tipo: '', cuenta: '', categoria: '' }; B.render(); },
    'nueva-cuenta': () => B.formCuenta(),
    'editar-cuenta': el => B.formCuenta(id(el)),
    'ver-cuenta': el => { B.ui.filtros = { texto: '', tipo: '', cuenta: id(el), categoria: '' }; location.hash = 'movimientos'; },
    'nuevo-presupuesto': el => B.formPresupuesto(null, el.dataset.cat),
    'editar-presupuesto': el => B.formPresupuesto(id(el)),
    'nueva-meta': () => B.formMeta(),
    'editar-meta': el => B.formMeta(id(el)),
    'aportar-meta': el => B.aportarMeta(id(el)),
    'nuevo-recurrente': () => B.formRecurrente(),
    'editar-recurrente': el => { const r = B.recurrente(id(el)); if (r?.tipo === 'inversion') B.formAportacion(r.activoId, r.id); else B.formRecurrente(id(el)); },
    'nuevo-activo': () => B.formActivo(),
    'ver-activo': el => B.verActivo(id(el)),
    'editar-activo': el => B.formActivo(id(el)),
    'operar': el => B.formOperacion(id(el), el.dataset.tipo),
    'editar-operacion': el => B.formOperacion(null, null, id(el)),
    'precio-manual': el => B.formPrecioManual(id(el)),
    'aportacion-activo': el => B.formAportacion(id(el)),
    'clave-twelve': () => B.formClaveTwelve(),
    'actualizar-precios': () => { B.actualizarPrecios({ forzar: true }); },
    'rango-cartera': el => { B.ui.rangoCartera = el.dataset.rango; B.render(); },
    'confirmar-recurrente': el => B.confirmarRecurrente(id(el)),
    'saltar-recurrente': el => {
      const r = B.recurrente(id(el));
      if (r) { B.saltarRecurrente(r); B.render(); B.aviso(`Saltado · próxima vez el ${B.fechaCorta(r.proxima)}`); }
    },
    'informe-modo': el => { B.ui.informe = { ...(B.ui.informe || { anio: new Date().getFullYear() }), modo: el.dataset.modo }; B.render(); },
    'anio-anterior': () => { B.ui.informe.anio--; B.render(); },
    'anio-siguiente': () => { if (B.ui.informe.anio < new Date().getFullYear()) { B.ui.informe.anio++; B.render(); } },
    'exportar-informe': () => B.exportarInforme(),
    'ver-categoria': el => { B.ui.filtros = { texto: '', tipo: '', cuenta: '', categoria: id(el) }; location.hash = 'movimientos'; },
    'nueva-deuda': () => B.formDeuda(),
    'editar-deuda': el => B.formDeuda(id(el)),
    'pagar-deuda': el => B.pagoDeuda(id(el)),
    'activar-sync': () => B.formSync(),
    'sincronizar-ya': () => B.sincronizar({ silencioso: false }),
    'desactivar-sync': async () => {
      if (!await B.confirmar({ titulo: '¿Desactivar la sincronización aquí?', texto: 'Este dispositivo deja de sincronizar. Sus datos se quedan como están, y los de la nube y tus otros dispositivos no se tocan. Puedes volver a activarla cuando quieras con tu token y tu frase.', boton: 'Desactivar' })) return;
      B.desactivarSync(); B.render(); B.aviso('Sincronización desactivada en este dispositivo');
    },
    'activar-pin': () => B.formPin(),
    'cambiar-pin': () => B.formPin(),
    'quitar-pin': () => B.formPin(true),
    'bloquear-ya': () => { B.cerrarModal(); B.bloquear(); },
    'nueva-categoria': () => B.formCategoria(),
    'editar-categoria': el => B.formCategoria(id(el)),
    'borrar-regla': el => { B.borrarRegla(id(el)); B.render(); B.aviso('Regla borrada'); },
    'exportar': () => B.exportarCopia(),
    'restaurar': () => B.restaurarCopia(),
    'abrir-mas': () => menuMas(),
    'empezar-cero': async () => {
      if (!await B.confirmar({ titulo: '¿Empezar con tus datos?', texto: 'Se borran los datos de ejemplo y te quedas con la app vacía, con las categorías y reglas listas. Lo primero será crear tu cuenta.', boton: 'Empezar' })) return;
      B.reiniciar('vacio'); B.ui.mes = B.mesActual(); B.cerrarModal();
      location.hash = 'inicio'; B.render(); B.formCuenta();
    },
    'cargar-ejemplo': async () => {
      if (B.sync?.cfg) { B.aviso('Desactiva antes la sincronización: si no, los datos de ejemplo llegarían a tus otros dispositivos'); return; }
      if (!await B.confirmar({ titulo: '¿Cargar datos de ejemplo?', texto: 'Sustituyen a los datos que tienes ahora. Si quieres conservarlos, haz antes una copia.', boton: 'Cargar ejemplo', peligro: true })) return;
      B.reiniciar('ejemplo'); B.ui.mes = B.mesActual(); B.render(); B.aviso('Datos de ejemplo cargados');
    },
    'borrar-todo': async () => {
      const conSync = !!B.sync?.cfg;
      if (!await B.confirmar({ titulo: '¿Borrar todos los datos?', texto: conSync
        ? 'Se eliminan cuentas, movimientos, presupuestos, metas e inversiones. Como la sincronización está activada, también se borrarán en tus otros dispositivos. Si solo quieres limpiar este, desactiva antes la sincronización. No se puede deshacer.'
        : 'Se eliminan cuentas, movimientos, presupuestos, metas e inversiones de este dispositivo. No se puede deshacer.', boton: 'Borrar todo', peligro: true })) return;
      B.reiniciar('vacio'); B.ui.mes = B.mesActual(); location.hash = 'inicio'; B.render(); B.aviso('Datos borrados');
    },
  };

  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-accion]');
    if (!el || el.disabled) return;
    const f = B.acciones[el.dataset.accion];
    if (f) { ev.preventDefault(); f(el, ev); }
  });

  window.addEventListener('hashchange', () => {
    B.cerrarModal();
    B.render();
    window.scrollTo(0, 0);
  });

  /* ---------- Arranque ---------- */
  const apuntarVencidos = () => {
    const n = B.procesarRecurrentes();
    if (n) B.aviso(`Se han apuntado ${n} movimiento${n === 1 ? '' : 's'} recurrente${n === 1 ? '' : 's'}`);
    return n;
  };
  B.cargar();
  B.aplicarTema();
  B.iniciarBloqueo();
  montarMarco();
  apuntarVencidos();
  B.render();

  /* ---------- Sincronización ---------- */
  B.alTraerDatos = () => {
    B.aplicarTema();
    apuntarVencidos();
    if (!document.querySelector('.capa') && !(document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))) B.render();
  };
  B.alCambiarSync(() => {
    const c = document.getElementById('aj-sync-cuerpo');
    if (c) c.innerHTML = B.tarjetaSync();
  });
  if (B.sync.cfg) setTimeout(() => B.sincronizar(), 800);
  setInterval(() => { if (B.sync.cfg && document.visibilityState === 'visible') B.sincronizar(); }, 3 * 60e3);
  // Si la app se queda abierta (por ejemplo en el móvil) y cambia el día, apunta lo que toque al volver
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!document.querySelector('.capa') && apuntarVencidos()) B.render();
    if (B.sync.cfg) B.sincronizar();
    if (B.estado.activos.length && Date.now() - B.precios.ultima > 30e3) B.actualizarPrecios();
  });

  /* ---------- Precios en vivo ---------- */
  const enPantallaConPrecios = () => ['inicio', 'inversiones'].includes(rutaActual());
  const ocupado = () => document.querySelector('.capa') || (document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName));
  B.alCambiarPrecios(() => {
    // Solo la etiqueta de estado mientras carga; la pantalla entera cuando llegan precios nuevos
    if (B.precios.cargando) { document.querySelectorAll('.estado-precios').forEach(el => { el.innerHTML = B.pildoraPrecios(); }); return; }
    if (enPantallaConPrecios() && !ocupado()) B.render();
    else document.querySelectorAll('.estado-precios').forEach(el => { el.innerHTML = B.pildoraPrecios(); });
  });
  let historialPedido = false;
  const ciclo = async () => {
    if (document.visibilityState !== 'visible' || !B.estado.activos.length && !(B.estado.ajustes.tasaAuto !== false)) return;
    await B.actualizarPrecios();
    if (!historialPedido && B.precios.estado === 'ok') {
      historialPedido = true;
      // Sustituye el historial de ejemplo por el real (de uno en uno para no saturar el servicio)
      for (const a of B.estado.activos.filter(x => x.historialSintetico && x.fuente === 'coingecko').slice(0, 4)) {
        if (await B.rellenarHistorial(a)) { if (enPantallaConPrecios() && !ocupado()) B.render(); }
      }
    }
  };
  setTimeout(ciclo, 400);
  setInterval(ciclo, 60e3);
})(window.B);
