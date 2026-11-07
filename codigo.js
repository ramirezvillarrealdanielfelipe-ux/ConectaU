
"use strict";


// ELEMENTOS DEL HTML

const formularioPerfil = document.getElementById("formularioPerfil");
const formularioBusqueda = document.getElementById("formularioBusqueda");

const mensajePerfil = document.getElementById("mensajePerfil");
const mensajeBusqueda = document.getElementById("mensajeBusqueda");

const listaPerfiles = document.getElementById("listaPerfiles");
const estadoVacio = document.getElementById("estadoVacio");

const plantillaPerfil = document.getElementById("plantillaPerfil");

const contadorPerfiles = document.getElementById("contadorPerfiles");
const contadorConexiones = document.getElementById("contadorConexiones");

const botonLimpiar = document.getElementById("limpiarPerfiles");


// DATOS DE LA APLICACIÓN

let miPerfil = null;

let perfilesConsultados = [];

let interesesCompartidosTotales = 0;


// CARGAR MI PERFIL DESDE EL JSON

async function cargarMiPerfil() {

    try {

        const respuesta = await fetch("./perfil.json");

        if (!respuesta.ok) {
            throw new Error("No se pudo cargar el perfil personal.");
        }

        const perfil = await respuesta.json();

        if (!validarPerfil(perfil)) {
            throw new Error("El perfil personal tiene datos incorrectos.");
        }

        miPerfil = normalizarPerfil(perfil);

        document.getElementById("nombre").value = miPerfil.nombre;
        document.getElementById("descripcion").value = miPerfil.descripcion;

        document.getElementById("intereses").value =
            miPerfil.intereses.join(", ");

        mensajePerfil.textContent = "Tu perfil personal se ha cargado correctamente.";

    } catch (error) {

        mensajePerfil.textContent =
            "Puedes comenzar registrando tu información. " + error.message;

    }

}


// VALIDAR LA INFORMACIÓN DEL PERFIL

function validarPerfil(perfil) {

    return (
        perfil !== null &&
        typeof perfil === "object" &&
        typeof perfil.nombre === "string" &&
        perfil.nombre.trim() !== "" &&
        typeof perfil.descripcion === "string" &&
        perfil.descripcion.trim() !== "" &&
        Array.isArray(perfil.intereses) &&
        perfil.intereses.length >= 5 &&
        perfil.intereses.every(function(interes) {
            return typeof interes === "string" && interes.trim() !== "";
        })
    );

}


// ORGANIZAR LOS DATOS

function normalizarPerfil(perfil) {

    const intereses = perfil.intereses.map(function(interes) {
        return interes.trim();
    });

    return {
        nombre: perfil.nombre.trim(),
        descripcion: perfil.descripcion.trim(),
        intereses: [...new Set(intereses.map(function(interes) {
            return interes.toLowerCase();
        }))].map(function(interes) {

            const original = intereses.find(function(elemento) {
                return elemento.toLowerCase() === interes;
            });

            return original;

        })
    };

}


// REGISTRAR MI PERFIL

formularioPerfil.addEventListener("submit", function(event) {

    event.preventDefault();

    const nombre = document.getElementById("nombre").value.trim();

    const descripcion = document.getElementById("descripcion").value.trim();

    const textoIntereses = document.getElementById("intereses").value;

    const intereses = textoIntereses.split(",").map(function(interes) {
        return interes.trim();
    }).filter(function(interes) {
        return interes !== "";
    });

    const nuevoPerfil = {
        version: 1,
        nombre: nombre,
        descripcion: descripcion,
        intereses: intereses
    };

    if (!validarPerfil(nuevoPerfil)) {

        mensajePerfil.textContent =
            "Completa todos los campos y escribe al menos cinco intereses válidos.";

        return;

    }

    miPerfil = normalizarPerfil(nuevoPerfil);

    descargarPerfil(nuevoPerfil);

    mensajePerfil.textContent =
        "Perfil creado correctamente. Ahora puedes publicar el archivo perfil.json.";

    actualizarCompatibilidades();

});


// GENERAR Y DESCARGAR EL ARCHIVO JSON

function descargarPerfil(perfil) {

    const contenido = JSON.stringify(perfil, null, 4);

    const archivo = new Blob([contenido], {
        type: "application/json"
    });

    const urlArchivo = URL.createObjectURL(archivo);

    const enlace = document.createElement("a");

    enlace.href = urlArchivo;
    enlace.download = "perfil.json";

    document.body.appendChild(enlace);

    enlace.click();

    enlace.remove();

    URL.revokeObjectURL(urlArchivo);

}


// VALIDAR LA URL DEL COMPAÑERO

function validarURL(direccion) {

    try {

        const url = new URL(direccion);

        return (
            url.protocol === "https:" ||
            url.protocol === "http:"
        );

    } catch (error) {

        return false;

    }

}


// CONSULTAR OTRO PERFIL

formularioBusqueda.addEventListener("submit", async function(event) {

    event.preventDefault();

    const campoURL = document.getElementById("urlPerfil");

    const direccion = campoURL.value.trim();

    if (!validarURL(direccion)) {

        mensajeBusqueda.textContent = "Introduce una URL HTTP o HTTPS válida.";

        return;

    }

    const urlNormalizada = new URL(direccion).href;

    const existe = perfilesConsultados.some(function(perfil) {
        return perfil.url === urlNormalizada;
    });

    if (existe) {

        mensajeBusqueda.textContent =
            "Este perfil ya fue consultado anteriormente.";

        return;

    }

    mensajeBusqueda.textContent = "Estableciendo conexión...";

    const boton = formularioBusqueda.querySelector("button");

    boton.disabled = true;

    boton.textContent = "Consultando...";

    try {

        const controlador = new AbortController();

        const tiempoLimite = setTimeout(function() {
            controlador.abort();
        }, 10000);

        let respuesta;

        try {

            respuesta = await fetch(urlNormalizada, {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                cache: "no-store",
                signal: controlador.signal
            });

        } finally {

            clearTimeout(tiempoLimite);

        }

        if (!respuesta.ok) {

            throw new Error(
                "El servidor respondió con el código " + respuesta.status
            );

        }

        const perfil = await respuesta.json();

        if (!validarPerfil(perfil)) {

            throw new Error(
                "El archivo JSON no contiene un perfil válido."
            );

        }

        const perfilOrganizado = normalizarPerfil(perfil);

        const registro = {
            url: urlNormalizada,
            datos: perfilOrganizado
        };

        perfilesConsultados.push(registro);

        mostrarPerfil(perfilOrganizado);

        actualizarEstadisticas();

        mensajeBusqueda.textContent =
            "Conexión exitosa. Perfil de " + perfilOrganizado.nombre + " recibido.";

        campoURL.value = "";

    } catch (error) {

        if (error.name === "AbortError") {

            mensajeBusqueda.textContent =
                "La conexión tardó demasiado. Intenta nuevamente.";

        } else {

            mensajeBusqueda.textContent =
                "No se pudo consultar el perfil. " + error.message +
                " Comprueba la URL y los permisos CORS del servidor.";

        }

    } finally {

        boton.disabled = false;

        boton.textContent = "Consultar";

    }

});


// MOSTRAR EL PERFIL DEL COMPAÑERO

function mostrarPerfil(perfil) {

    const tarjeta = plantillaPerfil.content.cloneNode(true);

    const elemento = tarjeta.querySelector(".tarjeta-perfil");

    const avatar = tarjeta.querySelector(".avatar");

    const nombre = tarjeta.querySelector(".perfil-nombre");

    const descripcion = tarjeta.querySelector(".perfil-descripcion");

    const contenedorIntereses = tarjeta.querySelector(".etiquetas-intereses");

    const porcentaje = tarjeta.querySelector(".porcentaje");

    const barra = tarjeta.querySelector(".barra-progreso");

    const interesesComunes = tarjeta.querySelector(".intereses-comunes");

    nombre.textContent = perfil.nombre;

    avatar.textContent = perfil.nombre.charAt(0).toUpperCase();

    descripcion.textContent = perfil.descripcion;


    // MOSTRAR LOS INTERESES

    perfil.intereses.forEach(function(interes) {

        const etiqueta = document.createElement("span");

        etiqueta.className = "interes-etiqueta";

        etiqueta.textContent = interes;

        contenedorIntereses.appendChild(etiqueta);

    });


    // CALCULAR COMPATIBILIDAD

    if (miPerfil !== null) {

        const resultado = calcularCompatibilidad(
            miPerfil.intereses,
            perfil.intereses
        );

        porcentaje.textContent = resultado.porcentaje + "%";

        barra.style.width = resultado.porcentaje + "%";

        if (resultado.comunes.length > 0) {

            interesesComunes.textContent =
                "Intereses compartidos: " + resultado.comunes.join(", ");

        } else {

            interesesComunes.textContent =
                "Todavía no tienen intereses en común.";

        }

        interesesCompartidosTotales += resultado.comunes.length;

    } else {

        porcentaje.textContent = "--";

        interesesComunes.textContent =
            "Registra tu perfil para descubrir tu compatibilidad.";

    }

    listaPerfiles.appendChild(elemento);

    estadoVacio.hidden = true;

}


// CALCULAR EL PORCENTAJE DE COMPATIBILIDAD

function calcularCompatibilidad(interesesPropios, interesesExternos) {

    const propios = new Set(interesesPropios.map(function(interes) {
        return interes.toLowerCase();
    }));

    const externos = new Set(interesesExternos.map(function(interes) {
        return interes.toLowerCase();
    }));

    const comunes = [...propios].filter(function(interes) {
        return externos.has(interes);
    });

    const union = new Set([...propios, ...externos]);

    const porcentaje = union.size === 0
        ? 0
        : Math.round((comunes.length / union.size) * 100);

    return {
        comunes: comunes,
        porcentaje: porcentaje
    };

}


// ACTUALIZAR COMPATIBILIDADES

function actualizarCompatibilidades() {

    const tarjetas = listaPerfiles.querySelectorAll(".tarjeta-perfil");

    interesesCompartidosTotales = 0;

    perfilesConsultados.forEach(function(registro, indice) {

        const resultado = calcularCompatibilidad(
            miPerfil.intereses,
            registro.datos.intereses
        );

        const tarjeta = tarjetas[indice];

        if (tarjeta) {

            tarjeta.querySelector(".porcentaje").textContent =
                resultado.porcentaje + "%";

            tarjeta.querySelector(".barra-progreso").style.width =
                resultado.porcentaje + "%";

            tarjeta.querySelector(".intereses-comunes").textContent =
                resultado.comunes.length > 0
                    ? "Intereses compartidos: " + resultado.comunes.join(", ")
                    : "Todavía no tienen intereses en común.";

        }

        interesesCompartidosTotales += resultado.comunes.length;

    });

    actualizarEstadisticas();

}


// ACTUALIZAR LAS ESTADÍSTICAS

function actualizarEstadisticas() {

    contadorPerfiles.textContent = perfilesConsultados.length;

    contadorConexiones.textContent = interesesCompartidosTotales;

}


// LIMPIAR LOS PERFILES CONSULTADOS

botonLimpiar.addEventListener("click", function() {

    perfilesConsultados = [];

    interesesCompartidosTotales = 0;

    listaPerfiles.querySelectorAll(".tarjeta-perfil").forEach(function(tarjeta) {
        tarjeta.remove();
    });

    estadoVacio.hidden = false;

    mensajeBusqueda.textContent = "Se han eliminado los perfiles consultados.";

    actualizarEstadisticas();

});


// INICIAR LA APLICACIÓN

cargarMiPerfil();
