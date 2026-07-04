import { db, auth, COL, LOCALIDADES, TEMAS, DESTINOS, ESTADOS } from "./firebase-init.js";
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection, addDoc, doc, updateDoc, onSnapshot, query, orderBy,
  serverTimestamp, Timestamp, writeBatch, getDocs
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/* =========================================================
   AUTENTICACIÓN
   ========================================================= */
const loginScreen = document.getElementById('login-screen');
const adminShell = document.getElementById('admin-shell');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.style.display = 'none';
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  try{
    await signInWithEmailAndPassword(auth, email, password);
  }catch(err){
    loginError.textContent = 'Email o contraseña incorrectos.';
    loginError.style.display = 'block';
  }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if(user){
    loginScreen.style.display = 'none';
    adminShell.classList.add('visible');
    iniciarPanel();
  } else {
    loginScreen.style.display = 'flex';
    adminShell.classList.remove('visible');
  }
});

/* =========================================================
   TABS
   ========================================================= */
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});

let panelIniciado = false;
function iniciarPanel(){
  if(panelIniciado) return;
  panelIniciado = true;
  poblarFiltros();
  suscribirIdeas();
  suscribirRondas();
}

/* =========================================================
   IDEAS
   ========================================================= */
let todasLasIdeas = [];
let rondasCache = [];

function poblarFiltros(){
  const selEstado = document.getElementById('filtro-estado');
  ESTADOS.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.valor; opt.textContent = e.etiqueta;
    selEstado.appendChild(opt);
  });
  const selTema = document.getElementById('filtro-tema');
  TEMAS.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    selTema.appendChild(opt);
  });
  const selLoc = document.getElementById('filtro-localidad');
  LOCALIDADES.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l; opt.textContent = l;
    selLoc.appendChild(opt);
  });
  [selEstado, selTema, selLoc].forEach(s => s.addEventListener('change', renderIdeasAdmin));
}

function suscribirIdeas(){
  const q = query(collection(db, COL.IDEAS), orderBy('createdAt', 'desc'));
  onSnapshot(q, (snap) => {
    todasLasIdeas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStats();
    renderIdeasAdmin();
  }, (err) => {
    console.error(err);
    document.getElementById('ideas-list').innerHTML = '<p class="empty-note">No se pudieron cargar las ideas.</p>';
  });
}

function renderStats(){
  const total = todasLasIdeas.length;
  const enVotacion = todasLasIdeas.filter(i => i.estado === 'seleccionada_votacion').length;
  const aprobadas = todasLasIdeas.filter(i => i.estado === 'aprobada').length;
  const totalVotos = todasLasIdeas.reduce((acc, i) => acc + (i.votos || 0), 0);
  document.getElementById('stat-row').innerHTML = `
    <div class="stat-box"><div class="num">${total}</div><div class="label">Ideas totales</div></div>
    <div class="stat-box"><div class="num">${enVotacion}</div><div class="label">En votación</div></div>
    <div class="stat-box"><div class="num">${aprobadas}</div><div class="label">Aprobadas</div></div>
    <div class="stat-box"><div class="num">${totalVotos}</div><div class="label">Votos totales</div></div>
  `;
}

function estadoEtiqueta(valor){
  return ESTADOS.find(e => e.valor === valor)?.etiqueta || valor;
}

function renderIdeasAdmin(){
  const list = document.getElementById('ideas-list');
  const fEstado = document.getElementById('filtro-estado').value;
  const fTema = document.getElementById('filtro-tema').value;
  const fLoc = document.getElementById('filtro-localidad').value;

  const filtradas = todasLasIdeas.filter(i =>
    (fEstado === 'todos' || i.estado === fEstado) &&
    (fTema === 'todos' || i.tema === fTema) &&
    (fLoc === 'todos' || i.localidad === fLoc)
  );

  if(filtradas.length === 0){
    list.innerHTML = '<p class="empty-note">No hay ideas para este filtro.</p>';
    return;
  }

  list.innerHTML = '';
  filtradas.forEach(idea => {
    const fecha = idea.createdAt?.toDate?.() ? idea.createdAt.toDate().toLocaleDateString('es-AR') : '—';
    const card = document.createElement('div');
    card.className = 'admin-card';
    card.innerHTML = `
      <div class="admin-card-head">
        <div>
          <h3>${idea.titulo}</h3>
          <div class="admin-meta">${idea.nombreAutor} · ${idea.emailAutor} · ${fecha} · ${idea.votos || 0} votos</div>
        </div>
        <span class="pill ${idea.estado === 'aprobada' ? 'pill-green' : idea.estado === 'rechazada' ? 'pill-red' : ''}">${estadoEtiqueta(idea.estado)}</span>
      </div>
      <p class="admin-desc">${idea.descripcion}</p>
      <div class="ticket-tags" style="margin-bottom:8px;">
        <span class="tag tag-tema">${idea.tema}</span>
        <span class="tag tag-loc">${idea.localidad}</span>
      </div>
      <div class="admin-grid-controls">
        <div class="admin-field">
          <label>Estado</label>
          <select class="input-estado">
            ${ESTADOS.map(e => `<option value="${e.valor}" ${e.valor === idea.estado ? 'selected' : ''}>${e.etiqueta}</option>`).join('')}
          </select>
        </div>
        <div class="admin-field">
          <label>Destino institucional</label>
          <select class="input-destino">
            <option value="" ${!idea.destino ? 'selected' : ''}>Sin asignar</option>
            ${DESTINOS.map(d => `<option value="${d}" ${d === idea.destino ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="admin-field" style="margin-top:12px;">
        <label>Comentario interno / justificación de viabilidad</label>
        <textarea class="input-comentario" placeholder="Notas para seguimiento (no visible para el vecino todavía)">${idea.comentarioAdmin || ''}</textarea>
      </div>
      <div class="save-row">
        <span class="save-status" data-status></span>
        <button class="btn btn-primary btn-small btn-guardar">Guardar cambios</button>
      </div>
    `;

    card.querySelector('.btn-guardar').addEventListener('click', async () => {
      const statusEl = card.querySelector('[data-status]');
      const nuevoEstado = card.querySelector('.input-estado').value;
      const nuevoDestino = card.querySelector('.input-destino').value || null;
      const nuevoComentario = card.querySelector('.input-comentario').value;
      statusEl.textContent = 'Guardando…';
      try{
        await updateDoc(doc(db, COL.IDEAS, idea.id), {
          estado: nuevoEstado,
          destino: nuevoDestino,
          comentarioAdmin: nuevoComentario,
        });
        statusEl.textContent = 'Guardado ✓';
        setTimeout(() => statusEl.textContent = '', 2500);
      }catch(err){
        console.error(err);
        statusEl.textContent = 'Error al guardar';
      }
    });

    list.appendChild(card);
  });
}

/* =========================================================
   RONDAS
   ========================================================= */
function suscribirRondas(){
  const q = query(collection(db, COL.RONDAS), orderBy('fechaAperturaCarga', 'desc'));
  onSnapshot(q, (snap) => {
    rondasCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRondas();
  }, (err) => {
    console.error(err);
    document.getElementById('rondas-list').innerHTML = '<p class="empty-note">No se pudieron cargar las rondas.</p>';
  });
}

function renderRondas(){
  const list = document.getElementById('rondas-list');
  if(rondasCache.length === 0){
    list.innerHTML = '<p class="empty-note">Todavía no creaste ninguna ronda.</p>';
    return;
  }
  list.innerHTML = '';
  rondasCache.forEach(r => {
    const apertura = r.fechaAperturaCarga?.toDate?.();
    const cierre = r.fechaCierreCarga?.toDate?.();
    const card = document.createElement('div');
    card.className = 'admin-card';
    card.innerHTML = `
      <div class="admin-card-head">
        <div>
          <h3>${r.nombre}</h3>
          <div class="admin-meta">Carga: ${apertura ? apertura.toLocaleDateString('es-AR') : '—'} — ${cierre ? cierre.toLocaleDateString('es-AR') : '—'}</div>
        </div>
        <span class="pill ${r.activa ? 'pill-green' : ''}">${r.activa ? 'Activa' : 'Inactiva'}</span>
      </div>
      ${!r.activa ? '<div class="save-row"><button class="btn btn-small btn-ghost btn-marcar-activa">Marcar como activa</button></div>' : ''}
    `;
    const btnActivar = card.querySelector('.btn-marcar-activa');
    if(btnActivar){
      btnActivar.addEventListener('click', () => marcarRondaActiva(r.id));
    }
    list.appendChild(card);
  });
}

async function marcarRondaActiva(rondaId){
  try{
    const batch = writeBatch(db);
    rondasCache.forEach(r => {
      if(r.activa) batch.update(doc(db, COL.RONDAS, r.id), { activa: false });
    });
    batch.update(doc(db, COL.RONDAS, rondaId), { activa: true });
    await batch.commit();
  }catch(err){
    console.error(err);
    alert('No se pudo activar la ronda.');
  }
}

document.getElementById('crear-ronda-btn').addEventListener('click', async () => {
  const status = document.getElementById('ronda-status');
  const nombre = document.getElementById('ronda-nombre').value.trim();
  const apertura = document.getElementById('ronda-apertura').value;
  const cierre = document.getElementById('ronda-cierre').value;
  const marcarActiva = document.getElementById('ronda-activa-check').checked;

  if(!nombre || !apertura || !cierre){
    status.textContent = 'Completá nombre, apertura y cierre.';
    return;
  }

  status.textContent = 'Creando…';
  try{
    if(marcarActiva){
      const batch = writeBatch(db);
      rondasCache.forEach(r => {
        if(r.activa) batch.update(doc(db, COL.RONDAS, r.id), { activa: false });
      });
      await batch.commit();
    }
    await addDoc(collection(db, COL.RONDAS), {
      nombre,
      fechaAperturaCarga: Timestamp.fromDate(new Date(apertura + 'T00:00:00')),
      fechaCierreCarga: Timestamp.fromDate(new Date(cierre + 'T23:59:59')),
      activa: marcarActiva,
      createdAt: serverTimestamp(),
    });
    status.textContent = 'Ronda creada ✓';
    document.getElementById('ronda-nombre').value = '';
    document.getElementById('ronda-apertura').value = '';
    document.getElementById('ronda-cierre').value = '';
    setTimeout(() => status.textContent = '', 3000);
  }catch(err){
    console.error(err);
    status.textContent = 'Error al crear la ronda.';
  }
});
