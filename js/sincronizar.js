/* Bolsillo · sincronización entre dispositivos
   Los datos se cifran en el dispositivo (AES-GCM con una clave derivada de tu frase) y se guardan
   en un gist secreto de tu cuenta de GitHub. Cada dispositivo fusiona sus cambios con los de la nube. */
(function (B) {
  'use strict';
  const esc = B.esc;
  const CLAVE_CFG = 'bolsillo.sync';
  const CLAVE_BASE = 'bolsillo.sync.base';
  const ARCHIVO = 'bolsillo.sync.json';
  const API = 'https://api.github.com';
  const ITERACIONES = 310000;

  const leer = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const escribir = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };

  const S = B.sync = { cfg: leer(CLAVE_CFG), ocupado: false, estado: 'apagado', error: '', ultima: 0 };
  if (S.cfg) S.estado = 'listo';
  const oyentes = [];
  B.alCambiarSync = fn => oyentes.push(fn);
  const avisar = () => oyentes.forEach(fn => { try { fn(); } catch (e) { /* nada */ } });
  const guardarCfg = () => escribir(CLAVE_CFG, S.cfg);

  /* ---------- Cifrado ---------- */
  const b64 = bytes => { let s = ''; const t = 0x8000; for (let i = 0; i < bytes.length; i += t) s += String.fromCharCode.apply(null, bytes.subarray(i, i + t)); return btoa(s); };
  const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const aleatorio = n => crypto.getRandomValues(new Uint8Array(n));

  async function derivarClave(frase, salt) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(frase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERACIONES, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }
  const claveLocal = async () => crypto.subtle.importKey('raw', deB64(S.cfg.clave), 'AES-GCM', false, ['encrypt', 'decrypt']);

  async function cifrar(estado, clave, rev) {
    const iv = aleatorio(12);
    const datos = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, new TextEncoder().encode(JSON.stringify(estado)));
    return { app: 'Bolsillo', formato: 1, rev, fecha: new Date().toISOString(), dispositivo: S.cfg?.dispositivo || '', salt: S.cfg?.salt, iv: b64(iv), datos: b64(new Uint8Array(datos)) };
  }
  async function descifrar(sobre, clave) {
    try {
      const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(sobre.iv) }, clave, deB64(sobre.datos));
      return JSON.parse(new TextDecoder().decode(plano));
    } catch (e) {
      const err = new Error('La frase de cifrado no coincide con la que usaste en tu otro dispositivo.'); err.frase = true; throw err;
    }
  }

  /* ---------- GitHub ---------- */
  async function api(ruta, { method = 'GET', body, token = S.cfg?.token } = {}) {
    let r;
    try {
      r = await fetch(API + ruta, {
        method, cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      const err = new Error('No hay conexión con GitHub desde esta vista (dentro de la app de Claude no se puede sincronizar; usa la app instalada o el navegador).'); err.red = true; throw err;
    }
    if (r.status === 401) { const e = new Error('GitHub no acepta el token: puede estar mal copiado o haber caducado.'); e.token = true; throw e; }
    if (r.status === 403 || r.status === 429) throw new Error('GitHub ha limitado las peticiones o el token no tiene permiso «gist».');
    if (r.status === 404) { const e = new Error('No se encuentra el archivo de sincronización en GitHub (¿se ha borrado?).'); e.noExiste = true; throw e; }
    if (!r.ok) throw new Error(`GitHub respondió con un error (${r.status}).`);
    return r.json();
  }
  async function leerSobre(gist) {
    const f = gist.files && gist.files[ARCHIVO];
    if (!f) { const e = new Error('El gist no contiene datos de Bolsillo.'); e.noExiste = true; throw e; }
    let texto = f.content;
    if (f.truncated || texto == null) {
      const r = await fetch(f.raw_url, { cache: 'no-store' });
      texto = await r.text();
    }
    return JSON.parse(texto);
  }

  /* ---------- Fusión a tres bandas (base común, este dispositivo, la nube) ---------- */
  const estable = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.keys(x).sort().reduce((o, c) => { o[c] = x[c]; return o; }, {}) : x);
  const igual = (a, b) => estable(a) === estable(b);
  const COLECCIONES = ['cuentas', 'categorias', 'movimientos', 'presupuestos', 'metas', 'reglas', 'recurrentes', 'deudas', 'activos', 'operaciones'];

  function fusionarLista(base = [], local = [], remota = []) {
    const mb = new Map(base.map(x => [x.id, x])), ml = new Map(local.map(x => [x.id, x])), mr = new Map(remota.map(x => [x.id, x]));
    const ids = [...new Set([...local.map(x => x.id), ...remota.map(x => x.id)])];
    const salida = [];
    for (const id of ids) {
      const b = mb.get(id), l = ml.get(id), r = mr.get(id);
      let x;
      if (igual(l, b)) x = r;            // aquí no cambió: vale lo de la nube (incluido borrarlo)
      else if (igual(r, b)) x = l;       // en la nube no cambió: vale lo de aquí
      else x = l !== undefined ? l : r;  // cambió en los dos: gana este dispositivo; si aquí se borró y allí se editó, se conserva
      if (x !== undefined) salida.push(x);
    }
    return salida;
  }
  function fusionarObjeto(base = {}, local = {}, remota = {}) {
    const salida = {};
    for (const k of new Set([...Object.keys(local), ...Object.keys(remota)])) {
      const b = base[k], l = local[k], r = remota[k];
      const x = igual(l, b) ? r : igual(r, b) ? l : (l !== undefined ? l : r);
      if (x !== undefined) salida[k] = x;
    }
    return salida;
  }
  B.fusionarEstados = (base, local, remota) => {
    base = base || {};
    const r = { ...local };
    for (const c of COLECCIONES) r[c] = fusionarLista(base[c], local[c], remota[c]);
    r.ajustes = fusionarObjeto(base.ajustes, local.ajustes, remota.ajustes);
    // Historial de precios: se suman los días conocidos por cualquiera de los dos
    const ids = new Set(r.activos.map(a => a.id));
    r.historial = {};
    for (const id of ids) r.historial[id] = { ...((remota.historial || {})[id] || {}), ...((local.historial || {})[id] || {}) };
    r.ejemplo = !!(local.ejemplo && remota.ejemplo);
    r.version = Math.max(local.version || 0, remota.version || 0);
    return r;
  };

  /* ---------- Ciclo de sincronización ---------- */
  const guardarLocal = B.guardar;            // guardado sin disparar la subida
  /* Lo que cambia solo (precios, divisas) no cuenta como cambio tuyo: viaja, pero no provoca subidas */
  const sinVolatiles = e => {
    if (!e) return e;
    const aj = { ...(e.ajustes || {}) };
    delete aj.fx; if (aj.tasaAuto !== false) delete aj.tasa;
    return {
      ...e, ajustes: aj, historial: null,
      activos: (e.activos || []).map(a => {
        const x = { ...a };
        delete x.precio; delete x.cambio24h; delete x.precioFecha; delete x.mercadoAbierto; delete x.historialSintetico;
        if (x.referencia) { x.referencia = { ...x.referencia }; delete x.referencia.precio; delete x.referencia.cambio24h; delete x.referencia.precioFecha; }
        return x;
      }),
    };
  };
  const mismoContenido = (a, b) => igual(sinVolatiles(a), sinVolatiles(b));
  const hayCambios = () => !mismoContenido(B.estado, leer(CLAVE_BASE));
  const nombreDispositivo = () => {
    const ua = navigator.userAgent;
    return /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Ordenador Windows' : 'Este dispositivo';
  };

  async function subir(revRemota) {
    const rev = (revRemota || 0) + 1;
    const sobre = await cifrar(B.estado, await claveLocal(), rev);
    await api(`/gists/${S.cfg.gistId}`, { method: 'PATCH', body: { files: { [ARCHIVO]: { content: JSON.stringify(sobre) } } } });
    S.cfg.rev = rev;
    escribir(CLAVE_BASE, B.estado);
  }

  /* Trae lo nuevo de la nube, lo fusiona con lo de aquí y sube el resultado si hace falta */
  B.sincronizar = async ({ silencioso = true } = {}) => {
    if (!S.cfg || S.ocupado) return;
    S.ocupado = true; S.estado = 'sincronizando'; avisar();
    let traido = false;
    try {
      const sobre = await leerSobre(await api(`/gists/${S.cfg.gistId}`));
      if (sobre.rev !== S.cfg.rev) {
        const remota = await descifrar(sobre, await claveLocal());
        const local = B.estado;
        const fusion = B.fusionarEstados(leer(CLAVE_BASE), local, remota);
        traido = !mismoContenido(fusion, local);
        B.estado = fusion;
        guardarLocal();
        if (mismoContenido(fusion, remota)) { S.cfg.rev = sobre.rev; escribir(CLAVE_BASE, remota); }
        else await subir(sobre.rev);
      } else if (hayCambios()) {
        await subir(sobre.rev);
      }
      S.cfg.ultima = Date.now(); S.error = ''; S.estado = 'listo';
      guardarCfg();
      if (!silencioso) B.aviso('Sincronizado');
      if (traido) { B.aviso('Datos actualizados desde otro dispositivo'); if (B.alTraerDatos) B.alTraerDatos(); }
    } catch (err) {
      S.estado = 'error'; S.error = err.message;
      if (!silencioso || err.token || err.frase || err.noExiste) B.aviso(err.message);
    } finally {
      S.ocupado = false; avisar();
    }
  };

  // Cada cambio guardado se sube a los pocos segundos
  let temporizador = null;
  B.guardar = () => {
    guardarLocal();
    if (!S.cfg || !hayCambios()) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => B.sincronizar(), 2500);
  };

  /* ---------- Activar y desactivar ---------- */
  const estaVacio = e => !e.cuentas.length && !e.movimientos.length && !e.activos.length;

  B.activarSync = async (token, frase, progreso = () => {}) => {
    token = token.trim();
    progreso('Comprobando el token…');
    const usuario = await api('/user', { token });
    progreso('Buscando datos de Bolsillo en tu cuenta…');
    const lista = await api('/gists?per_page=100', { token });
    const existente = lista.find(g => g.files && g.files[ARCHIVO]);
    if (existente) {
      const sobre = await leerSobre(await api(`/gists/${existente.id}`, { token }));
      progreso('Descifrando con tu frase…');
      const clave = await derivarClave(frase, deB64(sobre.salt));
      const remota = await descifrar(sobre, clave);
      S.cfg = { token, gistId: existente.id, salt: sobre.salt, clave: b64(new Uint8Array(await crypto.subtle.exportKey('raw', clave))), rev: sobre.rev, usuario: usuario.login, dispositivo: nombreDispositivo(), desde: Date.now() };
      guardarCfg();
      if (B.estado.ejemplo || estaVacio(B.estado)) {
        B.estado = remota;
        guardarLocal();
        escribir(CLAVE_BASE, remota);
        S.cfg.ultima = Date.now(); guardarCfg();
        return 'descargado';
      }
      // Los dos tienen datos: se combinan (sin base común, se suman los dos sin perder nada)
      B.estado = B.fusionarEstados({}, B.estado, remota);
      guardarLocal();
      escribir(CLAVE_BASE, remota);
      await subir(sobre.rev);
      S.cfg.ultima = Date.now(); guardarCfg();
      return 'combinado';
    }
    if (B.estado.ejemplo) {
      const e = new Error('Ahora mismo tienes los datos de ejemplo. Pulsa «Empezar con mis datos» (o restaura tu copia) y activa después la sincronización, para no subir datos de ejemplo.');
      throw e;
    }
    progreso('Creando el espacio cifrado en tu cuenta…');
    const salt = aleatorio(16);
    const clave = await derivarClave(frase, salt);
    S.cfg = { token, salt: b64(salt), clave: b64(new Uint8Array(await crypto.subtle.exportKey('raw', clave))), rev: 0, usuario: usuario.login, dispositivo: nombreDispositivo(), desde: Date.now() };
    const sobre = await cifrar(B.estado, clave, 1);
    const g = await api('/gists', { method: 'POST', token, body: { description: 'Bolsillo · datos cifrados (no borrar)', public: false, files: { [ARCHIVO]: { content: JSON.stringify(sobre) } } } });
    S.cfg.gistId = g.id; S.cfg.rev = 1; S.cfg.ultima = Date.now();
    guardarCfg();
    escribir(CLAVE_BASE, B.estado);
    return 'creado';
  };

  B.desactivarSync = () => {
    S.cfg = null; S.estado = 'apagado'; S.error = '';
    escribir(CLAVE_CFG, null); escribir(CLAVE_BASE, null);
    avisar();
  };

  /* ---------- Interfaz ---------- */
  B.tarjetaSync = () => {
    const c = S.cfg;
    if (!c) {
      return `<p class="sub">Tus datos se guardan cifrados en un archivo privado de tu cuenta de GitHub y se mantienen iguales en el móvil y el ordenador, sin copias a mano. Se cifran en tu dispositivo con una frase que solo sabes tú: ni GitHub ni nadie más puede leerlos.</p>
        <div class="botonera"><button type="button" class="boton primario" data-accion="activar-sync">Activar sincronización</button></div>`;
    }
    const estado = S.estado === 'sincronizando' ? '<span class="vivo cargando"><i></i>Sincronizando…</span>'
      : S.estado === 'error' ? `<span class="vivo error"><i></i>${esc(S.error)}</span>`
      : `<span class="vivo ok"><i></i>Activada${c.ultima ? ` · última vez <span data-desde="${c.ultima}">${B.hace ? B.hace(Date.now() - c.ultima) : ''}</span>` : ''}</span>`;
    return `<p class="estado-sync">${estado}</p>
      <p class="sub">Cuenta de GitHub <b>${esc(c.usuario || '')}</b> · este dispositivo: ${esc(c.dispositivo || '')}. Los cambios se suben solos a los pocos segundos y se traen al abrir la app.</p>
      <div class="botonera">
        <button type="button" class="boton" data-accion="sincronizar-ya" ${S.ocupado ? 'disabled' : ''}>Sincronizar ahora</button>
        <button type="button" class="boton peligro" data-accion="desactivar-sync">Desactivar en este dispositivo</button>
      </div>`;
  };

  B.formSync = () => {
    B.abrirModal({
      titulo: 'Sincronizar dispositivos', clase: 'estrecho',
      cuerpo: `<form id="fs" class="formulario" novalidate autocomplete="off">
        <p class="sub">Haz esto en cada dispositivo (ordenador y móvil) con el <b>mismo token</b> y la <b>misma frase</b>.</p>
        <ol class="pasos">
          <li>Abre <a href="https://github.com/settings/tokens/new?scopes=gist&description=Bolsillo" target="_blank" rel="noopener">este enlace de GitHub</a> (ya viene con la casilla <b>gist</b> marcada).</li>
          <li>En <b>Expiration</b> elige <b>No expiration</b> (o un año) y pulsa <b>Generate token</b> abajo del todo.</li>
          <li>Copia el token (empieza por <b>ghp_</b>) y pégalo aquí. Guárdalo también en un lugar seguro para el otro dispositivo.</li>
        </ol>
        <label class="campo"><span>Token de GitHub</span><input id="fs-token" spellcheck="false" autocapitalize="off" placeholder="ghp_…"></label>
        <label class="campo"><span>Frase de cifrado</span><input id="fs-frase" type="password" autocapitalize="off" placeholder="Al menos 10 caracteres"></label>
        <label class="campo"><span>Repite la frase</span><input id="fs-frase2" type="password" autocapitalize="off"></label>
        <label class="check"><input type="checkbox" id="fs-ver"> Mostrar la frase</label>
        <p class="ayuda">Si olvidas la frase, nadie puede recuperar los datos de la nube (tampoco nosotros). Los datos de cada dispositivo siguen ahí. El token solo da permiso para gestionar gists; no toca tus repositorios.</p>
        <p class="ayuda" id="fs-progreso"></p>
        <p class="error" id="fs-error" hidden></p>
      </form>`,
      pie: '<button type="button" class="boton" data-cerrar>Cancelar</button><button type="submit" class="boton primario" form="fs" id="fs-ok">Activar</button>',
      alMontar(md) {
        const $ = s => md.querySelector(s);
        const error = t => { const p = $('#fs-error'); p.textContent = t; p.hidden = !t; };
        $('#fs-ver').addEventListener('change', ev => { ['#fs-frase', '#fs-frase2'].forEach(s => { $(s).type = ev.target.checked ? 'text' : 'password'; }); });
        $('#fs').addEventListener('submit', async ev => {
          ev.preventDefault();
          error('');
          const token = $('#fs-token').value.trim(), frase = $('#fs-frase').value;
          if (!/^(ghp_|github_pat_|gho_)/.test(token)) return error('Pega el token de GitHub: empieza por «ghp_» (o «github_pat_»).');
          if (frase.length < 10) return error('La frase debe tener al menos 10 caracteres.');
          if (frase !== $('#fs-frase2').value) return error('Las dos frases no coinciden.');
          $('#fs-ok').disabled = true;
          try {
            const r = await B.activarSync(token, frase, t => { $('#fs-progreso').textContent = t; });
            B.cerrarModal(); B.render();
            B.aviso(r === 'descargado' ? 'Sincronización activada: datos traídos de tu otro dispositivo' : r === 'combinado' ? 'Sincronización activada: se han combinado los datos de los dos dispositivos' : 'Sincronización activada. Ahora actívala en tu otro dispositivo con el mismo token y frase');
          } catch (err) {
            S.cfg = leer(CLAVE_CFG);
            $('#fs-progreso').textContent = '';
            error(err.message);
            $('#fs-ok').disabled = false;
          }
        });
      },
    });
  };
})(window.B);
