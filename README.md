# Magdalena Decide

Plataforma de participación ciudadana del Partido de Magdalena. Sitio estático
(sin build step) que usa Firestore como base de datos, sobre el mismo
proyecto Firebase de Magdalena Reporta.

## Antes de publicar: 3 pasos obligatorios en Firebase Console

### 1. Reglas de Firestore

Andá a **Firestore Database → Reglas** en la consola de Firebase y pegá esto
(reemplazá el bloque existente o agregalo si Magdalena Reporta ya tiene reglas
propias, uniéndolo con `match /databases/{database}/documents { ... }`):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /decide_rondas/{rondaId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    match /decide_ideas/{ideaId} {
      allow read: if true;
      allow create: if request.resource.data.estado == 'recibida'
                    && request.resource.data.votos == 0
                    && request.resource.data.destino == null;
      allow update, delete: if request.auth != null;
    }

    match /decide_votos/{votoId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if request.auth != null;
    }
  }
}
```

Esto permite que cualquier vecino lea y cargue ideas o votos sin loguearse,
pero solo una cuenta autenticada (vos) puede cambiar el estado de una idea o
borrar algo.

### 2. Crear tu usuario de administrador

Andá a **Authentication → Users → Add user** y creá tu usuario con el email y
contraseña que vas a usar para entrar a `/admin.html`. No hace falta ningún
otro rol: cualquier cuenta autenticada en este proyecto puede administrar,
así que **no compartas ese usuario**.

### 3. Crear la primera ronda

Entrá a `admin.html`, iniciá sesión, y en la pestaña **Rondas** creá:

- Nombre: `2026 · Segundo semestre`
- Apertura de carga: `2026-07-15`
- Cierre de carga: `2026-08-05`
- Marcada como activa ✓

Sin esto, el formulario público va a avisar que no hay ninguna ronda abierta.

## Estructura de archivos

```
index.html         → sitio público
admin.html          → panel de administración
app.js              → lógica del sitio público
admin.js            → lógica del panel admin
firebase-init.js    → configuración y helpers compartidos de Firebase
styles.css          → estilos compartidos
```

## Deploy en Vercel

1. Subí esta carpeta a un repositorio de GitHub (o arrastrala directo si usás
   el importador de Vercel con carpeta local).
2. En Vercel: **New Project → Import**. Como es HTML/JS plano, no hace falta
   configurar ningún framework ni build command — dejalo en "Other".
3. Deploy. Listo, ya queda con HTTPS y dominio de Vercel.

## Notas de diseño del modelo de datos

- **Un vecino puede cargar todas las ideas que quiera** por ronda, sin límite.
- **La votación no tiene fecha de cierre** — solo la carga de ideas la tiene.
- El campo **destino** (Concejo Deliberante / Consejo Escolar) lo asignás vos
  desde el panel admin; el vecino no lo elige al cargar.
- El control de "un voto por email por idea" es una verificación simple (no
  hay autenticación real del votante), consistente con la decisión de
  priorizar la fricción cero en el registro para votar.
