/* =============================================================
   MI SALUD | Aplicación educativa de registro · soyfacuh.com
   JavaScript puro. Sin backend, analíticas, cookies ni APIs remotas.
   ============================================================= */

(() => {
  "use strict";

  const CLAVE_DATOS = "misalud_mediciones"; // Se mantiene por compatibilidad con la versión original.
  const CLAVE_TEMA = "misalud_tema";
  const POR_PAGINA = 10;
  const MAX_IMPORTACION = 1000;
  const MAX_TAMANO_ARCHIVO = 2 * 1024 * 1024;
  const FORMATO_NUMERO = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
  const CAMPOS = {
    frecuenciaCardiaca: { nombre: "Frecuencia cardíaca", unidad: "bpm" },
    temperatura: { nombre: "Temperatura", unidad: "°C" },
    sistolica: { nombre: "Presión sistólica", unidad: "mmHg" },
    diastolica: { nombre: "Presión diastólica", unidad: "mmHg" },
    saturacion: { nombre: "Saturación de oxígeno", unidad: "%" }
  };

  const $ = (selector) => document.querySelector(selector);
  const elementos = {
    formulario: $("#formularioMedicion"),
    cuerpoTabla: $("#cuerpoTablaHistorial"),
    historialMovil: $("#historialMovil"),
    mensajeFormulario: $("#mensajeFormulario"),
    contadorNotas: $("#contadorNotas"),
    botonGuardar: $("#botonGuardar"),
    botonCancelar: $("#botonCancelar"),
    chart: $("#contenedorGrafico"),
    toast: $("#toast"),
    dialog: $("#dialogConfirmacion")
  };

  const estado = {
    mediciones: [],
    editando: null,
    pagina: 1,
    imprimiendo: false
  };
  let temporizadorToast;
  let alConfirmar = null;

  function identificador() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function fechaLocal(fecha = new Date()) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
  }

  function horaLocal() {
    const ahora = new Date();
    return `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
  }

  function restarDias(cantidad) {
    const fecha = new Date();
    fecha.setHours(12, 0, 0, 0);
    fecha.setDate(fecha.getDate() - cantidad);
    return fechaLocal(fecha);
  }

  function fechaValida(fecha) {
    if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
    const [a, m, d] = fecha.split("-").map(Number);
    const construida = new Date(a, m - 1, d);
    return construida.getFullYear() === a && construida.getMonth() === m - 1 && construida.getDate() === d;
  }

  function fechaVisible(fecha) {
    if (!fechaValida(fecha)) return "Fecha desconocida";
    const [anio, mes, dia] = fecha.split("-");
    return `${dia}/${mes}/${anio}`;
  }

  function numero(valor) {
    if (valor === null || valor === undefined || String(valor).trim() === "") return NaN;
    return Number(String(valor).trim().replace(",", "."));
  }

  function formato(valor) {
    return FORMATO_NUMERO.format(valor);
  }

  function enRango(valor, min, max, entero = true) {
    return Number.isFinite(valor) && valor >= min && valor <= max && (!entero || Number.isInteger(valor));
  }

  // Admite los registros históricos del proyecto inicial: fecha sin hora,
  // medidas como strings y presión en el formato "120/80".
  function normalizarMedicion(entrada) {
    if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) return null;
    const fecha = entrada.fecha;
    const hora = typeof entrada.hora === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(entrada.hora)
      ? entrada.hora : "";
    const presionAnterior = String(entrada.presionArterial ?? "").match(/^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/);
    const sistolica = numero(entrada.sistolica ?? (presionAnterior && presionAnterior[1]));
    const diastolica = numero(entrada.diastolica ?? (presionAnterior && presionAnterior[2]));
    const frecuenciaCardiaca = numero(entrada.frecuenciaCardiaca);
    const temperatura = numero(entrada.temperatura);
    const saturacion = numero(entrada.saturacion);

    if (!fechaValida(fecha) || fecha > fechaLocal()) return null;
    if (!enRango(frecuenciaCardiaca, 1, 300)) return null;
    if (!enRango(temperatura, 30, 45, false)) return null;
    if (!enRango(sistolica, 40, 300) || !enRango(diastolica, 20, 200) || sistolica <= diastolica) return null;
    if (!enRango(saturacion, 0, 100)) return null;

    return {
      id: typeof entrada.id === "string" || typeof entrada.id === "number"
        ? String(entrada.id) : identificador(),
      fecha,
      hora,
      frecuenciaCardiaca,
      temperatura: Math.round(temperatura * 10) / 10,
      sistolica,
      diastolica,
      saturacion,
      observaciones: typeof entrada.observaciones === "string" ? entrada.observaciones.slice(0, 240) : "",
      ejemplo: entrada.ejemplo === true
    };
  }

  function leerDatos() {
    try {
      const guardado = localStorage.getItem(CLAVE_DATOS);
      if (!guardado) return [];
      const parsed = JSON.parse(guardado);
      if (!Array.isArray(parsed)) throw new Error("Datos no válidos");
      const validos = parsed.map(normalizarMedicion).filter(Boolean);
      if (validos.length < parsed.length) {
        avisar("Algunos registros anteriores no se pudieron leer. Revisá una copia de seguridad.");
      }
      return validos;
    } catch (error) {
      avisar("No pudimos leer los datos guardados. Revisá los permisos del navegador.");
      return [];
    }
  }

  function guardarDatos(mediciones) {
    try {
      localStorage.setItem(CLAVE_DATOS, JSON.stringify(mediciones));
      estado.mediciones = mediciones;
      renderizar();
      return true;
    } catch (error) {
      avisar("No se pudo guardar. Verificá el espacio y los permisos del navegador.");
      return false;
    }
  }

  function ordenar(mediciones, ascendente = false) {
    const resultado = [...mediciones].sort((a, b) => {
      const fechaA = `${a.fecha}T${a.hora || "00:00"}`;
      const fechaB = `${b.fecha}T${b.hora || "00:00"}`;
      return fechaA.localeCompare(fechaB) || a.id.localeCompare(b.id);
    });
    return ascendente ? resultado : resultado.reverse();
  }

  function avisar(mensaje) {
    clearTimeout(temporizadorToast);
    elementos.toast.textContent = mensaje;
    elementos.toast.classList.add("show");
    temporizadorToast = setTimeout(() => elementos.toast.classList.remove("show"), 4200);
  }

  function confirmar(titulo, texto, accion, etiqueta = "Confirmar", destructivo = true) {
    $("#dialogTitulo").textContent = titulo;
    $("#dialogTexto").textContent = texto;
    $("#dialogAceptar").textContent = etiqueta;
    $("#dialogAceptar").className = destructivo ? "btn btn-danger" : "btn btn-primary";
    alConfirmar = accion;
    elementos.dialog.showModal();
  }

  function ocultarError() {
    elementos.mensajeFormulario.hidden = true;
    elementos.mensajeFormulario.textContent = "";
    elementos.formulario.querySelectorAll('[aria-invalid="true"]').forEach((campo) => campo.removeAttribute("aria-invalid"));
  }

  function mostrarError(mensaje, campo) {
    elementos.mensajeFormulario.textContent = mensaje;
    elementos.mensajeFormulario.hidden = false;
    if (campo) {
      const elemento = document.getElementById(campo);
      elemento.setAttribute("aria-invalid", "true");
      elemento.focus();
    }
  }

  function prepararFormulario() {
    $("#fecha").max = fechaLocal();
    $("#fecha").value = fechaLocal();
    $("#hora").value = horaLocal();
    $("#contadorNotas").textContent = "0 / 240 caracteres";
    estado.editando = null;
    elementos.botonGuardar.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg> Guardar medición';
    elementos.botonCancelar.hidden = true;
    $("#tituloRegistrar").textContent = "Registrar medición";
    ocultarError();
  }

  function guardarFormulario(evento) {
    evento.preventDefault();
    ocultarError();
    const valores = Object.fromEntries(new FormData(elementos.formulario));

    const campos = ["fecha", "hora", "frecuenciaCardiaca", "temperatura", "sistolica", "diastolica", "saturacion"];
    for (const campo of campos) {
      if (!String(valores[campo] ?? "").trim()) {
        mostrarError("Completá todos los campos obligatorios.", campo);
        return;
      }
    }
    if (!fechaValida(valores.fecha) || valores.fecha > fechaLocal()) {
      mostrarError("Ingresá una fecha válida que no sea futura.", "fecha");
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(valores.hora)) {
      mostrarError("Ingresá una hora válida.", "hora");
      return;
    }
    for (const [campo, minimo, maximo, entero] of [
      ["frecuenciaCardiaca", 1, 300, true], ["temperatura", 30, 45, false],
      ["sistolica", 40, 300, true], ["diastolica", 20, 200, true], ["saturacion", 0, 100, true]
    ]) {
      if (!enRango(numero(valores[campo]), minimo, maximo, entero)) {
        mostrarError(`Revisá el campo ${campo}. El valor debe estar entre ${minimo} y ${maximo}${entero ? " y ser entero" : ""}.`, campo);
        return;
      }
    }
    if (numero(valores.sistolica) <= numero(valores.diastolica)) {
      mostrarError("La presión sistólica debe ser mayor que la diastólica.", "sistolica");
      return;
    }
    if (valores.observaciones.length > 240) {
      mostrarError("Las observaciones admiten hasta 240 caracteres.", "observaciones");
      return;
    }

    const anterior = estado.mediciones.find((item) => item.id === estado.editando);
    const nueva = normalizarMedicion({
      ...valores,
      id: anterior?.id ?? identificador(),
      ejemplo: anterior?.ejemplo ?? false
    });
    if (!nueva) {
      mostrarError("No se pudo validar la medición. Revisá los valores.");
      return;
    }

    const actualizadas = anterior
      ? estado.mediciones.map((item) => item.id === anterior.id ? nueva : item)
      : [...estado.mediciones, nueva];
    if (guardarDatos(actualizadas)) {
      elementos.formulario.reset();
      prepararFormulario();
      avisar(anterior ? "Medición actualizada correctamente." : "Medición guardada correctamente.");
    }
  }

  function editarMedicion(id) {
    const medicion = estado.mediciones.find((registro) => registro.id === id);
    if (!medicion) return;
    estado.editando = id;
    for (const campo of ["fecha", "hora", "frecuenciaCardiaca", "temperatura", "sistolica", "diastolica", "saturacion", "observaciones"]) {
      document.getElementById(campo).value = medicion[campo] ?? "";
    }
    if (!medicion.hora) $("#hora").value = horaLocal(); // Los registros anteriores no almacenaban la hora.
    $("#contadorNotas").textContent = `${medicion.observaciones.length} / 240 caracteres`;
    $("#tituloRegistrar").textContent = "Editar medición";
    elementos.botonGuardar.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg> Guardar cambios';
    elementos.botonCancelar.hidden = false;
    ocultarError();
    $("#registrar").scrollIntoView({ behavior: "smooth", block: "start" });
    $("#frecuenciaCardiaca").focus({ preventScroll: true });
  }

  function eliminarMedicion(id) {
    const medicion = estado.mediciones.find((registro) => registro.id === id);
    if (!medicion) return;
    confirmar("Eliminar medición", `¿Querés eliminar el registro del ${fechaVisible(medicion.fecha)}? Esta acción no se puede deshacer.`, () => {
      if (guardarDatos(estado.mediciones.filter((item) => item.id !== id))) {
        if (estado.editando === id) {
          elementos.formulario.reset();
          prepararFormulario();
        }
        avisar("Medición eliminada.");
      }
    }, "Eliminar");
  }

  function renderizarResumen() {
    const mediciones = ordenar(estado.mediciones);
    const reciente = mediciones[0];
    $("#resumenActualizado").textContent = reciente
      ? `Última actualización: ${fechaVisible(reciente.fecha)}${reciente.hora ? ` · ${reciente.hora}` : ""}`
      : "Sin registros todavía";

    for (const [campo, id] of [
      ["frecuenciaCardiaca", "Pulso"], ["temperatura", "Temperatura"],
      ["sistolica", "Presion"], ["saturacion", "Saturacion"]
    ]) {
      const valor = $("#valor" + id);
      const fecha = $("#fecha" + id);
      valor.textContent = reciente ? (campo === "sistolica" ? `${reciente.sistolica}/${reciente.diastolica}` : formato(reciente[campo])) : "—";
      fecha.textContent = reciente ? `${fechaVisible(reciente.fecha)}${reciente.ejemplo ? " · Ejemplo" : ""}` : "Sin datos registrados";
      graficarMini($("#spark" + id), ordenar(estado.mediciones, true).slice(-7), campo);
    }

    $("#totalMediciones").textContent = String(mediciones.length);
    $("#diasRegistrados").textContent = String(new Set(mediciones.map((m) => m.fecha)).size);
    const lista = $("#listaRecientes");
    lista.replaceChildren();
    if (!mediciones.length) {
      const vacio = document.createElement("div");
      vacio.className = "recent-empty";
      vacio.textContent = "Acá aparecerán tus tres mediciones más recientes.";
      lista.append(vacio);
      return;
    }
    mediciones.slice(0, 3).forEach((registro) => {
      const fila = document.createElement("div");
      fila.className = "recent-item";
      fila.innerHTML = '<div class="recent-bullet"><svg class="icon" aria-hidden="true"><use href="#i-heart"/></svg></div>';
      const contenido = document.createElement("div");
      contenido.className = "recent-data";
      const titulo = document.createElement("strong");
      titulo.textContent = fechaVisible(registro.fecha);
      const subtitulo = document.createElement("span");
      subtitulo.textContent = `${registro.hora || "Sin hora registrada"} · ${registro.ejemplo ? "Ejemplo" : "Registro"}`;
      contenido.append(titulo, subtitulo);
      const derecha = document.createElement("span");
      derecha.className = "recent-right";
      derecha.textContent = `${formato(registro.frecuenciaCardiaca)} bpm`;
      fila.append(contenido, derecha);
      lista.append(fila);
    });
  }

  function coordenadas(valores, ancho, alto, margen = { t: 15, r: 15, b: 24, l: 48 }) {
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const variacion = max - min || Math.max(Math.abs(max) * 0.05, 1);
    const inferior = min - variacion * 0.25;
    const superior = max + variacion * 0.25;
    const largo = ancho - margen.l - margen.r;
    const altura = alto - margen.t - margen.b;
    return {
      puntos: valores.map((valor, indice) => ({
        x: margen.l + (valores.length === 1 ? largo / 2 : (indice / (valores.length - 1)) * largo),
        y: margen.t + (1 - (valor - inferior) / (superior - inferior)) * altura
      })),
      inferior, superior, margen, ancho, alto
    };
  }

  function graficarMini(contenedor, mediciones, campo) {
    contenedor.replaceChildren();
    if (mediciones.length < 2) return;
    const puntos = coordenadas(mediciones.map((m) => m[campo]), 90, 35, { t: 4, r: 4, b: 4, l: 4 }).puntos;
    const ruta = puntos.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    // Sólo se insertan números calculados, nunca texto recibido de usuarios.
    contenedor.innerHTML = `<svg viewBox="0 0 90 35" preserveAspectRatio="none"><path d="${ruta}" fill="none" stroke="var(--tone-color)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  function renderizarGrafico() {
    const campo = $("#graficoMetrica").value;
    const periodo = $("#graficoPeriodo").value;
    const lista = ordenar(estado.mediciones.filter((medicion) => periodo === "all" || medicion.fecha >= restarDias(Number(periodo) - 1)), true);
    elementos.chart.replaceChildren();
    $("#graficoCantidad").textContent = `${lista.length} ${lista.length === 1 ? "medición" : "mediciones"}`;
    if (!lista.length) {
      elementos.chart.innerHTML = '<div class="chart-empty"><svg class="icon" aria-hidden="true"><use href="#i-activity"/></svg>No hay datos para este período. Registrá una medición o probá con otro rango.</div>';
      elementos.chart.setAttribute("aria-label", "Sin mediciones para el gráfico seleccionado");
      $("#graficoLeyenda").textContent = "No hay registros para visualizar.";
      return;
    }

    const valores = lista.map((m) => m[campo]);
    const { puntos, inferior, superior } = coordenadas(valores, 640, 190);
    const linea = puntos.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
    const base = 166;
    const area = `${linea} L ${puntos[puntos.length - 1].x.toFixed(2)} ${base} L ${puntos[0].x.toFixed(2)} ${base} Z`;
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const grilla = [0, 1, 2].map((i) => {
      const y = 15 + i * 75.5;
      const valor = superior - ((superior - inferior) * i / 2);
      return `<line class="chart-grid" x1="48" x2="625" y1="${y}" y2="${y}"/><text class="chart-label" x="40" y="${y + 4}" text-anchor="end">${formato(valor)}</text>`;
    }).join("");
    const puntosSVG = puntos.map((p) => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${lista.length === 1 ? 5 : 3}" fill="#0f9c8f" stroke="var(--surface)" stroke-width="2"/>`).join("");
    const desde = fechaVisible(lista[0].fecha);
    const hasta = fechaVisible(lista[lista.length - 1].fecha);
    elementos.chart.innerHTML = `<svg viewBox="0 0 640 190" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#25b6a3" stop-opacity=".19"/><stop offset="1" stop-color="#25b6a3" stop-opacity="0"/></linearGradient></defs>${grilla}<path d="${area}" fill="url(#chartFill)"/><path d="${linea}" stroke="#0f9c8f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>${puntosSVG}<text class="chart-label" x="48" y="185">${desde}</text><text class="chart-label" x="625" y="185" text-anchor="end">${hasta}</text></svg>`;
    elementos.chart.setAttribute("aria-label", `${CAMPOS[campo].nombre}: ${lista.length} registros, valor mínimo ${formato(min)} y máximo ${formato(max)} ${CAMPOS[campo].unidad}.`);
    $("#graficoLeyenda").textContent = `Mín. ${formato(min)} · Máx. ${formato(max)} ${CAMPOS[campo].unidad} · registros ordenados cronológicamente`;
  }

  function obtenerFiltrados() {
    const busqueda = $("#buscarHistorial").value.trim().toLocaleLowerCase("es-AR");
    const periodo = $("#filtroPeriodo").value;
    const descendente = $("#ordenHistorial").value !== "asc";
    const filtrados = estado.mediciones.filter((medicion) => {
      if (periodo !== "all" && medicion.fecha < restarDias(Number(periodo) - 1)) return false;
      if (!busqueda) return true;
      const texto = [
        fechaVisible(medicion.fecha), medicion.fecha, medicion.hora,
        medicion.frecuenciaCardiaca, formato(medicion.temperatura), medicion.temperatura,
        `${medicion.sistolica}/${medicion.diastolica}`, medicion.saturacion,
        medicion.observaciones, medicion.ejemplo ? "ejemplo demo" : ""
      ].join(" ").toLocaleLowerCase("es-AR");
      return texto.includes(busqueda);
    });
    return ordenar(filtrados, !descendente);
  }

  function elementoTexto(etiqueta, texto, clase = "") {
    const elemento = document.createElement(etiqueta);
    if (clase) elemento.className = clase;
    elemento.textContent = String(texto);
    return elemento;
  }

  function botonAccion(tipo, medicion) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = `row-action${tipo === "eliminar" ? " delete" : ""}`;
    boton.setAttribute("aria-label", `${tipo === "editar" ? "Editar" : "Eliminar"} medición del ${fechaVisible(medicion.fecha)}`);
    boton.title = tipo === "editar" ? "Editar" : "Eliminar";
    boton.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-${tipo === "editar" ? "edit" : "trash"}"/></svg>`;
    boton.addEventListener("click", () => tipo === "editar" ? editarMedicion(medicion.id) : eliminarMedicion(medicion.id));
    return boton;
  }

  function renderizarTabla(registros) {
    elementos.cuerpoTabla.replaceChildren();
    elementos.historialMovil.replaceChildren();
    registros.forEach((medicion) => {
      const fila = document.createElement("tr");
      const fecha = document.createElement("td");
      fecha.append(elementoTexto("span", fechaVisible(medicion.fecha)));
      fecha.append(elementoTexto("span", medicion.hora || "Sin hora", "small-date"));
      const datos = [
        `${formato(medicion.frecuenciaCardiaca)} bpm`, `${formato(medicion.temperatura)} °C`,
        `${medicion.sistolica}/${medicion.diastolica}`, `${medicion.saturacion} %`
      ];
      fila.append(fecha, ...datos.map((dato) => elementoTexto("td", dato)));
      const nota = elementoTexto("td", medicion.observaciones || (medicion.ejemplo ? "Dato de ejemplo" : "—"), "note-cell");
      nota.title = medicion.observaciones || "";
      fila.append(nota);
      const acciones = document.createElement("td");
      const grupo = document.createElement("div");
      grupo.className = "row-actions";
      grupo.append(botonAccion("editar", medicion), botonAccion("eliminar", medicion));
      acciones.append(grupo);
      fila.append(acciones);
      elementos.cuerpoTabla.append(fila);

      // En mobile evitamos el desplazamiento horizontal con tarjetas propias.
      const tarjeta = document.createElement("article");
      tarjeta.className = "history-mobile-card";
      const encabezado = document.createElement("div");
      encabezado.className = "mobile-card-head";
      const titulo = elementoTexto("strong", fechaVisible(medicion.fecha));
      const hora = elementoTexto("span", medicion.hora || "Sin hora");
      encabezado.append(titulo, hora);
      const valores = document.createElement("div");
      valores.className = "mobile-card-values";
      [
        ["Pulso", `${formato(medicion.frecuenciaCardiaca)} bpm`],
        ["Temperatura", `${formato(medicion.temperatura)} °C`],
        ["Presión", `${medicion.sistolica}/${medicion.diastolica}`],
        ["Saturación", `${medicion.saturacion} %`]
      ].forEach(([tituloValor, valor]) => {
        const par = document.createElement("div");
        par.append(elementoTexto("span", tituloValor), elementoTexto("strong", valor));
        valores.append(par);
      });
      const pie = document.createElement("div");
      pie.className = "mobile-card-foot";
      const indicador = elementoTexto("span", medicion.ejemplo ? "Ejemplo" : "Registro personal", medicion.ejemplo ? "demo-tag" : "meta-text");
      const botones = document.createElement("div");
      botones.className = "row-actions";
      botones.append(botonAccion("editar", medicion), botonAccion("eliminar", medicion));
      pie.append(indicador, botones);
      tarjeta.append(encabezado, valores);
      if (medicion.observaciones) tarjeta.append(elementoTexto("p", medicion.observaciones, "mobile-card-note"));
      tarjeta.append(pie);
      elementos.historialMovil.append(tarjeta);
    });
  }

  function renderizarHistorial() {
    const filtrados = obtenerFiltrados();
    const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
    estado.pagina = Math.min(Math.max(estado.pagina, 1), paginas);
    const pagina = estado.imprimiendo ? filtrados : filtrados.slice((estado.pagina - 1) * POR_PAGINA, estado.pagina * POR_PAGINA);
    renderizarTabla(pagina);
    $("#cantidadFiltrada").textContent = `${filtrados.length} ${filtrados.length === 1 ? "registro" : "registros"}${filtrados.length !== estado.mediciones.length ? ` de ${estado.mediciones.length}` : ""}`;
    $("#historialVacio").hidden = filtrados.length !== 0;
    if (!filtrados.length) {
      $("#vacioTitulo").textContent = estado.mediciones.length ? "Sin coincidencias" : "Todavía no hay mediciones";
      $("#vacioTexto").textContent = estado.mediciones.length ? "Probá ajustando los filtros o la búsqueda." : "Guardá tu primer registro para verlo acá.";
    }
    $("#paginaEstado").textContent = `Página ${estado.pagina} de ${paginas}`;
    $("#paginaAnterior").disabled = estado.pagina === 1;
    $("#paginaSiguiente").disabled = estado.pagina === paginas;
  }

  function renderizar() {
    renderizarResumen();
    renderizarGrafico();
    renderizarHistorial();
  }

  function descargar(nombre, contenido, tipo) {
    const archivo = new Blob([contenido], { type: tipo });
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombre;
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportarJSON() {
    if (!estado.mediciones.length) return avisar("No hay mediciones para exportar.");
    const respaldo = { aplicacion: "Mi Salud", version: 2, exportado: new Date().toISOString(), mediciones: ordenar(estado.mediciones, true) };
    descargar(`mi-salud-respaldo-${fechaLocal()}.json`, JSON.stringify(respaldo, null, 2), "application/json;charset=utf-8");
    avisar("Copia de seguridad JSON descargada.");
  }

  function protegerCeldaCSV(valor) {
    const texto = String(valor ?? "");
    // Evita que Excel/Sheets interpreten notas como fórmulas al abrir el CSV.
    const seguro = /^[\s]*[=+\-@]/.test(texto) ? `'${texto}` : texto;
    return `"${seguro.replaceAll('"', '""')}"`;
  }

  function exportarCSV() {
    const registros = obtenerFiltrados();
    if (!registros.length) return avisar("No hay registros visibles para exportar.");
    const cabeceras = ["Fecha", "Hora", "Frecuencia cardíaca (bpm)", "Temperatura (°C)", "Presión sistólica (mmHg)", "Presión diastólica (mmHg)", "Saturación (%)", "Observaciones", "Ejemplo"];
    const filas = registros.map((m) => [m.fecha, m.hora, m.frecuenciaCardiaca, m.temperatura, m.sistolica, m.diastolica, m.saturacion, m.observaciones, m.ejemplo ? "Sí" : "No"]);
    const csv = [cabeceras, ...filas].map((fila) => fila.map(protegerCeldaCSV).join(";")).join("\r\n");
    descargar(`mi-salud-registros-${fechaLocal()}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
    avisar("Archivo CSV descargado con los registros filtrados.");
  }

  async function importarJSON(evento) {
    const archivo = evento.target.files[0];
    evento.target.value = "";
    if (!archivo) return;
    if (archivo.size > MAX_TAMANO_ARCHIVO) return avisar("El archivo supera el máximo permitido de 2 MB.");
    let datos;
    try {
      datos = JSON.parse(await archivo.text());
    } catch (error) {
      return avisar("No se pudo abrir el archivo. Elegí un JSON válido de Mi Salud.");
    }
    const registros = Array.isArray(datos) ? datos : datos?.mediciones;
    if (!Array.isArray(registros) || registros.length > MAX_IMPORTACION) {
      return avisar("La copia debe contener una lista de hasta 1000 mediciones.");
    }
    if (!registros.length) return avisar("La copia de seguridad está vacía.");
    const validos = registros.map(normalizarMedicion).filter(Boolean);
    if (!validos.length) return avisar("El archivo no contiene mediciones válidas.");
    const ids = new Set(estado.mediciones.map((m) => m.id));
    const nuevos = validos.filter((m) => {
      if (ids.has(m.id)) return false;
      ids.add(m.id);
      return true;
    });
    if (!nuevos.length) return avisar("Las mediciones de esta copia ya están guardadas.");
    const invalidos = registros.length - validos.length;
    confirmar("Importar mediciones", `Se agregarán ${nuevos.length} registros sin reemplazar los actuales.${invalidos ? ` Se omitirán ${invalidos} registros inválidos.` : ""} ¿Continuar?`, () => {
      if (guardarDatos([...estado.mediciones, ...nuevos])) avisar(`${nuevos.length} mediciones importadas correctamente.`);
    }, "Importar datos", false);
  }

  function cargarEjemplos() {
    if (estado.mediciones.some((medicion) => medicion.ejemplo)) {
      return avisar("Ya hay datos de ejemplo. Podés editarlos o eliminarlos desde el historial.");
    }
    confirmar("Cargar datos de ejemplo", "Se agregarán ocho registros ficticios identificados como ejemplos. No se borrarán tus registros actuales.", () => {
      const muestras = [
        [21, 73, 36.4, 118, 78, 98], [18, 76, 36.5, 120, 80, 97],
        [15, 71, 36.6, 117, 77, 99], [12, 74, 36.5, 119, 79, 98],
        [9, 70, 36.4, 116, 76, 98], [6, 72, 36.6, 121, 81, 97],
        [3, 75, 36.5, 120, 79, 98], [0, 72, 36.5, 118, 78, 99]
      ];
      const nuevos = muestras.map(([dias, frecuenciaCardiaca, temperatura, sistolica, diastolica, saturacion]) => ({
        id: identificador(), fecha: restarDias(dias), hora: "10:30", frecuenciaCardiaca,
        temperatura, sistolica, diastolica, saturacion,
        observaciones: "Dato ficticio para explorar la demostración.", ejemplo: true
      }));
      if (guardarDatos([...estado.mediciones, ...nuevos])) {
        avisar("Datos de ejemplo cargados. Ya podés explorar los gráficos.");
        $("#resumen").scrollIntoView({ behavior: "smooth" });
      }
    }, "Cargar ejemplos", false);
  }

  function borrarTodo() {
    if (!estado.mediciones.length) return avisar("El historial ya está vacío.");
    confirmar("Borrar todo el historial", `Se eliminarán ${estado.mediciones.length} registros de este navegador. Descargá antes una copia JSON si querés conservarlos.`, () => {
      try {
        localStorage.removeItem(CLAVE_DATOS);
        estado.mediciones = [];
        estado.pagina = 1;
        elementos.formulario.reset();
        prepararFormulario();
        renderizar();
        avisar("Historial eliminado correctamente.");
      } catch (error) {
        avisar("No se pudo borrar el historial. Revisá los permisos del navegador.");
      }
    }, "Borrar todo");
  }

  function aplicarTema(tema) {
    const oscuro = tema === "dark";
    document.documentElement.dataset.theme = oscuro ? "dark" : "light";
    $("#temaBoton").setAttribute("aria-label", oscuro ? "Activar modo claro" : "Activar modo oscuro");
    $("#temaBoton").setAttribute("title", oscuro ? "Activar modo claro" : "Activar modo oscuro");
    $("#temaBoton").innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-${oscuro ? "sun" : "moon"}"/></svg>`;
    $('meta[name="theme-color"]').setAttribute("content", oscuro ? "#0f1a22" : "#f5f8fb");
  }

  function inicializar() {
    $("#anioActual").textContent = new Date().getFullYear();
    try { aplicarTema(localStorage.getItem(CLAVE_TEMA) || "light"); } catch (error) { aplicarTema("light"); }
    estado.mediciones = leerDatos();
    prepararFormulario();
    renderizar();

    elementos.formulario.addEventListener("submit", guardarFormulario);
    $("#observaciones").addEventListener("input", (e) => {
      elementos.contadorNotas.textContent = `${e.target.value.length} / 240 caracteres`;
    });
    elementos.botonCancelar.addEventListener("click", () => {
      elementos.formulario.reset();
      prepararFormulario();
    });
    $("#graficoMetrica").addEventListener("change", renderizarGrafico);
    $("#graficoPeriodo").addEventListener("change", renderizarGrafico);
    for (const id of ["buscarHistorial", "filtroPeriodo", "ordenHistorial"]) {
      document.getElementById(id).addEventListener(id === "buscarHistorial" ? "input" : "change", () => {
        estado.pagina = 1;
        renderizarHistorial();
      });
    }
    $("#paginaAnterior").addEventListener("click", () => { estado.pagina--; renderizarHistorial(); });
    $("#paginaSiguiente").addEventListener("click", () => { estado.pagina++; renderizarHistorial(); });
    $("#botonDemo").addEventListener("click", cargarEjemplos);
    $("#botonEliminarTodo").addEventListener("click", borrarTodo);
    $("#botonCSV").addEventListener("click", exportarCSV);
    $("#botonJSON").addEventListener("click", exportarJSON);
    $("#botonImportar").addEventListener("click", () => $("#archivoImportar").click());
    $("#archivoImportar").addEventListener("change", importarJSON);
    $("#botonImprimir").addEventListener("click", () => window.print());
    window.addEventListener("beforeprint", () => { estado.imprimiendo = true; renderizarHistorial(); });
    window.addEventListener("afterprint", () => { estado.imprimiendo = false; renderizarHistorial(); });
    $("#temaBoton").addEventListener("click", () => {
      const tema = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      aplicarTema(tema);
      try { localStorage.setItem(CLAVE_TEMA, tema); } catch (error) { /* Preferencia opcional. */ }
    });
    $("#dialogCancelar").addEventListener("click", () => elementos.dialog.close());
    $("#dialogAceptar").addEventListener("click", () => {
      const accion = alConfirmar;
      alConfirmar = null;
      elementos.dialog.close();
      if (accion) accion();
    });
    elementos.dialog.addEventListener("close", () => { alConfirmar = null; });
    document.querySelectorAll(".nav-link").forEach((enlace) => {
      enlace.addEventListener("click", () => {
        document.querySelectorAll(".nav-link").forEach((otro) => otro.classList.remove("active"));
        enlace.classList.add("active");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", inicializar);
})();
