import { db, COL, LOCALIDADES, TEMAS } from "./firebase-init.js";
import {
  collection, addDoc, getDocs, query, where, onSnapshot,
  doc, runTransaction, serverTimestamp, limit, increment
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/* =========================================================
   1. RONDA ACTIVA + CONTADOR
   ========================================================= */
let rondaActiva = null;

function formatFecha(d){
  return d.toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' }).replace('.', '');
}

async function cargarRondaActiva(){
  const badge = document.getElementById('ronda-badge');
  try{
    const q = query(collection(db, COL.RONDAS), where('activa', '==', true), limit(1));
    const snap = await getDocs(q);
    if(snap.empty){
      badge.textContent = 'No hay ninguna ronda abierta en este momento';
      return;
    }
    const d = snap.docs[0];
    rondaActiva = { id: d.id, ...d.data() };
    badge.textContent = `Ronda ${rondaActiva.nombre}`;

    const apertura = rondaActiva.fechaAperturaCarga?.toDate?.();
    const cierre = rondaActiva.fechaCierreCarga?.toDate?.();
    if(apertura && cierre){
      document.getElementById('board').style.display = 'inline-flex';
      document.getElementById('board-fechas').textContent = `${formatFecha(apertura)} — ${formatFecha(cierre)}`;
      actualizarContador(apertura, cierre);
      setInterval(() => actualizarContador(apertura, cierre), 60 * 1000);
    }
  }catch(err){
    console.error('Error cargando ronda activa', err);
    badge.textContent = 'Magdalena Decide';
  }
}

function actualizarContador(apertura, cierre){
  const el = document.getElementById('countdown-value');
  const ahora = new Date();
  if(ahora < apertura){
    const dias = Math.ceil((apertura - ahora) / 86400000);
    el.innerHTML = `Abre en <strong>${dias}</strong> día${dias === 1 ? '' : 's'}`;
  } else if(ahora <= cierre){
    const dias = Math.ceil((cierre - ahora) / 86400000);
    el.innerHTML = `<strong>${dias}</strong> día${dias === 1 ? '' : 's'} para aportar tu idea`;
  } else {
    el.innerHTML = 'La carga de ideas cerró';
  }
}

function cargaEstaAbierta(){
  if(!rondaActiva) return false;
  const apertura = rondaActiva.fechaAperturaCarga?.toDate?.();
  const cierre = rondaActiva.fechaCierreCarga?.toDate?.();
  if(!apertura || !cierre) return false;
  const ahora = new Date();
  return ahora >= apertura && ahora <= cierre;
}

/* =========================================================
   2. LÍNEA DE PUEBLOS
   ========================================================= */
const routeTrack = document.getElementById('route-track');
LOCALIDADES.forEach((loc) => {
  const btn = document.createElement('button');
  btn.className = 'stop';
  btn.innerHTML = `<span class="stop-dot"></span><span class="stop-name">${loc}</span>`;
  btn.addEventListener('click', () => {
    const yaActivo = btn.classList.contains('active');
    document.querySelectorAll('.stop').forEach(s => s.classList.remove('active'));
    if(!yaActivo) btn.classList.add('active');
    activeLoc = yaActivo ? null : loc;
    renderIdeas();
    document.getElementById('ideas').scrollIntoView({ behavior: 'smooth' });
  });
  routeTrack.appendChild(btn);
});

/* =========================================================
   3. CHIPS DEL FORMULARIO
   ========================================================= */
function buildChipGroup(containerId, values){
  const el = document.getElementById(containerId);
  values.forEach(v => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = v;
    chip.addEventListener('click', () => {
      el.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
    el.appendChild(chip);
  });
}
buildChipGroup('temas-chips', TEMAS);
buildChipGroup('localidades-chips', LOCALIDADES);

/* =========================================================
   4. ENVÍO DEL FORMULARIO
   ========================================================= */
const form = document.getElementById('idea-form');
const submitBtn = document.getElementById('submit-btn');
const formMsg = document.getElementById('form-msg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg.className = '';
  formMsg.textContent = '';

  if(!cargaEstaAbierta()){
    formMsg.textContent = 'La carga de ideas no está abierta en este momento.';
    formMsg.classList.add('form-error');
    return;
  }

  const tema = document.querySelector('#temas-chips .chip.selected')?.textContent;
  const localidad = document.querySelector('#localidades-chips .chip.selected')?.textContent;
  if(!tema || !localidad){
    formMsg.textContent = 'Elegí un tema y una localidad para tu idea.';
    formMsg.classList.add('form-error');
    return;
  }

  const data = {
    rondaId: rondaActiva.id,
    titulo: document.getElementById('titulo').value.trim(),
    descripcion: document.getElementById('descripcion').value.trim(),
    tema, localidad,
    nombreAutor: document.getElementById('nombre').value.trim(),
    emailAutor: document.getElementById('email').value.trim().toLowerCase(),
    destino: null,
    estado: 'recibida',
    comentarioAdmin: '',
    votos: 0,
    createdAt: serverTimestamp(),
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando…';
  try{
    await addDoc(collection(db, COL.IDEAS), data);
    formMsg.textContent = '¡Listo! Tu idea fue enviada para revisión.';
    form.reset();
    document.querySelectorAll('#temas-chips .chip, #localidades-chips .chip').forEach(c => c.classList.remove('selected'));
  }catch(err){
    console.error(err);
    formMsg.textContent = 'Hubo un problema al enviar tu idea. Probá de nuevo.';
    formMsg.classList.add('form-error');
  }finally{
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar mi idea';
    setTimeout(() => { formMsg.textContent = ''; formMsg.className = ''; }, 6000);
  }
});

/* =========================================================
   5. IDEAS EN VOTACIÓN (tiempo real)
   ========================================================= */
let ideas = [];
let activeTema = 'Todos los temas';
let activeLoc = null;

const filtersEl = document.getElementById('filters');
['Todos los temas', ...TEMAS].forEach(t => {
  const chip = document.createElement('button');
  chip.className = 'filter-chip' + (t === activeTema ? ' active' : '');
  chip.textContent = t;
  chip.addEventListener('click', () => {
    activeTema = t;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    renderIdeas();
  });
  filtersEl.appendChild(chip);
});

const grid = document.getElementById('ideas-grid');

function renderIdeas(){
  grid.innerHTML = '';
  const list = ideas.filter(i =>
    (activeTema === 'Todos los temas' || i.tema === activeTema) &&
    (!activeLoc || i.localidad === activeLoc)
  );
  if(list.length === 0){
    grid.innerHTML = '<p class="empty-note">No hay ideas en votación para este filtro todavía.</p>';
    return;
  }
  list.sort((a, b) => (b.votos || 0) - (a.votos || 0));
  list.forEach(idea => {
    const card = document.createElement('article');
    card.className = 'ticket';
    card.innerHTML = `
      <div class="ticket-tags">
        <span class="tag tag-tema">${idea.tema}</span>
        <span class="tag tag-loc">${idea.localidad}</span>
      </div>
      <h3>${idea.titulo}</h3>
      <p>${idea.descripcion}</p>
      <div class="ticket-divider"></div>
      <div class="ticket-foot">
        <span class="author">Por ${idea.nombreAutor}</span>
        <button class="vote-btn" data-id="${idea.id}">
          <span class="vote-icon">♡</span>
          <span class="vote-count">${idea.votos || 0}</span>
        </button>
      </div>
    `;
    card.querySelector('.vote-btn').addEventListener('click', () => abrirModalVoto(idea));
    grid.appendChild(card);
  });
}

function suscribirIdeasEnVotacion(){
  const q = query(collection(db, COL.IDEAS), where('estado', '==', 'seleccionada_votacion'));
  onSnapshot(q, (snap) => {
    ideas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderIdeas();
  }, (err) => {
    console.error(err);
    grid.innerHTML = '<p class="empty-note">No pudimos cargar las ideas en este momento.</p>';
  });
}

/* =========================================================
   6. MODAL DE VOTO
   ========================================================= */
const modal = document.getElementById('vote-modal');
const modalTitle = document.getElementById('vote-modal-title');
const voteError = document.getElementById('vote-error');
let ideaEnVoto = null;

function abrirModalVoto(idea){
  ideaEnVoto = idea;
  modalTitle.textContent = idea.titulo;
  document.getElementById('vote-nombre').value = '';
  document.getElementById('vote-email').value = '';
  voteError.style.display = 'none';
  modal.style.display = 'flex';
}
function cerrarModalVoto(){
  modal.style.display = 'none';
  ideaEnVoto = null;
}
document.getElementById('vote-cancel-btn').addEventListener('click', cerrarModalVoto);
modal.addEventListener('click', (e) => { if(e.target === modal) cerrarModalVoto(); });

document.getElementById('vote-confirm-btn').addEventListener('click', async () => {
  const nombre = document.getElementById('vote-nombre').value.trim();
  const email = document.getElementById('vote-email').value.trim().toLowerCase();
  voteError.style.display = 'none';

  if(!nombre || !email || !email.includes('@')){
    voteError.textContent = 'Completá tu nombre y un email válido.';
    voteError.style.display = 'block';
    return;
  }

  try{
    // Evitar voto duplicado del mismo email para la misma idea.
    const dupQ = query(
      collection(db, COL.VOTOS),
      where('ideaId', '==', ideaEnVoto.id),
      where('emailVotante', '==', email)
    );
    const dupSnap = await getDocs(dupQ);
    if(!dupSnap.empty){
      voteError.textContent = 'Ya votaste esta idea con ese email.';
      voteError.style.display = 'block';
      return;
    }

    await addDoc(collection(db, COL.VOTOS), {
      ideaId: ideaEnVoto.id,
      nombreVotante: nombre,
      emailVotante: email,
      createdAt: serverTimestamp(),
    });

    const ideaRef = doc(db, COL.IDEAS, ideaEnVoto.id);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ideaRef);
      const votosActuales = snap.data()?.votos || 0;
      tx.update(ideaRef, { votos: votosActuales + 1 });
    });

    cerrarModalVoto();
  }catch(err){
    console.error(err);
    voteError.textContent = 'Hubo un problema al registrar tu voto. Probá de nuevo.';
    voteError.style.display = 'block';
  }
});

/* =========================================================
   INIT
   ========================================================= */
cargarRondaActiva();
suscribirIdeasEnVotacion();
