/* Bolsillo · formularios (crear y editar) */
(function (B) {
  'use strict';
  const esc = B.esc;
  const SIMBOLO = { EUR: '€', USD: '$' };
  const COLORES = ['#8a9bff', '#3ecf8e', '#4fb0dd', '#e6c050', '#f0a35e', '#e57fa8', '#b48af0', '#4fd1c1', '#d9785f', '#9ccc5a', '#ff8fa0', '#8f97a8'];

  const opciones = (lista, sel) => lista.map(x => `<option value="${esc(x.id)}" ${x.id === sel ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('');
  const selColores = (nombre, actual) => {
    const lista = COLORES.includes(actual) || !actual ? COLORES : [actual, ...COLORES];
    const sel = actual || lista[0];
    return `<div class="colores" role="radiogroup" aria-label="Color">${lista.map(c =>
      `<label><input type="radio" name="${nombre}" value="${c}" ${c === sel ? 'checked' : ''} aria-label="Color ${c}"><span style="--c:${c}"></span></label>`).join('')}</div>`;
  };
  const pie = (formId, conBorrar, textoOk = 'Guardar') =>
    `${conBorrar ? `<button type="button" class="boton peligro izq" id="${formId}-borrar">Borrar</button>` : ''}
     <button type="button" class="boton" data-cerrar>Cancelar</button>
     <button type="submit" class="boton primario" form="${formId}">${textoOk}</button>`;
  const fallo = (modal, sel) => texto => { const p = modal.querySelector(sel); p.textContent = texto; p.hidden = false; };
  const terminar = texto => { B.cerrarModal(); B.render(); B.aviso(texto); };

  /* ---------- Movimiento ---------- */
  B.formMovimiento = (id, preset = {}) => {
    const e = B.estado;
    if (!e.cuentas.length) { B.aviso('Primero crea una cuenta'); B.formCuenta(); return; }
    const m = id ? e.movimientos.find(x => x.id === id) : null;
    const tipo0 = m ? m.tipo : (preset.tipo || 'gasto');
    let cuenta0 = m ? m.cuentaId : (preset.cuentaId || B.ui.ultimaCuenta);
    if (!B.cuenta(cuenta0)) cuenta0 = e.cuentas[0].id;
    const tipos = [['gasto', 'Gasto'], ['ingreso', 'Ingreso'], ['transferencia', 'Transferencia']];

    const cuerpo = `<form id="fm" class="formulario" novalidate autocomplete="off">
      <div class="segmentado tipos" role="radiogroup" aria-label="Tipo">${tipos.map(([v, t]) =>
        `<label class="seg-${v}"><input type="radio" name="fm-tipo" value="${v}" ${v === tipo0 ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
      <label class="campo campo-importe"><span>Importe</span>
        <input id="fm-importe" inputmode="decimal" placeholder="0,00" value="${B.aInput(m?.importe)}" ${m ? '' : 'autofocus'}><em id="fm-simbolo"></em>
      </label>
      <div class="fila2">
        <label class="campo"><span>Fecha</span><input id="fm-fecha" type="date" value="${m ? m.fecha : B.hoyISO()}"></label>
        <label class="campo"><span id="fm-l-cuenta">Cuenta</span><select id="fm-cuenta">${opciones(e.cuentas, cuenta0)}</select></label>
      </div>
      <div class="fila2" id="fm-bloque-destino">
        <label class="campo"><span>Cuenta destino</span><select id="fm-destino"></select></label>
        <label class="campo" id="fm-c-recibido"><span id="fm-l-recibido">Importe recibido</span><input id="fm-recibido" inputmode="decimal" value="${B.aInput(m?.importeDestino)}"></label>
      </div>
      <label class="campo" id="fm-c-cat"><span>Categoría</span><select id="fm-cat"></select></label>
      <label class="campo"><span>Concepto</span><input id="fm-nota" maxlength="80" placeholder="Ej.: Mercadona, nómina, cena con amigos" value="${esc(m?.nota || '')}"></label>
      ${m ? '' : '<label class="check"><input type="checkbox" id="fm-repetir"> Se repite cada mes (se apuntará solo)</label>'}
      <p class="error" id="fm-error" hidden></p>
    </form>`;

    B.abrirModal({
      titulo: m ? 'Editar movimiento' : 'Nuevo movimiento', cuerpo, pie: pie('fm', !!m),
      alMontar(md) {
        const $ = s => md.querySelector(s);
        const error = fallo(md, '#fm-error');
        let catTocada = !!m, recibidoTocado = !!(m && m.importeDestino != null);
        const tipo = () => md.querySelector('input[name=fm-tipo]:checked').value;

        const pintar = () => {
          const t = tipo(), cta = B.cuenta($('#fm-cuenta').value);
          $('#fm-simbolo').textContent = SIMBOLO[cta.moneda];
          $('#fm-l-cuenta').textContent = t === 'transferencia' ? 'Desde la cuenta' : 'Cuenta';
          $('#fm-bloque-destino').hidden = t !== 'transferencia';
          $('#fm-c-cat').hidden = t === 'transferencia';
          if (t === 'transferencia') {
            const dest = $('#fm-destino');
            const previa = dest.value || m?.cuentaDestinoId;
            const otras = e.cuentas.filter(c => c.id !== cta.id);
            dest.innerHTML = otras.length ? opciones(otras, otras.some(c => c.id === previa) ? previa : otras[0].id) : '<option value="">Necesitas otra cuenta</option>';
            const cd = B.cuenta(dest.value);
            const distinta = !!cd && cd.moneda !== cta.moneda;
            $('#fm-c-recibido').hidden = !distinta;
            if (cd) $('#fm-l-recibido').textContent = `Llega a destino (${SIMBOLO[cd.moneda]})`;
            if (distinta && !recibidoTocado) {
              const n = B.numero($('#fm-importe').value);
              $('#fm-recibido').value = isFinite(n) && n > 0 ? B.aInput(B.convertir(n, cta.moneda, cd.moneda).toFixed(2)) : '';
            }
          } else {
            const sel = $('#fm-cat');
            const previa = sel.value || m?.categoriaId;
            const cats = e.categorias.filter(c => c.tipo === t);
            sel.innerHTML = opciones(cats, cats.some(c => c.id === previa) ? previa : cats[0]?.id);
          }
        };
        const sugerir = () => {
          if (catTocada || tipo() === 'transferencia') return;
          const c = B.categorizar($('#fm-nota').value, tipo());
          if (c) $('#fm-cat').value = c;
        };

        md.querySelectorAll('input[name=fm-tipo]').forEach(r => r.addEventListener('change', () => { catTocada = false; pintar(); sugerir(); }));
        $('#fm-cuenta').addEventListener('change', pintar);
        $('#fm-destino').addEventListener('change', () => { recibidoTocado = false; pintar(); });
        $('#fm-importe').addEventListener('input', () => { if (tipo() === 'transferencia') pintar(); });
        $('#fm-recibido').addEventListener('input', () => { recibidoTocado = true; });
        $('#fm-cat').addEventListener('change', () => { catTocada = true; });
        $('#fm-nota').addEventListener('input', sugerir);
        pintar();

        $('#fm').addEventListener('submit', ev => {
          ev.preventDefault();
          const t = tipo();
          const importe = B.numero($('#fm-importe').value);
          if (!isFinite(importe) || importe <= 0) return error('Escribe un importe mayor que cero, por ejemplo 12,50.');
          const fecha = $('#fm-fecha').value;
          if (!fecha) return error('Elige una fecha.');
          const datos = { ...(m || {}), id: m?.id || B.uid(), tipo: t, importe: B.redondear(importe), fecha, cuentaId: $('#fm-cuenta').value, nota: $('#fm-nota').value.trim() };
          delete datos.cuentaDestinoId; delete datos.importeDestino;
          if (t === 'transferencia') {
            const dest = $('#fm-destino').value;
            if (!dest) return error('Para transferir necesitas al menos dos cuentas.');
            datos.cuentaDestinoId = dest;
            datos.categoriaId = null;
            if (B.cuenta(dest).moneda !== B.cuenta(datos.cuentaId).moneda) {
              const rec = B.numero($('#fm-recibido').value);
              if (!isFinite(rec) || rec <= 0) return error('Indica cuánto llega a la cuenta destino.');
              datos.importeDestino = B.redondear(rec);
            }
          } else datos.categoriaId = $('#fm-cat').value;
          let repite = false;
          if (!m && $('#fm-repetir')?.checked) {
            const rec = { id: B.uid(), tipo: t, importe: datos.importe, cuentaId: datos.cuentaId, frecuencia: 'mensual', dia: Number(fecha.slice(8)), automatico: true, activo: true };
            rec.nombre = datos.nota || (t === 'transferencia' ? 'Transferencia' : B.categoria(datos.categoriaId)?.nombre || 'Recurrente');
            if (t === 'transferencia') rec.cuentaDestinoId = datos.cuentaDestinoId; else rec.categoriaId = datos.categoriaId;
            rec.proxima = B.siguienteFecha(rec, fecha);
            B.guardarRecurrente(rec);
            datos.recurrenteId = rec.id;
            repite = true;
          }
          B.guardarMovimiento(datos);
          B.ui.ultimaCuenta = datos.cuentaId;
          if (repite) B.procesarRecurrentes();
          terminar(m ? 'Movimiento actualizado' : repite ? 'Guardado · se repetirá cada mes' : 'Movimiento guardado');
        });

        if (m) $('#fm-borrar').addEventListener('click', async () => {
          if (await B.confirmar({ titulo: '¿Borrar este movimiento?', texto: 'Desaparecerá de la lista y los saldos se recalcularán.', boton: 'Borrar', peligro: true })) {
            B.borrarMovimiento(m.id); terminar('Movimiento borrado');
          }
        });
      },
    });
  };

  /* ---------- Cuenta ---------- */
  B.formCuenta = id => {
    const e = B.estado, c = id ? B.cuenta(id) : null;
    const usados = c ? e.movimientos.filter(m => m.cuentaId === id || m.cuentaDestinoId === id).length : 0;
    const cuerpo = `<form id="fc" class="formulario" novalidate autocomplete="off">
      <label class="campo"><span>Nombre</span><input id="fc-nombre" maxlength="40" placeholder="Ej.: Cuenta nómina, Tarjeta Visa" value="${esc(c?.nombre || '')}" autofocus></label>
      <div class="fila2">
        <label class="campo"><span>Tipo</span><select id="fc-tipo">${Object.entries(B.TIPOS_CUENTA).map(([v, t]) => `<option value="${v}" ${v === (c?.tipo || 'banco') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Moneda</span><select id="fc-moneda">${['EUR', 'USD'].map(v => `<option value="${v}" ${v === (c?.moneda || e.ajustes.moneda) ? 'selected' : ''}>${v === 'EUR' ? 'Euro (€)' : 'Dólar ($)'}</option>`).join('')}</select></label>
      </div>
      <label class="campo"><span>Saldo inicial</span><input id="fc-saldo" inputmode="decimal" placeholder="0,00" value="${B.aInput(c?.saldoInicial)}">
        <small class="ayuda">Lo que había en la cuenta antes del primer movimiento que registres. En una tarjeta de crédito, lo que debías, en negativo (por ejemplo −120).</small></label>
      <div class="campo"><span>Color</span>${selColores('fc-color', c?.color)}</div>
      <p class="error" id="fc-error" hidden></p>
    </form>`;
    B.abrirModal({
      titulo: c ? 'Editar cuenta' : 'Nueva cuenta', cuerpo, pie: pie('fc', !!c),
      alMontar(md) {
        const $ = s => md.querySelector(s);
        const error = fallo(md, '#fc-error');
        $('#fc').addEventListener('submit', ev => {
          ev.preventDefault();
          const nombre = $('#fc-nombre').value.trim();
          if (!nombre) return error('Ponle un nombre a la cuenta.');
          const txt = $('#fc-saldo').value.trim();
          const saldo = txt ? B.numero(txt.replace('−', '-')) : 0;
          if (!isFinite(saldo)) return error('El saldo inicial no es un número válido.');
          const nueva = !c;
          B.guardarCuenta({ ...(c || {}), id: c?.id || B.uid(), nombre, tipo: $('#fc-tipo').value, moneda: $('#fc-moneda').value, saldoInicial: B.redondear(saldo), color: md.querySelector('input[name=fc-color]:checked').value });
          terminar(nueva ? 'Cuenta creada' : 'Cuenta actualizada');
        });
        if (c) $('#fc-borrar').addEventListener('click', async () => {
          if (await B.confirmar({ titulo: `¿Borrar «${c.nombre}»?`, texto: usados ? `También se borrarán sus ${usados} movimientos. No se puede deshacer.` : 'No tiene movimientos. No se puede deshacer.', boton: 'Borrar cuenta', peligro: true })) {
            B.borrarCuenta(c.id); terminar('Cuenta borrada');
          }
        });
      },
    });
  };

  /* ---------- Presupuesto ---------- */
  B.formPresupuesto = (id, catPreset) => {
    const e = B.estado, p = id ? e.presupuestos.find(x => x.id === id) : null;
    const libres = e.categorias.filter(c => c.tipo === 'gasto' && (!e.presupuestos.some(x => x.categoriaId === c.id) || c.id === p?.categoriaId));
    if (!libres.length) { B.aviso('Todas tus categorías de gasto ya tienen presupuesto'); return; }
    const sel = p?.categoriaId || (libres.some(c => c.id === catPreset) ? catPreset : libres[0].id);
    const mon = e.ajustes.moneda;
    const media = (() => { let s = 0; for (let i = 1; i <= 3; i++) s += B.gastoCategoria(sel, B.sumarMes(B.mesActual(), -i)); return s / 3; })();
    const cuerpo = `<form id="fp" class="formulario" novalidate autocomplete="off">
      <label class="campo"><span>Categoría</span><select id="fp-cat">${opciones(libres, sel)}</select></label>
      <label class="campo campo-importe"><span>Límite al mes</span><input id="fp-limite" inputmode="decimal" placeholder="0" value="${B.aInput(p?.limite)}" autofocus><em>${SIMBOLO[mon]}</em></label>
      <p class="ayuda" id="fp-media">${media > 0 ? `Los últimos 3 meses gastaste de media ${B.dinero(media)} al mes en esta categoría.` : 'Se aplica todos los meses.'}</p>
      <p class="error" id="fp-error" hidden></p>
    </form>`;
    B.abrirModal({
      titulo: p ? 'Editar presupuesto' : 'Nuevo presupuesto', cuerpo, pie: pie('fp', !!p), clase: 'estrecho',
      alMontar(md) {
        const $ = s => md.querySelector(s);
        const error = fallo(md, '#fp-error');
        $('#fp-cat').addEventListener('change', ev => {
          let s = 0; for (let i = 1; i <= 3; i++) s += B.gastoCategoria(ev.target.value, B.sumarMes(B.mesActual(), -i));
          $('#fp-media').textContent = s > 0 ? `Los últimos 3 meses gastaste de media ${B.dinero(s / 3)} al mes en esta categoría.` : 'Se aplica todos los meses.';
        });
        $('#fp').addEventListener('submit', ev => {
          ev.preventDefault();
          const limite = B.numero($('#fp-limite').value);
          if (!isFinite(limite) || limite <= 0) return error('Escribe un límite mayor que cero.');
          B.guardarPresupuesto({ id: p?.id || B.uid(), categoriaId: $('#fp-cat').value, limite: B.redondear(limite) });
          terminar(p ? 'Presupuesto actualizado' : 'Presupuesto creado');
        });
        if (p) $('#fp-borrar').addEventListener('click', async () => {
          if (await B.confirmar({ titulo: '¿Quitar este presupuesto?', texto: 'Tus movimientos no se tocan; solo desaparece el límite.', boton: 'Quitar', peligro: true })) {
            B.borrarPresupuesto(p.id); terminar('Presupuesto quitado');
          }
        });
      },
    });
  };

  /* ---------- Meta ---------- */
  B.formMeta = id => {
    const e = B.estado, m = id ? e.metas.find(x => x.id === id) : null;
    const cuerpo = `<form id="fg" class="formulario" novalidate autocomplete="off">
      <label class="campo"><span>Nombre</span><input id="fg-nombre" maxlength="40" placeholder="Ej.: Viaje, coche, fondo de emergencia" value="${esc(m?.nombre || '')}" autofocus></label>
      <div class="fila2">
        <label class="campo"><span>Objetivo (${SIMBOLO[e.ajustes.moneda]})</span><input id="fg-objetivo" inputmode="decimal" placeholder="0" value="${B.aInput(m?.objetivo)}"></label>
        <label class="campo"><span>Ya ahorrado (${SIMBOLO[e.ajustes.moneda]})</span><input id="fg-ahorrado" inputmode="decimal" placeholder="0" value="${B.aInput(m?.ahorrado)}"></label>
      </div>
      <label class="campo"><span>Fecha límite (opcional)</span><input id="fg-fecha" type="date" value="${m?.fechaLimite || ''}"></label>
      <div class="campo"><span>Color</span>${selColores('fg-color', m?.color)}</div>
      <p class="error" id="fg-error" hidden></p>
    </form>`;
    B.abrirModal({
      titulo: m ? 'Editar meta' : 'Nueva meta', cuerpo, pie: pie('fg', !!m),
      alMontar(md) {
        const $ = s => md.querySelector(s);
        const error = fallo(md, '#fg-error');
        $('#fg').addEventListener('submit', ev => {
          ev.preventDefault();
          const nombre = $('#fg-nombre').value.trim();
          const objetivo = B.numero($('#fg-objetivo').value);
          const ahorradoTxt = $('#fg-ahorrado').value.trim();
          const ahorrado = ahorradoTxt ? B.numero(ahorradoTxt) : 0;
          if (!nombre) return error('Ponle un nombre a la meta.');
          if (!isFinite(objetivo) || objetivo <= 0) return error('El objetivo tiene que ser mayor que cero.');
          if (!isFinite(ahorrado) || ahorrado < 0) return error('Lo ahorrado no es un número válido.');
          B.guardarMeta({ id: m?.id || B.uid(), nombre, objetivo: B.redondear(objetivo), ahorrado: B.redondear(ahorrado), fechaLimite: $('#fg-fecha').value, color: md.querySelector('input[name=fg-color]:checked').value });
          terminar(m ? 'Meta actualizada' : 'Meta creada');
        });
        if (m) $('#fg-borrar').addEventListener('click', async () => {
          if (await B.confirmar({ titulo: `¿Borrar «${m.nombre}»?`, texto: 'No afecta a tus cuentas ni movimientos.', boton: 'Borrar meta', peligro: true })) {
            B.borrarMeta(m.id); terminar('Meta borrada');
          }
        });
      },
    });
  };

  B.aportarMeta = id => {
    const m = B.estado.metas.find(x => x.id === id);
    if (!m) return;
    const cuerpo = `<form id="fa" class="formulario" novalidate autocomplete="off">
      <p class="sub">Llevas <b class="num">${B.dinero(m.ahorrado)}</b> de ${B.dinero(m.objetivo)}.</p>
      <label class="campo campo-importe"><span>Importe</span><input id="fa-importe" inputmode="decimal" placeholder="0,00" autofocus><em>${SIMBOLO[B.estado.ajustes.moneda]}</em></label>
      <p class="error" id="fa-error" hidden></p>
    </form>`;
    B.abrirModal({
      titulo: m.nombre, cuerpo, clase: 'estrecho',
      pie: `<button type="button" class="boton izq" id="fa-retirar">Retirar</button><button type="submit" class="boton primario" form="fa">Añadir</button>`,
      alMontar(md) {
        const error = fallo(md, '#fa-error');
        const aplicar = signo => {
          const n = B.numero(md.querySelector('#fa-importe').value);
          if (!isFinite(n) || n <= 0) return error('Escribe un importe mayor que cero.');
          m.ahorrado = B.redondear(Math.max(0, m.ahorrado + signo * n));
          B.guardarMeta(m);
          terminar(signo > 0 ? `Añadido a ${m.nombre}` : `Retirado de ${m.nombre}`);
        };
        md.querySelector('#fa').addEventListener('submit', ev => { ev.preventDefault(); aplicar(1); });
        md.querySelector('#fa-retirar').addEventListener('click', () => aplicar(-1));
      },
    });
  };

  /* ---------- Categoría ---------- */
  B.formCategoria = id => {
    const e = B.estado, c = id ? B.categoria(id) : null;
    const fija = c && (c.id === 'otros-gasto' || c.id === 'otros-ingreso');
    const usos = c ? e.movimientos.filter(m => m.categoriaId === c.id).length : 0;
    const tipo = c?.tipo || 'gasto';
    const cuerpo = `<form id="fk" class="formulario" novalidate autocomplete="off">
      <label class="campo"><span>Nombre</span><input id="fk-nombre" maxlength="32" value="${esc(c?.nombre || '')}" placeholder="Ej.: Gimnasio" autofocus></label>
      <div class="campo"><span>Tipo</span><div class="segmentado">${[['gasto', 'Gasto'], ['ingreso', 'Ingreso']].map(([v, t]) =>
        `<label><input type="radio" name="fk-tipo" value="${v}" ${v === tipo ? 'checked' : ''} ${c ? 'disabled' : ''}><span>${t}</span></label>`).join('')}</div></div>
      <div class="campo"><span>Color</span>${selColores('fk-color', c?.color)}</div>
      ${c ? `<p class="ayuda">${usos ? `Usada en ${usos} movimientos.` : 'Sin movimientos todavía.'}</p>` : ''}
      <p class="error" id="fk-error" hidden></p>
    </form>`;
    B.abrirModal({
      titulo: c ? 'Editar categoría' : 'Nueva categoría', cuerpo, pie: pie('fk', !!c && !fija), clase: 'estrecho',
      alMontar(md) {
        const $ = s => md.querySelector(s);
        const error = fallo(md, '#fk-error');
        $('#fk').addEventListener('submit', ev => {
          ev.preventDefault();
          const nombre = $('#fk-nombre').value.trim();
          if (!nombre) return error('Ponle un nombre a la categoría.');
          B.guardarCategoria({ id: c?.id || B.uid(), nombre, tipo: c?.tipo || md.querySelector('input[name=fk-tipo]:checked').value, color: md.querySelector('input[name=fk-color]:checked').value });
          terminar(c ? 'Categoría actualizada' : 'Categoría creada');
        });
        if (c && !fija) $('#fk-borrar').addEventListener('click', async () => {
          const destino = c.tipo === 'gasto' ? 'Otros gastos' : 'Otros ingresos';
          if (await B.confirmar({ titulo: `¿Borrar «${c.nombre}»?`, texto: usos ? `Sus ${usos} movimientos pasarán a «${destino}». También se quitan su presupuesto y sus reglas.` : 'No tiene movimientos.', boton: 'Borrar categoría', peligro: true })) {
            B.borrarCategoria(c.id); terminar('Categoría borrada');
          }
        });
      },
    });
  };

  /* ---------- Recurrente ---------- */
  B.formRecurrente = (id, preset = {}) => {
    const e = B.estado;
    if (!e.cuentas.length) { B.aviso('Primero crea una cuenta'); B.formCuenta(); return; }
    const r = id ? B.recurrente(id) : null;
    const v = { tipo: 'gasto', frecuencia: 'mensual', automatico: true, activo: true, proxima: B.sumarDias(B.hoyISO(), 1), ...preset, ...(r || {}) };
    if (!B.cuenta(v.cuentaId)) v.cuentaId = e.cuentas[0].id;
    const debo = e.deudas.filter(d => d.tipo === 'debo');
    const seg = (nombre, valor, ops, extraClase = '') => `<div class="segmentado ${extraClase}" role="radiogroup">${ops.map(([val, t, cls = '']) =>
      `<label class="${cls}"><input type="radio" name="${nombre}" value="${val}" ${String(val) === String(valor) ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>`;

    const cuerpo = `<form id="fr" class="formulario" novalidate autocomplete="off">
      ${seg('fr-tipo', v.tipo, [['gasto', 'Gasto', 'seg-gasto'], ['ingreso', 'Ingreso', 'seg-ingreso'], ['transferencia', 'Transferencia']])}
      <label class="campo"><span>Concepto</span><input id="fr-nombre" maxlength="60" placeholder="Ej.: Alquiler, Netflix, Nómina" value="${esc(v.nombre || '')}" ${r ? '' : 'autofocus'}></label>
      <label class="campo campo-importe"><span id="fr-l-importe">Importe</span><input id="fr-importe" inputmode="decimal" placeholder="0,00" value="${B.aInput(v.importe)}"><em id="fr-simbolo"></em></label>
      <div class="fila2">
        <label class="campo"><span id="fr-l-cuenta">Cuenta</span><select id="fr-cuenta">${opciones(e.cuentas, v.cuentaId)}</select></label>
        <label class="campo" id="fr-c-cat"><span>Categoría</span><select id="fr-cat"></select></label>
        <label class="campo" id="fr-c-destino"><span>Cuenta destino</span><select id="fr-destino"></select></label>
      </div>
      <div class="fila2">
        <label class="campo"><span>Se repite</span><select id="fr-frec">${Object.entries(B.FRECUENCIAS).map(([k, t]) => `<option value="${k}" ${k === v.frecuencia ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Próxima vez</span><input id="fr-proxima" type="date" value="${v.proxima}"></label>
      </div>
      <div class="campo"><span>Cómo se apunta</span>
        ${seg('fr-auto', v.automatico ? '1' : '0', [['1', 'Se apunta solo'], ['0', 'Pedir confirmación']])}
        <small class="ayuda" id="fr-ayuda-auto"></small>
      </div>
      ${debo.length ? `<label class="campo" id="fr-c-deuda"><span>Reduce la deuda (opcional)</span><select id="fr-deuda"><option value="">Ninguna</option>${opciones(debo, v.deudaId)}</select></label>` : ''}
      <label class="campo"><span>Hasta (opcional)</span><input id="fr-hasta" type="date" value="${v.hasta || ''}"><small class="ayuda">Déjalo vacío si no tiene fin.</small></label>
      ${r ? `<label class="check"><input type="checkbox" id="fr-pausa" ${r.activo ? '' : 'checked'}> En pausa (no se apunta ni aparece en próximos)</label>` : ''}
      <p class="error" id="fr-error" hidden></p>
    </form>`;

    B.abrirModal({
      titulo: r ? 'Editar recurrente' : 'Nuevo recurrente', cuerpo, pie: pie('fr', !!r),
      alMontar(md) {
        const $ = s => md.querySelector(s);
        const error = fallo(md, '#fr-error');
        const tipo = () => md.querySelector('input[name=fr-tipo]:checked').value;
        const auto = () => md.querySelector('input[name=fr-auto]:checked').value === '1';
        const pintar = () => {
          const t = tipo(), cta = B.cuenta($('#fr-cuenta').value);
          $('#fr-simbolo').textContent = SIMBOLO[cta.moneda];
          $('#fr-l-cuenta').textContent = t === 'transferencia' ? 'Desde la cuenta' : 'Cuenta';
          $('#fr-c-cat').hidden = t === 'transferencia';
          $('#fr-c-destino').hidden = t !== 'transferencia';
          if ($('#fr-c-deuda')) $('#fr-c-deuda').hidden = t !== 'gasto';
          if (t === 'transferencia') {
            const prev = $('#fr-destino').value || v.cuentaDestinoId;
            const otras = e.cuentas.filter(c => c.id !== cta.id);
            $('#fr-destino').innerHTML = otras.length ? opciones(otras, otras.some(c => c.id === prev) ? prev : otras[0].id) : '<option value="">Necesitas otra cuenta</option>';
          } else {
            const prev = $('#fr-cat').value || v.categoriaId;
            const cats = e.categorias.filter(c => c.tipo === t);
            $('#fr-cat').innerHTML = opciones(cats, cats.some(c => c.id === prev) ? prev : cats[0]?.id);
          }
          $('#fr-l-importe').textContent = auto() ? 'Importe' : 'Importe aproximado';
          $('#fr-ayuda-auto').textContent = auto()
            ? 'Cuando llegue la fecha se registra el movimiento automáticamente. Ideal para importes fijos: alquiler, cuotas, suscripciones.'
            : 'Cuando llegue la fecha te avisamos en el Resumen para que pongas el importe real. Ideal para la luz, el agua o el gas.';
        };
        let catTocada = !!r;
        md.querySelectorAll('input[name=fr-tipo], input[name=fr-auto]').forEach(x => x.addEventListener('change', pintar));
        $('#fr-cuenta').addEventListener('change', pintar);
        $('#fr-cat').addEventListener('change', () => { catTocada = true; });
        $('#fr-nombre').addEventListener('input', () => {
          if (catTocada || tipo() === 'transferencia') return;
          const c = B.categorizar($('#fr-nombre').value, tipo());
          if (c) $('#fr-cat').value = c;
        });
        pintar();

        $('#fr').addEventListener('submit', ev => {
          ev.preventDefault();
          const t = tipo();
          const nombre = $('#fr-nombre').value.trim();
          const importe = B.numero($('#fr-importe').value);
          const proxima = $('#fr-proxima').value;
          if (!nombre) return error('Ponle un concepto, por ejemplo «Alquiler».');
          if (!isFinite(importe) || importe <= 0) return error('Escribe un importe mayor que cero.');
          if (!proxima) return error('Elige cuándo toca la próxima vez.');
          const hasta = $('#fr-hasta').value;
          if (hasta && hasta < proxima) return error('La fecha final es anterior a la próxima vez.');
          const datos = {
            ...(r || {}), id: r?.id || B.uid(), nombre, tipo: t, importe: B.redondear(importe), cuentaId: $('#fr-cuenta').value,
            frecuencia: $('#fr-frec').value, proxima, dia: Number(proxima.slice(8)), automatico: auto(), hasta,
            activo: r ? !$('#fr-pausa').checked : true,
          };
          delete datos.cuentaDestinoId; delete datos.categoriaId; delete datos.deudaId;
          if (t === 'transferencia') {
            if (!$('#fr-destino').value) return error('Para transferir necesitas al menos dos cuentas.');
            datos.cuentaDestinoId = $('#fr-destino').value;
          } else datos.categoriaId = $('#fr-cat').value;
          if (t === 'gasto' && $('#fr-deuda')?.value) datos.deudaId = $('#fr-deuda').value;
          B.guardarRecurrente(datos);
          const n = B.procesarRecurrentes();
          terminar(n ? `Guardado · se han apuntado ${n} movimiento${n === 1 ? '' : 's'} con fecha pasada` : (r ? 'Recurrente actualizado' : 'Recurrente creado'));
        });
        if (r) $('#fr-borrar').addEventListener('click', async () => {
          if (await B.confirmar({ titulo: `¿Borrar «${r.nombre}»?`, texto: 'Dejará de apuntarse. Los movimientos que ya se registraron se quedan.', boton: 'Borrar', peligro: true })) {
            B.borrarRecurrente(r.id); terminar('Recurrente borrado');
          }
        });
      },
    });
  };

  B.confirmarRecurrente = id => {
    const r = B.recurrente(id);
    if (!r) return;
    const cta = B.cuenta(r.cuentaId);
    const cuerpo = `<form id="fx" class="formulario" novalidate autocomplete="off">
      <p class="sub">${esc(r.nombre)} · ${esc(cta?.nombre || '?')} · ${B.FRECUENCIAS[r.frecuencia].toLowerCase()}</p>
      <label class="campo campo-importe"><span>Importe real</span><input id="fx-importe" inputmode="decimal" value="${B.aInput(r.importe)}" autofocus><em>${SIMBOLO[cta?.moneda || 'EUR']}</em></label>
      <label class="campo"><span>Fecha del cargo</span><input id="fx-fecha" type="date" value="${r.proxima}"></label>
      <label class="check"><input type="checkbox" id="fx-guardar"> Usar este importe como habitual a partir de ahora</label>
      <p class="error" id="fx-error" hidden></p>
    </form>`;
    B.abrirModal({
      titulo: 'Registrar recurrente', cuerpo, clase: 'estrecho',
      pie: `<button type="button" class="boton izq" id="fx-saltar">Saltar esta vez</button><button type="submit" class="boton primario" form="fx">Registrar</button>`,
      alMontar(md) {
        const error = fallo(md, '#fx-error');
        md.querySelector('#fx').addEventListener('submit', ev => {
          ev.preventDefault();
          const n = B.numero(md.querySelector('#fx-importe').value);
          const fecha = md.querySelector('#fx-fecha').value;
          if (!isFinite(n) || n <= 0) return error('Escribe un importe mayor que cero.');
          if (!fecha) return error('Elige la fecha del cargo.');
          if (md.querySelector('#fx-guardar').checked) r.importe = B.redondear(n);
          B.registrarRecurrente(r, fecha, n);
          B.guardar();
          terminar(`${r.nombre} registrado`);
        });
        md.querySelector('#fx-saltar').addEventListener('click', () => { B.saltarRecurrente(r); terminar(`Saltado · próxima vez el ${B.fechaCorta(r.proxima)}`); });
      },
    });
  };

  /* ---------- Deuda ---------- */
  B.formDeuda = id => {
    const e = B.estado, d = id ? B.deuda(id) : null;
    const mon = d?.moneda || e.ajustes.moneda;
    const tipo0 = d?.tipo || 'debo';
    const cuerpo = `<form id="fd" class="formulario" novalidate autocomplete="off">
      <div class="segmentado" role="radiogroup">${[['debo', 'Yo debo'], ['me-deben', 'Me deben']].map(([v, t]) =>
        `<label><input type="radio" name="fd-tipo" value="${v}" ${v === tipo0 ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
      <label class="campo"><span>Nombre</span><input id="fd-nombre" maxlength="40" placeholder="Ej.: Préstamo del coche, Hipoteca" value="${esc(d?.nombre || '')}" ${d ? '' : 'autofocus'}></label>
      <label class="campo"><span id="fd-l-persona">Banco o persona</span><input id="fd-persona" maxlength="40" value="${esc(d?.persona || '')}"></label>
      <div class="fila2">
        <label class="campo"><span>Importe total (${SIMBOLO[mon]})</span><input id="fd-total" inputmode="decimal" placeholder="0,00" value="${B.aInput(d?.total)}"></label>
        <label class="campo"><span>Queda por ${tipo0 === 'debo' ? 'pagar' : 'cobrar'} (${SIMBOLO[mon]})</span><input id="fd-pendiente" inputmode="decimal" placeholder="Igual que el total" value="${B.aInput(d?.pendiente)}"></label>
      </div>
      <div class="fila2">
        <label class="campo"><span>Interés anual % (opcional)</span><input id="fd-interes" inputmode="decimal" placeholder="Ej.: 6,5" value="${d?.interes ? B.aInput(d.interes) : ''}"></label>
        <label class="campo"><span>Cuota al mes (opcional)</span><input id="fd-cuota" inputmode="decimal" placeholder="0,00" value="${d?.cuota ? B.aInput(d.cuota) : ''}"></label>
      </div>
      <p class="ayuda" id="fd-plan"></p>
      ${d ? '' : `<div id="fd-bloque-auto" class="bloque-auto" hidden>
        <label class="check"><input type="checkbox" id="fd-auto" checked> Apuntar la cuota cada mes automáticamente</label>
        <div class="fila2" id="fd-auto-campos">
          <label class="campo"><span>Desde la cuenta</span><select id="fd-cuenta">${opciones(e.cuentas, e.cuentas[0]?.id)}</select></label>
          <label class="campo"><span>Próxima cuota</span><input id="fd-fecha" type="date" value="${B.sumarMesesFecha(B.hoyISO(), 1, 1)}"></label>
        </div>
      </div>`}
      <div class="campo"><span>Color</span>${selColores('fd-color', d?.color)}</div>
      <p class="error" id="fd-error" hidden></p>
    </form>`;
    B.abrirModal({
      titulo: d ? 'Editar deuda' : 'Nueva deuda', cuerpo, pie: pie('fd', !!d),
      alMontar(md) {
        const $ = s => md.querySelector(s);
        const error = fallo(md, '#fd-error');
        const tipo = () => md.querySelector('input[name=fd-tipo]:checked').value;
        const leer = () => {
          const total = B.numero($('#fd-total').value);
          const pTxt = $('#fd-pendiente').value.trim();
          return { total, pendiente: pTxt ? B.numero(pTxt) : total, interes: B.numero($('#fd-interes').value) || 0, cuota: B.numero($('#fd-cuota').value) || 0 };
        };
        const pintar = () => {
          $('#fd-l-persona').textContent = tipo() === 'debo' ? 'Banco o persona a quien debes' : 'Quién te lo debe';
          const x = leer();
          const plan = isFinite(x.pendiente) && x.pendiente > 0 ? B.planDeuda(x) : null;
          $('#fd-plan').innerHTML = !plan ? '' : plan.noCubre
            ? `<span class="rojo">Con esa cuota solo cubres intereses (${B.dinero(plan.interesMes, mon)} al mes): la deuda no bajaría.</span>`
            : `Con esta cuota terminarías en ${B.nombreMes(plan.fin).toLowerCase()} (${plan.n} cuotas)${plan.intereses > 0.5 ? `, pagando unos ${B.dinero(plan.intereses, mon, { sinDecimales: true })} de intereses` : ''}.`;
          if ($('#fd-bloque-auto')) {
            $('#fd-bloque-auto').hidden = !(tipo() === 'debo' && x.cuota > 0 && e.cuentas.length);
            $('#fd-auto-campos').hidden = !$('#fd-auto').checked;
          }
        };
        md.querySelectorAll('input[name=fd-tipo]').forEach(x => x.addEventListener('change', pintar));
        ['#fd-total', '#fd-pendiente', '#fd-interes', '#fd-cuota'].forEach(s => $(s).addEventListener('input', pintar));
        if ($('#fd-auto')) $('#fd-auto').addEventListener('change', pintar);
        pintar();

        $('#fd').addEventListener('submit', ev => {
          ev.preventDefault();
          const nombre = $('#fd-nombre').value.trim();
          const x = leer();
          if (!nombre) return error('Ponle un nombre a la deuda.');
          if (!isFinite(x.total) || x.total <= 0) return error('El importe total tiene que ser mayor que cero.');
          if (!isFinite(x.pendiente) || x.pendiente < 0) return error('Lo que queda no es un número válido.');
          if (x.pendiente > x.total) return error('Lo que queda no puede ser mayor que el total.');
          if (x.interes < 0 || x.cuota < 0) return error('El interés y la cuota no pueden ser negativos.');
          const nueva = {
            ...(d || {}), id: d?.id || B.uid(), nombre, tipo: tipo(), persona: $('#fd-persona').value.trim(),
            total: B.redondear(x.total), pendiente: B.redondear(x.pendiente), interes: x.interes, cuota: B.redondear(x.cuota),
            moneda: mon, color: md.querySelector('input[name=fd-color]:checked').value,
          };
          B.guardarDeuda(nueva);
          let extra = '';
          if (!d && $('#fd-bloque-auto') && !$('#fd-bloque-auto').hidden && $('#fd-auto').checked) {
            const fecha = $('#fd-fecha').value || B.sumarMesesFecha(B.hoyISO(), 1, 1);
            B.guardarRecurrente({ id: B.uid(), nombre: `Cuota ${nombre}`, tipo: 'gasto', importe: nueva.cuota, cuentaId: $('#fd-cuenta').value, categoriaId: 'deudas', frecuencia: 'mensual', proxima: fecha, dia: Number(fecha.slice(8)), automatico: true, activo: true, deudaId: nueva.id });
            const n = B.procesarRecurrentes();
            extra = n ? ` · ${n} cuota${n === 1 ? '' : 's'} apuntada${n === 1 ? '' : 's'}` : ' · cuota mensual programada';
          }
          terminar((d ? 'Deuda actualizada' : 'Deuda creada') + extra);
        });
        if (d) $('#fd-borrar').addEventListener('click', async () => {
          if (await B.confirmar({ titulo: `¿Borrar «${d.nombre}»?`, texto: 'Se quita de tus deudas. Los movimientos ya registrados y las cuotas programadas se quedan (sin vincular).', boton: 'Borrar deuda', peligro: true })) {
            B.borrarDeuda(d.id); terminar('Deuda borrada');
          }
        });
      },
    });
  };

  B.pagoDeuda = id => {
    const e = B.estado, d = B.deuda(id);
    if (!d) return;
    const mon = d.moneda || e.ajustes.moneda;
    const debo = d.tipo === 'debo';
    const sugerido = d.cuota > 0 ? Math.min(d.cuota, d.pendiente) : d.pendiente;
    const cuerpo = `<form id="fq" class="formulario" novalidate autocomplete="off">
      <p class="sub">Quedan <b class="num">${B.dinero(d.pendiente, mon)}</b> de ${B.dinero(d.total, mon)}.</p>
      <label class="campo campo-importe"><span>${debo ? 'Importe pagado' : 'Importe cobrado'}</span><input id="fq-importe" inputmode="decimal" value="${B.aInput(B.redondear(sugerido))}" autofocus><em>${SIMBOLO[mon]}</em></label>
      <div class="fila2">
        <label class="campo"><span>Fecha</span><input id="fq-fecha" type="date" value="${B.hoyISO()}"></label>
        <label class="campo"><span>${debo ? 'Sale de' : 'Entra en'}</span><select id="fq-cuenta">
          ${e.cuentas.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}
          <option value="">No apuntar movimiento</option>
        </select></label>
      </div>
      <p class="ayuda">Si eliges una cuenta, se apunta también como ${debo ? 'gasto en «Préstamos y deudas»' : 'ingreso en «Cobro de deudas»'}.</p>
      <p class="error" id="fq-error" hidden></p>
    </form>`;
    B.abrirModal({
      titulo: debo ? `Pago · ${d.nombre}` : `Cobro · ${d.nombre}`, cuerpo, pie: pie('fq', false, debo ? 'Registrar pago' : 'Registrar cobro'), clase: 'estrecho',
      alMontar(md) {
        const $ = s => md.querySelector(s);
        const error = fallo(md, '#fq-error');
        $('#fq').addEventListener('submit', ev => {
          ev.preventDefault();
          const n = B.numero($('#fq-importe').value);
          const fecha = $('#fq-fecha').value;
          if (!isFinite(n) || n <= 0) return error('Escribe un importe mayor que cero.');
          if (n > d.pendiente + 0.005) return error(`No puede ser más de lo que queda (${B.dinero(d.pendiente, mon)}).`);
          if (!fecha) return error('Elige una fecha.');
          const cuentaId = $('#fq-cuenta').value;
          if (cuentaId) {
            const cta = B.cuenta(cuentaId);
            B.guardarMovimiento({ id: B.uid(), fecha, tipo: debo ? 'gasto' : 'ingreso', importe: B.redondear(B.convertir(n, mon, cta.moneda)), cuentaId, categoriaId: debo ? 'deudas' : 'cobros', nota: `${debo ? 'Pago' : 'Cobro'} ${d.nombre}`, deudaId: d.id });
          }
          d.pendiente = B.redondear(Math.max(0, d.pendiente - n));
          B.guardarDeuda(d);
          terminar(d.pendiente === 0 ? `¡${d.nombre} ${debo ? 'pagada' : 'cobrada'} del todo!` : `${debo ? 'Pago' : 'Cobro'} registrado · quedan ${B.dinero(d.pendiente, mon)}`);
        });
      },
    });
  };

  /* ---------- Copia de seguridad ---------- */
  B.exportarCopia = () => {
    const json = B.exportarJSON();
    const nombre = `bolsillo-copia-${B.hoyISO()}.json`;
    B.abrirModal({
      titulo: 'Hacer copia de seguridad',
      cuerpo: `<div class="formulario">
        <p class="sub">Guarda este archivo en un lugar seguro. Con él puedes recuperar tus datos o pasarlos a otro dispositivo desde «Restaurar copia».</p>
        <textarea id="ex-texto" class="entrada" rows="6" readonly>${esc(json)}</textarea>
        <p class="ayuda">Si la descarga no empieza (pasa dentro de algunas apps), pulsa «Copiar texto» y pégalo en una nota o un correo para ti.</p>
      </div>`,
      pie: `<button type="button" class="boton" id="ex-copiar">Copiar texto</button><button type="button" class="boton primario" id="ex-bajar">${B.icono('exportar')}<span>Descargar archivo</span></button>`,
      alMontar(md) {
        md.querySelector('#ex-copiar').addEventListener('click', () => B.copiar(json, md.querySelector('#ex-texto')));
        md.querySelector('#ex-bajar').addEventListener('click', () => {
          try {
            const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
            const a = document.createElement('a');
            a.href = url; a.download = nombre;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);
            B.aviso(`Descargando ${nombre}`);
          } catch (err) { B.aviso('No se pudo descargar; usa «Copiar texto»'); }
        });
      },
    });
  };

  B.restaurarCopia = () => {
    B.abrirModal({
      titulo: 'Restaurar copia',
      cuerpo: `<div class="formulario">
        <p class="sub">Elige el archivo .json de una copia anterior o pega su contenido. Sustituirá todos los datos que hay ahora en este dispositivo.</p>
        <label class="campo"><span>Archivo de copia</span><input id="rc-archivo" type="file" accept=".json,application/json" class="entrada archivo"></label>
        <label class="campo"><span>O pega el texto</span><textarea id="rc-texto" class="entrada" rows="5" placeholder='{"app": "Bolsillo", ...}'></textarea></label>
        <p class="error" id="rc-error" hidden></p>
      </div>`,
      pie: `<button type="button" class="boton" data-cerrar>Cancelar</button><button type="button" class="boton primario" id="rc-ok">Restaurar</button>`,
      alMontar(md) {
        const error = fallo(md, '#rc-error');
        md.querySelector('#rc-archivo').addEventListener('change', async ev => {
          const f = ev.target.files[0];
          if (f) md.querySelector('#rc-texto').value = await f.text();
        });
        md.querySelector('#rc-ok').addEventListener('click', async () => {
          const texto = md.querySelector('#rc-texto').value.trim();
          if (!texto) return error('Elige un archivo o pega el texto de la copia.');
          if (!await B.confirmar({ titulo: '¿Sustituir los datos actuales?', texto: 'Lo que hay ahora en este dispositivo se reemplazará por la copia.', boton: 'Restaurar', peligro: true })) return;
          try { B.importarJSON(texto); B.aplicarTema(); terminar('Copia restaurada'); }
          catch (err) { error(err.message); }
        });
      },
    });
  };
})(window.B);
