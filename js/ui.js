/* Bolsillo · utilidades de interfaz: formato, iconos, ventanas y avisos */
(function (B) {
  'use strict';

  B.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Formato ---------- */
  const formatos = {};
  B.dinero = (n, moneda, opc = {}) => {
    moneda = moneda || B.estado.ajustes.moneda;
    const dec = opc.sinDecimales ? 0 : 2;
    const k = moneda + dec;
    if (!formatos[k]) {
      formatos[k] = new Intl.NumberFormat('es-ES', { style: 'currency', currency: moneda, currencyDisplay: 'narrowSymbol', minimumFractionDigits: dec, maximumFractionDigits: dec });
    }
    const v = Math.abs(n) < 0.005 ? 0 : n;
    return formatos[k].format(v || 0);
  };
  const compacto = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });
  B.compacto = n => compacto.format(n);
  B.aInput = n => (n === undefined || n === null || n === '') ? '' : String(n).replace('.', ',');

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const mayus = s => s.charAt(0).toUpperCase() + s.slice(1);
  const partes = f => { const [y, m, d] = f.split('-').map(Number); return { y, m, d, fecha: new Date(y, m - 1, d) }; };

  B.nombreMes = mes => { const [y, m] = mes.split('-').map(Number); return `${mayus(MESES[m - 1])} ${y}`; };
  B.mesCorto = mes => MESES[Number(mes.split('-')[1]) - 1].slice(0, 3);
  B.fechaCorta = f => { const p = partes(f); return `${p.d} ${MESES[p.m - 1].slice(0, 3)}${p.y !== new Date().getFullYear() ? ' ' + p.y : ''}`; };
  B.fechaLarga = f => { const p = partes(f); return `${p.d} de ${MESES[p.m - 1]} de ${p.y}`; };
  B.fechaDia = (f, absoluta) => {
    const hoy = B.hoyISO();
    const ayer = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return B.iso(d.getFullYear(), d.getMonth(), d.getDate()); })();
    if (!absoluta && f === hoy) return 'Hoy';
    if (!absoluta && f === ayer) return 'Ayer';
    const p = partes(f);
    return `${mayus(DIAS[p.fecha.getDay()])}, ${p.d} de ${MESES[p.m - 1]}`;
  };

  /* ---------- Iconos (trazo, 24×24) ---------- */
  const P = {
    inicio: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    movimientos: 'M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3',
    cuentas: 'M3 7.5A2.5 2.5 0 0 1 5.5 5H17v3.5M3 7.5V18a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9.5a1 1 0 0 0-1-1H5.5A2.5 2.5 0 0 1 3 7.5zM16.5 14.25h.01',
    presupuestos: 'M12 3v9h9M20.5 15.5A9 9 0 1 1 8.5 3.7',
    metas: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12h.01',
    ajustes: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
    ruta: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
    recurrentes: 'M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5',
    deudas: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6.5 12h.01M17.5 12h.01',
    inversiones: 'M3 17l6-6 4 4 8-8M15 7h6v6',
    informes: 'M5 20V11M11 20V5M17 20v-7M3 20h18',
    mas: 'M12 5v14M5 12h14',
    puntos: 'M5 12h.01M12 12h.01M19 12h.01',
    cerrar: 'M6 6l12 12M18 6 6 18',
    editar: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
    izq: 'M15 18l-6-6 6-6',
    der: 'M9 6l6 6-6 6',
    buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
    transferir: 'M4 8h15l-3-3M20 16H5l3 3',
    importar: 'M12 3v12M7 10l5 5 5-5M5 21h14',
    exportar: 'M12 15V3M7 8l5-5 5 5M5 21h14',
    alerta: 'M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    efectivo: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
    tarjeta: 'M3 6h18v12H3zM3 10h18M7 15h3',
    banco: 'M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
    ahorro: 'M5 11a7 6 0 0 1 13-2.5l2 .5v4l-2 .7A7 6 0 0 1 15 17v2h-3v-1.5h-3V19H6v-2.6A6 6 0 0 1 5 11zM15 10h.01M3 9.5c.5 1 1.3 1.5 2.2 1.5',
    inversion: 'M3 17l6-6 4 4 8-8M15 7h6v6',
    logo: 'M5 7h14v5a7 7 0 0 1-14 0zM9 7V4.5h6V7M9.5 12.5h5',
    huella: 'M12 11v2.5a9 9 0 0 1-1.6 5.1M8.6 9.4A3.6 3.6 0 0 1 15.6 11v2.6M6.4 7.2A6.6 6.6 0 0 1 18.6 11v1.6M5.4 10.6v2.2c0 1.3-.3 2.6-.9 3.7M15.5 16.7c-.3 1.2-.7 2.3-1.3 3.3M18.4 15.6l-.2.8',
    nube: 'M7 18h10.5a4.5 4.5 0 0 0 .6-8.96A6 6 0 0 0 6.6 8.6 4.7 4.7 0 0 0 7 18z',
    candado: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  };
  B.icono = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${P[n] || ''}"/></svg>`;

  /* ---------- Ventanas (modales apilables) ---------- */
  const capas = [];
  function cerrarCapa(capa) {
    const i = capas.indexOf(capa);
    if (i < 0) return;
    capas.splice(i, 1);
    capa.classList.remove('visible');
    if (capa._alCerrar) capa._alCerrar();
    setTimeout(() => capa.remove(), 180);
    if (!capas.length) document.body.classList.remove('sin-scroll');
  }
  B.cerrarCapa = cerrarCapa;
  B.cerrarModal = () => { [...capas].reverse().forEach(cerrarCapa); };

  B.abrirModal = ({ titulo, cuerpo, pie = '', clase = '', alMontar, alCerrar, apilar = false }) => {
    if (!apilar) B.cerrarModal();
    const capa = document.createElement('div');
    capa.className = 'capa';
    capa.innerHTML = `
      <div class="modal ${clase}" role="dialog" aria-modal="true" aria-label="${B.esc(titulo)}">
        <header class="modal-cab">
          <h2>${B.esc(titulo)}</h2>
          <button type="button" class="boton-icono" data-cerrar aria-label="Cerrar">${B.icono('cerrar')}</button>
        </header>
        <div class="modal-cuerpo">${cuerpo}</div>
        ${pie ? `<footer class="modal-pie">${pie}</footer>` : ''}
      </div>`;
    capa._alCerrar = alCerrar;
    capa.addEventListener('mousedown', e => { capa._pulsadoFuera = e.target === capa; });
    capa.addEventListener('click', e => {
      if ((e.target === capa && capa._pulsadoFuera) || e.target.closest('[data-cerrar]')) cerrarCapa(capa);
    });
    document.body.appendChild(capa);
    document.body.classList.add('sin-scroll');
    capas.push(capa);
    requestAnimationFrame(() => capa.classList.add('visible'));
    const modal = capa.querySelector('.modal');
    if (alMontar) alMontar(modal);
    const foco = modal.querySelector('[autofocus]');
    if (foco && window.matchMedia('(pointer: fine)').matches) foco.focus();
    return modal;
  };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && capas.length) cerrarCapa(capas[capas.length - 1]);
  });

  B.confirmar = ({ titulo, texto, boton = 'Aceptar', peligro = false }) => new Promise(resolver => {
    let hecho = false;
    const modal = B.abrirModal({
      titulo, apilar: true, clase: 'estrecho',
      cuerpo: `<p class="texto-confirmar">${texto}</p>`,
      pie: `<button type="button" class="boton" data-cerrar>Cancelar</button><button type="button" class="boton ${peligro ? 'peligro-lleno' : 'primario'}" data-ok>${B.esc(boton)}</button>`,
      alCerrar: () => { if (!hecho) resolver(false); },
    });
    modal.querySelector('[data-ok]').addEventListener('click', () => {
      hecho = true;
      cerrarCapa(modal.closest('.capa'));
      resolver(true);
    });
  });

  /* ---------- Avisos breves ---------- */
  B.aviso = texto => {
    const cont = document.getElementById('avisos');
    if (!cont) return;
    const el = document.createElement('div');
    el.className = 'aviso';
    el.textContent = texto;
    cont.appendChild(el);
    setTimeout(() => { el.classList.add('sale'); setTimeout(() => el.remove(), 250); }, 2600);
  };

  B.copiar = (texto, campo) => {
    const fallo = () => { if (campo) { campo.focus(); campo.select(); } B.aviso('Selecciona el texto y cópialo a mano'); };
    try {
      navigator.clipboard.writeText(texto).then(() => B.aviso('Copiado'), fallo);
    } catch (err) { fallo(); }
  };
})(window.B);
