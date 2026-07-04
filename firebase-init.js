// firebase-init.js
// Inicialización compartida de Firebase para Magdalena Decide.
// Usa el SDK modular vía CDN, sin necesidad de npm install ni build step.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// Mismo proyecto que Magdalena Reporta. Las colecciones usan el prefijo
// "decide_" para no mezclarse con los datos de Magdalena Reporta.
const firebaseConfig = {
  apiKey: "AIzaSyDFXuoyQubWEI7wmJdDQOggs7hcQklYWJ0",
  authDomain: "magdalena-reporta-29854.firebaseapp.com",
  databaseURL: "https://magdalena-reporta-29854-default-rtdb.firebaseio.com",
  projectId: "magdalena-reporta-29854",
  storageBucket: "magdalena-reporta-29854.firebasestorage.app",
  messagingSenderId: "115719593016",
  appId: "1:115719593016:web:a5860fde25e548a8e71acd"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Nombres de colecciones centralizados para evitar errores de tipeo.
export const COL = {
  RONDAS: "decide_rondas",
  IDEAS: "decide_ideas",
  VOTOS: "decide_votos",
};

export const LOCALIDADES = ["Magdalena","Bavío","Atalaya","Vieytes","Ferrari","Payró","Arditi","El Pino","Empalme","Los Naranjos","Balneario"];
export const TEMAS = ["Infraestructura y obras","Espacios verdes y ambiente","Cultura y patrimonio","Educación","Salud","Deporte y recreación","Seguridad","Transporte y conectividad","Producción y trabajo","Otro"];
export const DESTINOS = ["Concejo Deliberante","Consejo Escolar"];
export const ESTADOS = [
  { valor: "recibida", etiqueta: "Recibida" },
  { valor: "en_revision", etiqueta: "En revisión" },
  { valor: "seleccionada_votacion", etiqueta: "Seleccionada para votación" },
  { valor: "viable", etiqueta: "Viable" },
  { valor: "no_viable", etiqueta: "No viable" },
  { valor: "aprobada", etiqueta: "Aprobada" },
  { valor: "rechazada", etiqueta: "Rechazada" },
];
