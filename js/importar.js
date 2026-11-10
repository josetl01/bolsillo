/* Bolsillo · importar el extracto del banco (CSV, XLS, XLSX) */
(function (B) {
  'use strict';
  const esc = B.esc;
  const norm = B.norm;

  /* ---------- Lectura ---------- */
  function contarFuera(texto, d) {
    let n = 0, dentro = false;
    for (const c of texto) { if (c === '"') dentro = !dentro; else if (c === d && !dentro) n++; }
    return n;
  }

  B.parsearCSV = texto => {
    texto = texto.replace(/^﻿/, '');
    const muestra = texto.split(/\r?\n/).slice(0, 20).join('\n');
    let delim = ';', mejor = -1;
    for (const d of [';', '\t', ',', '|']) { const n = contarFuera(muestra, d); if (n > mejor) { mejor = n; delim = d; } }
    const filas = [];
    let fila = [], campo = '', comillas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (comillas) {
        if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else comillas = false; }
        else campo += c;
      } else if (c === '"') comillas = true;
      else if (c === delim) { fila.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        fila.push(campo); filas.push(fila); fila = []; campo = '';
      } else campo += c;
    }
    if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
    return filas.map(f => f.map(x => x.trim())).filter(f => f.some(x => x !== ''));
  };

  function cargarLectorExcel() {
    return new Promise((ok, mal) => {
      if (window.XLSX) return ok(window.XLSX);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = () => ok(window.XLSX);
      s.onerror = () => mal(new Error('No se pudo cargar el lector de Excel. Comprueba la conexión a internet o guarda el extracto como CSV.'));
      document.head.appendChild(s);
    });
  }

  B.cargarLectorExcel = cargarLectorExcel;

  async function leerArchivo(archivo) {
    const ext = archivo.name.split('.').pop().toLowerCase();
    const buf = await archivo.arrayBuffer();
    if (['xlsx', 'xls', 'ods'].includes(ext)) {
      const XLSX = await cargarLectorExcel();
      const libro = XLSX.read(buf, { type: 'array', cellDates: true });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      return XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: '' })
        .map(f => f.map(c => typeof c === 'string' ? c.trim() : c))
        .filter(f => f.some(c => c !== '' && c != null));
    }
    let texto = new TextDecoder('utf-8').decode(buf);
    if (texto.includes(String.fromCharCode(0xFFFD))) texto = new TextDecoder('windows-1252').decode(buf); // muchos bancos exportan en Latin-1
    return B.parsearCSV(texto);
  }

  /* ---------- Detección de columnas ---------- */
  const celda = (fila, j) => (j >= 0 && fila ? fila[j] : '');
  const textoCelda = v => v instanceof Date ? B.fechaISO(v) : String(v ?? '');
  const esNumero = v => v !== '' && v != null && !(v instanceof Date) && !B.fechaISO(v) && isFinite(B.numero(v));

  function detectarCabecera(filas) {
    for (let i = 0; i < Math.min(filas.length, 40); i++) {
      const t = filas[i].map(c => norm(textoCelda(c)));
      if (t.some(x => /fecha|date/.test(x)) && t.filter(Boolean).length >= 3 && !filas[i].some(c => B.fechaISO(c))) return i;
    }
    for (let i = 0; i < Math.min(filas.length - 1, 40); i++) {
      if (!filas[i].some(c => B.fechaISO(c)) && filas[i + 1].some(c => B.fechaISO(c))) return i;
    }
    return -1;
  }

  function detectarColumnas(st) {
    const cab = st.cab >= 0 ? st.filas[st.cab].map(c => norm(textoCelda(c))) : [];
    const datos = st.filas.slice(st.cab + 1, st.cab + 31);
    st.ncol = Math.max(cab.length, ...datos.map(f => f.length));
    const busca = (re, no) => cab.findIndex(c => c && re.test(c) && !(no && no.test(c)));
    const col = { fecha: -1, concepto: -1, importe: -1, cargo: -1, abono: -1 };

    col.fecha = busca(/fecha|date|^f\.?\s?(oper|contable)/, /valor/);
    if (col.fecha < 0) col.fecha = busca(/fecha|date|^f\.?\s/);
    col.concepto = busca(/concepto|descripci|detalle|movimiento|description|observaci|beneficiario|comercio/);
    col.importe = busca(/importe|cantidad|amount|monto/, /saldo|divisa/);
    col.cargo = busca(/cargo|^debe$|debito|salida|retirad/);
    col.abono = busca(/abono|^haber$|credito|entrada/);

    const cuenta = prueba => { const r = []; for (let j = 0; j < st.ncol; j++) r.push(datos.filter(f => prueba(celda(f, j))).length); return r; };
    if (col.fecha < 0) {
      const n = cuenta(v => !!B.fechaISO(v));
      const max = Math.max(...n);
      if (max > 0) col.fecha = n.indexOf(max);
    }
    if (col.importe < 0 && (col.cargo < 0 || col.abono < 0)) {
      const n = cuenta(esNumero);
      for (let j = 0; j < st.ncol; j++) {
        if (j === col.fecha || /saldo/.test(cab[j] || '')) continue;
        if (n[j] >= Math.max(1, datos.length * 0.6)) { col.importe = j; break; }
      }
    }
    if (col.concepto < 0) {
      let mejor = 0;
      for (let j = 0; j < st.ncol; j++) {
        if (j === col.fecha || j === col.importe) continue;
        const largo = datos.reduce((a, f) => { const v = celda(f, j); return a + (esNumero(v) || B.fechaISO(v) ? 0 : textoCelda(v).length); }, 0);
        if (largo > mejor) { mejor = largo; col.concepto = j; }
      }
    }
    st.col = col;
    st.modo = col.importe >= 0 ? 'unico' : (col.cargo >= 0 && col.abono >= 0 ? 'separado' : 'unico');
  }

  /* ---------- Vista previa ---------- */
  function construir(st) {
    const cuenta = B.cuenta(st.cuentaId);
    const existentes = B.estado.movimientos.filter(m => m.cuentaId === st.cuentaId);
    const filas = st.filas.slice(st.cab + 1);
    let ignoradas = 0;
    st.prev = [];
    filas.forEach(f => {
      const fecha = B.fechaISO(celda(f, st.col.fecha));
      let imp;
      if (st.modo === 'unico') imp = B.numero(celda(f, st.col.importe));
      else {
        const cargo = B.numero(celda(f, st.col.cargo)), abono = B.numero(celda(f, st.col.abono));
        imp = (isFinite(abono) ? Math.abs(abono) : 0) - (isFinite(cargo) ? Math.abs(cargo) : 0);
      }
      if (st.invertir) imp = -imp;
      if (!fecha || !isFinite(imp) || Math.abs(imp) < 0.005) { ignoradas++; return; }
      const concepto = textoCelda(celda(f, st.col.concepto)).replace(/\s+/g, ' ').trim().slice(0, 80);
      const tipo = imp < 0 ? 'gasto' : 'ingreso';
      const importe = B.redondear(Math.abs(imp));
      const dup = existentes.some(m => m.fecha === fecha && m.tipo === tipo && Math.abs(m.importe - importe) < 0.005);
      st.prev.push({ fecha, concepto, tipo, importe, dup, incluir: !dup, categoriaId: B.categorizar(concepto, tipo) || (tipo === 'gasto' ? 'otros-gasto' : 'otros-ingreso') });
    });
    st.ignoradas = ignoradas;
    st.moneda = cuenta?.moneda;
  }

  B.abrirImportador = () => {
    const e = B.estado;
    if (!e.cuentas.length) { B.aviso('Primero crea una cuenta'); B.formCuenta(); return; }
    const cuenta0 = B.cuenta(B.ui.ultimaCuenta) ? B.ui.ultimaCuenta : (e.cuentas.find(c => c.tipo === 'banco') || e.cuentas[0]).id;
    const st = { filas: null, cab: -1, col: {}, modo: 'unico', invertir: false, cuentaId: cuenta0, prev: [], ignoradas: 0 };

    const cuerpo = `<div class="imp">
      <p class="sub">Descarga el extracto desde la web o la app de tu banco (CSV o Excel) y súbelo aquí. El archivo se lee en este dispositivo y no se envía a ningún sitio.</p>
      ${e.ejemplo ? '<p class="nota-ejemplo">Ahora mismo tienes datos de ejemplo. Si vas a importar tus movimientos reales, antes pulsa «Empezar con mis datos» en el aviso de arriba.</p>' : ''}
      <label class="campo"><span>Cuenta a la que pertenece el extracto</span><select id="im-cuenta" class="entrada">${e.cuentas.map(c => `<option value="${c.id}" ${c.id === cuenta0 ? 'selected' : ''}>${esc(c.nombre)} (${c.moneda})</option>`).join('')}</select></label>
      <label class="zona-archivo" id="im-zona">
        ${B.icono('importar')}
        <strong id="im-nombre">Elige el archivo del extracto</strong>
        <small>CSV, XLS o XLSX · también puedes arrastrarlo aquí</small>
        <input id="im-archivo" type="file" accept=".csv,.txt,.xls,.xlsx,.ods" class="oculto">
      </label>
      <details class="pegar">
        <summary>O pega el contenido de un CSV</summary>
        <textarea id="im-texto" rows="5" class="entrada" placeholder="Fecha;Concepto;Importe&#10;03/11/2026;MERCADONA VALENCIA;-45,20&#10;01/11/2026;NOMINA NOVIEMBRE;2150,00"></textarea>
        <button type="button" class="boton pequeno" id="im-leer">Leer texto pegado</button>
      </details>
      <p class="error" id="im-error" hidden></p>

      <section class="imp-seccion" id="im-mapa" hidden>
        <div><h3>Columnas</h3><p class="sub">Las hemos detectado solas. Cámbialas si algo no cuadra en la vista previa.</p></div>
        <div class="mapa">
          <label class="campo"><span>Fila de títulos</span><select id="im-cab" class="entrada"></select></label>
          <label class="campo"><span>Fecha</span><select class="entrada" data-col="fecha"></select></label>
          <label class="campo"><span>Concepto</span><select class="entrada" data-col="concepto"></select></label>
          <label class="campo"><span>Formato del importe</span><select id="im-modo" class="entrada"><option value="unico">Una columna con signo</option><option value="separado">Cargo y abono separados</option></select></label>
          <label class="campo im-unico"><span>Importe</span><select class="entrada" data-col="importe"></select></label>
          <label class="campo im-sep"><span>Cargo (salidas)</span><select class="entrada" data-col="cargo"></select></label>
          <label class="campo im-sep"><span>Abono (entradas)</span><select class="entrada" data-col="abono"></select></label>
        </div>
        <label class="check"><input type="checkbox" id="im-invertir"> Los gastos salen en positivo (invertir el signo)</label>
      </section>

      <section class="imp-seccion" id="im-prev" hidden>
        <div class="prev-cab">
          <h3>Vista previa</h3>
          <span class="sub" id="im-resumen"></span>
          <button type="button" class="boton pequeno" id="im-todos">Marcar todos</button>
        </div>
        <div class="prev-lista" id="im-lista"></div>
      </section>
    </div>`;

    B.abrirModal({
      titulo: 'Importar extracto', cuerpo, clase: 'ancho',
      pie: `<button type="button" class="boton" data-cerrar>Cancelar</button><button type="button" class="boton primario" id="im-ok" disabled>Importar</button>`,
      alMontar(md) {
        const $ = s => md.querySelector(s);
        const error = t => { const p = $('#im-error'); p.textContent = t; p.hidden = !t; };

        const opcionesCol = () => {
          const cab = st.cab >= 0 ? st.filas[st.cab] : [];
          const ej = st.filas[st.cab + 1] || [];
          let h = '<option value="-1">—</option>';
          for (let j = 0; j < st.ncol; j++) {
            const nombre = textoCelda(cab[j]) || `Columna ${j + 1}`;
            const muestra = textoCelda(ej[j]).slice(0, 22);
            h += `<option value="${j}">${esc(nombre)}${muestra ? ` · ej.: ${esc(muestra)}` : ''}</option>`;
          }
          return h;
        };

        const pintarMapa = () => {
          const filasCab = ['<option value="-1">Sin fila de títulos</option>'].concat(st.filas.slice(0, 40).map((f, i) =>
            `<option value="${i}">Fila ${i + 1}: ${esc(f.slice(0, 3).map(textoCelda).join(' · ').slice(0, 50))}</option>`));
          $('#im-cab').innerHTML = filasCab.join('');
          $('#im-cab').value = String(st.cab);
          const opc = opcionesCol();
          md.querySelectorAll('[data-col]').forEach(s => { s.innerHTML = opc; s.value = String(st.col[s.dataset.col] ?? -1); });
          $('#im-modo').value = st.modo;
          md.querySelectorAll('.im-unico').forEach(x => { x.hidden = st.modo !== 'unico'; });
          md.querySelectorAll('.im-sep').forEach(x => { x.hidden = st.modo !== 'separado'; });
          $('#im-mapa').hidden = false;
        };

        const pintarPrevia = (mantenerScroll) => {
          const lista = $('#im-lista');
          const scroll = lista.scrollTop;
          const cats = { gasto: e.categorias.filter(c => c.tipo === 'gasto'), ingreso: e.categorias.filter(c => c.tipo === 'ingreso') };
          const opc = (tipo, sel) => cats[tipo].map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');
          lista.innerHTML = st.prev.length ? st.prev.map((p, i) => `
            <div class="prev ${p.dup ? 'dup' : ''}" data-i="${i}">
              <input type="checkbox" class="prev-chk" ${p.incluir ? 'checked' : ''} aria-label="Importar este movimiento">
              <div class="prev-txt"><strong>${esc(p.concepto || '(sin concepto)')}</strong><small>${B.fechaCorta(p.fecha)}${p.dup ? ' · <span class="chip aviso">Parece repetido</span>' : ''}</small></div>
              <span class="prev-imp num ${p.tipo === 'ingreso' ? 'pos' : ''}">${p.tipo === 'ingreso' ? '+' : '−'}${B.dinero(p.importe, st.moneda)}</span>
              <select class="prev-cat entrada" aria-label="Categoría">${opc(p.tipo, p.categoriaId)}</select>
            </div>`).join('') : '<p class="vacio">No hay filas con fecha e importe válidos. Revisa las columnas elegidas arriba.</p>';
          if (mantenerScroll) lista.scrollTop = scroll;
          actualizarResumen();
          $('#im-prev').hidden = false;
        };

        const actualizarResumen = () => {
          const sel = st.prev.filter(p => p.incluir).length;
          const dups = st.prev.filter(p => p.dup).length;
          $('#im-resumen').textContent = `${st.prev.length} movimientos · ${sel} seleccionados${dups ? ` · ${dups} parecen repetidos` : ''}${st.ignoradas ? ` · ${st.ignoradas} filas ignoradas` : ''}`;
          $('#im-ok').disabled = !sel;
          $('#im-ok').textContent = sel ? `Importar ${sel} movimiento${sel === 1 ? '' : 's'}` : 'Importar';
        };

        const recalcular = () => { construir(st); pintarPrevia(false); };

        const cargarFilas = (filas, nombre) => {
          error('');
          if (!filas || filas.length < 2) { error('No hemos encontrado filas en el archivo. ¿Es el extracto correcto?'); return; }
          st.filas = filas;
          st.cab = detectarCabecera(filas);
          detectarColumnas(st);
          if (nombre) $('#im-nombre').textContent = nombre;
          pintarMapa();
          recalcular();
          if (st.col.fecha < 0 || (st.modo === 'unico' && st.col.importe < 0)) error('No hemos encontrado la fecha o el importe. Elige las columnas a mano en «Columnas».');
        };

        const conArchivo = async archivo => {
          if (!archivo) return;
          $('#im-nombre').textContent = 'Leyendo…';
          try { cargarFilas(await leerArchivo(archivo), archivo.name); }
          catch (err) { $('#im-nombre').textContent = 'Elige el archivo del extracto'; error(err.message || 'No se pudo leer el archivo.'); }
        };

        $('#im-archivo').addEventListener('change', ev => conArchivo(ev.target.files[0]));
        const zona = $('#im-zona');
        zona.addEventListener('dragover', ev => { ev.preventDefault(); zona.classList.add('sobre'); });
        zona.addEventListener('dragleave', () => zona.classList.remove('sobre'));
        zona.addEventListener('drop', ev => { ev.preventDefault(); zona.classList.remove('sobre'); conArchivo(ev.dataTransfer.files[0]); });
        $('#im-leer').addEventListener('click', () => {
          const t = $('#im-texto').value.trim();
          if (!t) { error('Pega primero el contenido del CSV.'); return; }
          cargarFilas(B.parsearCSV(t), 'Texto pegado');
        });

        $('#im-cuenta').addEventListener('change', ev => { st.cuentaId = ev.target.value; if (st.filas) recalcular(); });
        $('#im-cab').addEventListener('change', ev => { st.cab = Number(ev.target.value); detectarColumnas(st); pintarMapa(); recalcular(); });
        md.querySelectorAll('[data-col]').forEach(s => s.addEventListener('change', () => { st.col[s.dataset.col] = Number(s.value); recalcular(); }));
        $('#im-modo').addEventListener('change', ev => { st.modo = ev.target.value; pintarMapa(); recalcular(); });
        $('#im-invertir').addEventListener('change', ev => { st.invertir = ev.target.checked; recalcular(); });
        $('#im-todos').addEventListener('click', () => {
          const todos = st.prev.every(p => p.incluir);
          st.prev.forEach(p => { p.incluir = !todos; });
          pintarPrevia(true);
        });

        $('#im-lista').addEventListener('change', ev => {
          const fila = ev.target.closest('.prev');
          if (!fila) return;
          const p = st.prev[Number(fila.dataset.i)];
          if (ev.target.classList.contains('prev-chk')) { p.incluir = ev.target.checked; actualizarResumen(); return; }
          if (ev.target.classList.contains('prev-cat')) {
            p.categoriaId = ev.target.value;
            const clave = norm(p.concepto);
            const iguales = st.prev.filter(x => x !== p && x.tipo === p.tipo && clave && norm(x.concepto) === clave);
            iguales.forEach(x => { x.categoriaId = p.categoriaId; });
            if (iguales.length) { pintarPrevia(true); B.aviso(`Aplicado también a ${iguales.length} con el mismo concepto`); }
          }
        });

        $('#im-ok').addEventListener('click', () => {
          const elegidos = st.prev.filter(p => p.incluir);
          if (!elegidos.length) return;
          elegidos.forEach(p => B.estado.movimientos.push({
            id: B.uid() + Math.random().toString(36).slice(2, 5), fecha: p.fecha, tipo: p.tipo, importe: p.importe,
            cuentaId: st.cuentaId, categoriaId: p.categoriaId, nota: p.concepto, importado: true,
          }));
          B.guardar();
          B.ui.ultimaCuenta = st.cuentaId;
          B.ui.mes = elegidos.map(p => p.fecha).sort().pop().slice(0, 7);
          B.cerrarModal();
          if (location.hash !== '#movimientos') location.hash = 'movimientos'; else B.render();
          B.aviso(`${elegidos.length} movimientos importados`);
        });
      },
    });
  };
})(window.B);
