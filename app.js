
const $ = (id) => document.getElementById(id);

const norm = (t) => String(t).trim().toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const CLAVE = "conecta:urls";
let miFoto = "";

const archivo = document.createElement("input");
archivo.type = "file";
archivo.accept = "image/*";
archivo.style.display = "none";
document.body.append(archivo);

const perfiles = new Map();

// ---------- Utilidades ----------

function listaGustos(p) {
  const g = p.gustos;

  if (Array.isArray(g)) return g.map(String);

  if (g && typeof g === "object") {
    return Object.values(g).flat().map(String);
  }

  return [];
}

function avatar(nombre, foto) {
  const ini = (nombre || "?").trim().charAt(0).toUpperCase();

  if (!foto) {
    const d = document.createElement("div");
    d.className = "avatar";
    d.textContent = ini;
    return d;
  }

  const img = document.createElement("img");
  img.className = "avatar";
  img.src = foto;
  img.alt = "Foto de " + nombre;

  img.onerror = () => img.replaceWith(avatar(nombre, ""));

  return img;
}

function el(tag, clase, texto) {
  const e = document.createElement(tag);

  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;

  return e;
}

function guardarUrls() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify([...perfiles.keys()]));
  } catch {}
}

// ---------- Mi perfil ----------

function leerMiPerfil() {
  const p = {
    nombre: $("nombre").value.trim(),
    descripcion: $("descripcion").value.trim(),
    gustos: $("gustos").value.split(/[,\n]/)
      .map(g => g.trim())
      .filter(Boolean)
  };

  if (miFoto) p.foto = miFoto;

  return p;
}

// ---------- Vista previa ----------

function pintarPreview() {
  const p = leerMiPerfil();

  const wrap = el("div", "foto-wrap");

  const foto = el("div", "foto-btn");
  foto.append(avatar(p.nombre, miFoto));

  const cambiar = el("button", "foto-cambiar", "Cambiar foto de perfil");
  cambiar.type = "button";

  cambiar.onclick = () => archivo.click();

  wrap.append(foto, cambiar);

  const datos = el("div", "datos");

  datos.append(
    el("strong", "", p.nombre || "Tu nombre"),
    el("span", "", p.gustos.length + " gustos")
  );

  $("preview").replaceChildren(
    el("div", "portada"),
    wrap,
    datos
  );
}

// Actualizar la vista previa cuando se escriba

["nombre", "descripcion", "gustos"].forEach(id => {
  $(id).addEventListener("input", () => {
    pintarPreview();
    pintarTodos();
  });
});

// ---------- Cambiar foto ----------

archivo.addEventListener("change", (ev) => {
  const f = ev.target.files[0];
  archivo.value = "";

  if (!f) return;

  const img = new Image();
  const url = URL.createObjectURL(f);

  img.onload = () => {
    const L = 256;
    const lado = Math.min(img.width, img.height);
    const c = document.createElement("canvas");

    c.width = L;
    c.height = L;

    c.getContext("2d").drawImage(
      img,
      (img.width - lado) / 2,
      (img.height - lado) / 2,
      lado,
      lado,
      0,
      0,
      L,
      L
    );

    miFoto = c.toDataURL("image/jpeg", 0.8);

    URL.revokeObjectURL(url);
    pintarPreview();
  };

  img.onerror = () => {
    URL.revokeObjectURL(url);

    $("aviso-perfil").textContent = "No se pudo cargar la imagen.";
    $("aviso-perfil").className = "aviso error";
  };

  img.src = url;
});

// ---------- Generar perfil.json ----------

function generarPerfil() {
  const p = leerMiPerfil();
  const aviso = $("aviso-perfil");

  if (!p.nombre || !p.descripcion || p.gustos.length < 5) {
    aviso.textContent =
      "Completa nombre, descripción y al menos 5 gustos para generar tu perfil.json.";

    aviso.className = "aviso error";
    return;
  }

  const contenido = JSON.stringify(p, null, 2);

  const archivoJSON = new Blob(
    [contenido],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(archivoJSON);

  const a = document.createElement("a");
  a.href = url;
  a.download = "perfil.json";

  document.body.append(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);

  aviso.textContent =
    "perfil.json generado correctamente. Ahora súbelo a tu hosting.";

  aviso.className = "aviso";
}

$("btn-generar").addEventListener("click", generarPerfil);

// ---------- Copiar URL ----------

$("btn-copiar").addEventListener("click", async () => {
  const url = new URL("perfil.json", location.href).href;
  const aviso = $("aviso-perfil");

  try {
    await navigator.clipboard.writeText(url);
    aviso.textContent = "URL copiada: " + url;
  } catch {
    aviso.textContent = "Tu URL: " + url;
  }

  aviso.className = "aviso";
});

// ---------- Compañeros ----------

async function consultar(url) {
  const resp = await fetch(url);

  if (!resp.ok) {
    throw new Error("El servidor respondió " + resp.status);
  }

  const datos = await resp.json();

  if (!datos.nombre) {
    throw new Error('El JSON no tiene el campo "nombre".');
  }

  return datos;
}

function mensajeError(e) {
  return e instanceof TypeError
    ? "No se pudo leer esa URL. Revisa que sea pública y que su hosting permita CORS (Access-Control-Allow-Origin)."
    : e.message;
}

$("btn-agregar").addEventListener("click", async () => {
  const url = $("url").value.trim();
  const aviso = $("aviso-url");

  aviso.className = "aviso";

  if (!url) {
    aviso.textContent = "Escribe una URL.";
    aviso.className = "aviso error";
    return;
  }

  if (perfiles.has(url)) {
    aviso.textContent = "Ese perfil ya está en pantalla.";
    return;
  }

  aviso.textContent = "Consultando…";

  try {
    const datos = await consultar(url);

    perfiles.set(url, { datos });

    guardarUrls();

    $("url").value = "";

    aviso.textContent = "Perfil de " + datos.nombre + " cargado.";

    pintarTodos();

  } catch (e) {
    aviso.className = "aviso error";
    aviso.textContent = mensajeError(e);
  }
});

// ---------- Compatibilidad ----------

function calcular(mios, suyos) {
  const a = new Set(mios.map(norm));
  const b = new Set(suyos.map(norm));

  const comunes = new Set([...b].filter(x => a.has(x)));

  const union = new Set([...a, ...b]).size;

  return {
    comunes,
    pct: union ? Math.round(comunes.size / union * 100) : 0
  };
}

const nivel = (p) =>
  p >= 70 ? "Casi gemelos" :
  p >= 40 ? "Buena onda" :
  p >= 15 ? "Algo en común" :
  "Polos opuestos";

// ---------- Anillo de compatibilidad ----------

function anillo(pct) {
  const C = 2 * Math.PI * 34;
  const ns = "http://www.w3.org/2000/svg";

  const wrap = el("div", "anillo");

  const svg = document.createElementNS(ns, "svg");

  svg.setAttribute("viewBox", "0 0 84 84");
  svg.setAttribute("width", 84);
  svg.setAttribute("height", 84);

  const mk = (clase) => {
    const c = document.createElementNS(ns, "circle");

    c.setAttribute("class", clase);
    c.setAttribute("cx", 42);
    c.setAttribute("cy", 42);
    c.setAttribute("r", 34);

    return c;
  };

  const valor = mk("valor");

  valor.style.strokeDasharray = C;
  valor.style.strokeDashoffset = C;

  svg.append(mk("fondo"), valor);

  wrap.append(svg, el("b", "", pct + "%"));

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      valor.style.strokeDashoffset = C * (1 - pct / 100);
    });
  });

  return wrap;
}

// ---------- Mostrar compañeros ----------

function pintarTodos() {
  const cont = $("resultados");
  const mios = leerMiPerfil().gustos;

  if (!perfiles.size) {
    cont.replaceChildren(
      el("p", "vacio", "Aún no hay compañeros. Pega una URL arriba para empezar.")
    );
    return;
  }

  const items = [...perfiles].map(([url, r]) => ({
    url,
    ...r,
    ...(r.datos
      ? calcular(mios, listaGustos(r.datos))
      : { pct: -1 })
  })).sort((x, y) => y.pct - x.pct);

  cont.replaceChildren(...items.map(it => {
    const card = el("article", "perfil");

    const quitar = el("button", "quitar", "Quitar");

    quitar.onclick = () => {
      perfiles.delete(it.url);
      guardarUrls();
      pintarTodos();
    };

    if (!it.datos) {
      card.classList.add("error");

      card.append(
        el("strong", "", it.url),
        el("p", "", it.error),
        quitar
      );

      return card;
    }

    const info = el("div");

    info.append(
      el("h3", "", it.datos.nombre),
      el("span", "nivel", nivel(it.pct))
    );

    const cab = el("div", "cab");

    cab.append(
      avatar(it.datos.nombre, it.datos.foto),
      info,
      anillo(it.pct)
    );

    const ul = el("ul", "gustos");

    listaGustos(it.datos).forEach(g => {
      ul.append(
        el("li", it.comunes.has(norm(g)) ? "si" : "no", g)
      );
    });

    card.append(
      cab,
      el("p", "", it.datos.descripcion || ""),
      ul,
      quitar
    );

    return card;
  }));
}

// ---------- Inicio ----------

(async function iniciar() {
  try {
    const respuesta = await fetch("perfil.json");
    const p = await respuesta.json();

    $("nombre").value = p.nombre || "";
    miFoto = p.foto || "";

    $("descripcion").value = p.descripcion || "";
    $("gustos").value = listaGustos(p).join(", ");

  } catch {}

  pintarPreview();

  let urls = [];

  try {
    urls = JSON.parse(localStorage.getItem(CLAVE)) || [];
  } catch {}

  await Promise.all(urls.map(async u => {
    try {
      perfiles.set(u, {
        datos: await consultar(u)
      });
    } catch (e) {
      perfiles.set(u, {
        error: mensajeError(e)
      });
    }
  }));

  pintarTodos();
})();
