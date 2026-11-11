/* Bolsillo · bloqueo con PIN (y Face ID / huella si el dispositivo lo permite)
   Es una protección de pantalla: evita que otra persona vea tus finanzas al abrir la app.
   El PIN se guarda resumido (PBKDF2), nunca tal cual, y no viaja con la sincronización. */
(function (B) {
  'use strict';
  const CLAVE = 'bolsillo.pin';
  const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)); } catch (e) { return null; } };
  const escribir = v => { try { if (v) localStorage.setItem(CLAVE, JSON.stringify(v)); else localStorage.removeItem(CLAVE); } catch (e) { /* nada */ } };
  const b64 = bytes => btoa(String.fromCharCode(...bytes));
  const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  const L = B.bloqueo = { cfg: leer(), bloqueado: false, oculto: 0, fallos: 0, esperaHasta: 0 };

  async function resumen(pin, salt) {
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: deB64(salt), iterations: 150000, hash: 'SHA-256' }, k, 256);
    return b64(new Uint8Array(bits));
  }
  const comprobar = async pin => !!L.cfg && await resumen(pin, L.cfg.salt) === L.cfg.hash;

  B.biometriaDisponible = async () => {
    try {
      return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
    } catch (e) { return false; }
  };

  /* ---------- Pantalla de bloqueo ---------- */
  function pintarBloqueo() {
    let capa = document.getElementById('bloqueo');
    if (!capa) { capa = document.createElement('div'); capa.id = 'bloqueo'; capa.className = 'bloqueo'; document.body.appendChild(capa); }
    const n = L.cfg.largo || 4;
    capa.innerHTML = `
      <div class="bloqueo-caja" role="dialog" aria-modal="true" aria-label="Bolsillo está bloqueado">
        <span class="marca-logo grande">${B.icono('logo')}</span>
        <h1>Bolsillo</h1>
        <p class="sub" id="bl-texto">Introduce tu PIN</p>
        <div class="pin-puntos" id="bl-puntos" aria-hidden="true">${'<i></i>'.repeat(n)}</div>
        <input id="bl-oculto" class="pin-oculto" inputmode="numeric" autocomplete="off" aria-label="PIN" maxlength="${n}">
        <div class="teclado" role="group" aria-label="Teclado numérico">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<button type="button" data-tecla="${d}">${d}</button>`).join('')}
          <button type="button" class="tecla-sec" id="bl-bio" hidden aria-label="Desbloquear con Face ID o huella">${B.icono('huella')}</button>
          <button type="button" data-tecla="0">0</button>
          <button type="button" class="tecla-sec" data-tecla="borrar" aria-label="Borrar">${B.icono('izq')}</button>
        </div>
        <button type="button" class="enlace" id="bl-olvido">¿Has olvidado el PIN?</button>
        <div id="bl-olvido-panel" class="olvido" hidden>
          <p>El PIN no se puede recuperar. Puedes borrar los datos de este dispositivo y empezar de nuevo${B.sync?.cfg ? '; como tienes la sincronización activada, los recuperarás al activarla otra vez con tu token y tu frase' : '; si tienes una copia de seguridad, podrás restaurarla'}.</p>
          <div class="botonera"><button type="button" class="boton" id="bl-cancelar">Cancelar</button><button type="button" class="boton peligro-lleno" id="bl-borrar">Borrar datos de este dispositivo</button></div>
        </div>
      </div>`;
    let pin = '';
    const puntos = () => capa.querySelectorAll('#bl-puntos i').forEach((p, i) => p.classList.toggle('lleno', i < pin.length));
    const texto = t => { capa.querySelector('#bl-texto').textContent = t; };
    const intentar = async () => {
      if (Date.now() < L.esperaHasta) { texto(`Espera ${Math.ceil((L.esperaHasta - Date.now()) / 1000)} s para volver a intentarlo`); pin = ''; puntos(); return; }
      if (await comprobar(pin)) { L.fallos = 0; desbloquear(); return; }
      L.fallos++;
      pin = ''; puntos();
      const caja = capa.querySelector('.bloqueo-caja');
      caja.classList.remove('temblor'); void caja.offsetWidth; caja.classList.add('temblor');
      if (L.fallos >= 5) { L.esperaHasta = Date.now() + 30000 * Math.pow(2, L.fallos - 5); texto('Demasiados intentos. Espera un poco.'); }
      else texto(`PIN incorrecto · te quedan ${5 - L.fallos} intentos`);
    };
    const pulsar = t => {
      if (t === 'borrar') pin = pin.slice(0, -1);
      else if (pin.length < n) pin += t;
      puntos();
      if (pin.length === n) setTimeout(intentar, 120);
    };
    capa.querySelectorAll('[data-tecla]').forEach(b => b.addEventListener('click', () => pulsar(b.dataset.tecla)));
    const oculto = capa.querySelector('#bl-oculto');
    oculto.addEventListener('input', () => {
      const d = oculto.value.replace(/\D/g, '');
      oculto.value = '';
      for (const c of d) pulsar(c);
    });
    capa._tecla = ev => {
      if (!L.bloqueado) return;
      if (/^\d$/.test(ev.key)) { ev.preventDefault(); pulsar(ev.key); }
      else if (ev.key === 'Backspace') { ev.preventDefault(); pulsar('borrar'); }
    };
    document.addEventListener('keydown', capa._tecla);
    capa.querySelector('#bl-olvido').addEventListener('click', () => { capa.querySelector('#bl-olvido-panel').hidden = false; });
    capa.querySelector('#bl-cancelar').addEventListener('click', () => { capa.querySelector('#bl-olvido-panel').hidden = true; });
    capa.querySelector('#bl-borrar').addEventListener('click', () => {
      try { Object.keys(localStorage).filter(k => k.startsWith('bolsillo')).forEach(k => localStorage.removeItem(k)); } catch (e) { /* nada */ }
      location.reload();
    });
    if (L.cfg.credencial) {
      B.biometriaDisponible().then(ok => {
        const b = capa.querySelector('#bl-bio');
        if (!ok || !b) return;
        b.hidden = false;
        b.addEventListener('click', usarBiometria);
      });
    }
    if (window.matchMedia('(pointer: fine)').matches) oculto.focus();
  }

  async function usarBiometria() {
    try {
      await navigator.credentials.get({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: deB64(L.cfg.credencial) }],
        userVerification: 'required', timeout: 60000,
      } });
      desbloquear();
    } catch (e) {
      const t = document.querySelector('#bl-texto');
      if (t) t.textContent = 'No se pudo usar Face ID o la huella. Introduce tu PIN.';
    }
  }

  B.bloquear = () => {
    if (!L.cfg) return;
    L.bloqueado = true;
    document.documentElement.classList.add('con-bloqueo');
    pintarBloqueo();
  };
  function desbloquear() {
    L.bloqueado = false;
    const capa = document.getElementById('bloqueo');
    if (capa) { document.removeEventListener('keydown', capa._tecla); capa.classList.add('saliendo'); setTimeout(() => capa.remove(), 200); }
    document.documentElement.classList.remove('con-bloqueo');
  }

  /* Al volver a la app tras un rato fuera, se bloquea de nuevo */
  document.addEventListener('visibilitychange', () => {
    if (!L.cfg) return;
    if (document.visibilityState === 'hidden') { L.oculto = Date.now(); if ((L.cfg.tras || 0) === 0) B.bloquear(); }
    else if (!L.bloqueado && L.oculto && Date.now() - L.oculto >= (L.cfg.tras || 0) * 60e3) B.bloquear();
  });
  B.iniciarBloqueo = () => { if (L.cfg) B.bloquear(); };

  /* ---------- Configuración ---------- */
  const TRAS = [[0, 'Al salir de la app'], [1, 'Tras 1 minuto fuera'], [5, 'Tras 5 minutos fuera'], [15, 'Tras 15 minutos fuera']];

  B.tarjetaBloqueo = () => {
    const c = L.cfg;
    if (!c) {
      return `<p class="sub">Pide un PIN al abrir Bolsillo, para que nadie que coja tu móvil u ordenador vea tus finanzas. Se configura en cada dispositivo.</p>
        <div class="botonera"><button type="button" class="boton primario" data-accion="activar-pin">Activar PIN</button></div>`;
    }
    return `<p class="estado-sync"><span class="vivo ok"><i></i>PIN activado en este dispositivo</span></p>
      <div class="ajuste">
        <div><strong>Bloquear</strong></div>
        <select id="aj-tras" class="entrada">${TRAS.map(([v, t]) => `<option value="${v}" ${v === (c.tras || 0) ? 'selected' : ''}>${t}</option>`).join('')}</select>
      </div>
      <div class="ajuste" id="aj-bio-fila" hidden>
        <div><strong>Face ID o huella</strong><p class="sub">Desbloquea sin escribir el PIN.</p></div>
        <label class="check"><input type="checkbox" id="aj-bio" ${c.credencial ? 'checked' : ''}> Usar</label>
      </div>
      <p class="sub">El PIN protege la pantalla; los datos siguen guardados en el navegador de este dispositivo.</p>
      <div class="botonera">
        <button type="button" class="boton" data-accion="bloquear-ya">Bloquear ahora</button>
        <button type="button" class="boton" data-accion="cambiar-pin">Cambiar PIN</button>
        <button type="button" class="boton peligro" data-accion="quitar-pin">Quitar PIN</button>
      </div>`;
  };

  B.montarAjustesBloqueo = raiz => {
    if (!L.cfg) return;
    const tras = raiz.querySelector('#aj-tras');
    if (tras) tras.addEventListener('change', () => { L.cfg.tras = Number(tras.value); escribir(L.cfg); B.aviso('Guardado'); });
    B.biometriaDisponible().then(ok => {
      const fila = raiz.querySelector('#aj-bio-fila');
      if (!ok || !fila) return;
      fila.hidden = false;
      raiz.querySelector('#aj-bio').addEventListener('change', async ev => {
        if (!ev.target.checked) { delete L.cfg.credencial; escribir(L.cfg); B.aviso('Face ID o huella desactivado'); return; }
        try {
          const cred = await navigator.credentials.create({ publicKey: {
            rp: { name: 'Bolsillo', id: location.hostname },
            user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'bolsillo', displayName: 'Bolsillo' },
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
            authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
            timeout: 60000, attestation: 'none',
          } });
          L.cfg.credencial = b64(new Uint8Array(cred.rawId));
          escribir(L.cfg);
          B.aviso('Listo: podrás desbloquear con Face ID o huella');
        } catch (e) {
          ev.target.checked = false;
          B.aviso('No se pudo activar Face ID o la huella en este dispositivo');
        }
      });
    });
  };

  /* Crear o cambiar el PIN (si ya hay uno, se pide el actual) */
  B.formPin = (quitar = false) => {
    const hay = !!L.cfg;
    B.abrirModal({
      titulo: quitar ? 'Quitar PIN' : hay ? 'Cambiar PIN' : 'Activar PIN', clase: 'estrecho',
      cuerpo: `<form id="fpin" class="formulario" novalidate autocomplete="off">
        ${hay ? '<label class="campo"><span>PIN actual</span><input id="fpin-actual" type="password" inputmode="numeric" maxlength="6" autocomplete="off"></label>' : ''}
        ${quitar ? '' : `<label class="campo"><span>${hay ? 'PIN nuevo' : 'Elige un PIN'} (4 a 6 cifras)</span><input id="fpin-nuevo" type="password" inputmode="numeric" maxlength="6" autocomplete="off" ${hay ? '' : 'autofocus'}></label>
        <label class="campo"><span>Repítelo</span><input id="fpin-nuevo2" type="password" inputmode="numeric" maxlength="6" autocomplete="off"></label>
        <p class="ayuda">Si lo olvidas no se puede recuperar: tendrías que borrar los datos de este dispositivo (y traerlos de la sincronización o de una copia).</p>`}
        <p class="error" id="fpin-error" hidden></p>
      </form>`,
      pie: `<button type="button" class="boton" data-cerrar>Cancelar</button><button type="submit" class="boton ${quitar ? 'peligro-lleno' : 'primario'}" form="fpin">${quitar ? 'Quitar PIN' : 'Guardar PIN'}</button>`,
      alMontar(md) {
        const $ = s => md.querySelector(s);
        const error = t => { const p = $('#fpin-error'); p.textContent = t; p.hidden = !t; };
        $('#fpin').addEventListener('submit', async ev => {
          ev.preventDefault();
          if (hay && !(await comprobar($('#fpin-actual').value))) return error('El PIN actual no es correcto.');
          if (quitar) { L.cfg = null; escribir(null); B.cerrarModal(); B.render(); B.aviso('PIN quitado'); return; }
          const pin = $('#fpin-nuevo').value;
          if (!/^\d{4,6}$/.test(pin)) return error('El PIN debe tener entre 4 y 6 cifras.');
          if (/^(\d)\1+$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) return error('Ese PIN es demasiado fácil de adivinar. Prueba con otro.');
          if (pin !== $('#fpin-nuevo2').value) return error('Los dos PIN no coinciden.');
          const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
          L.cfg = { ...(L.cfg || { tras: 1 }), salt, hash: await resumen(pin, salt), largo: pin.length };
          escribir(L.cfg);
          B.cerrarModal(); B.render();
          B.aviso(hay ? 'PIN cambiado' : 'PIN activado');
        });
      },
    });
  };
})(window.B);
