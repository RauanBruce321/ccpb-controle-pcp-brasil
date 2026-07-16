// ========================================
// CCPB - Inicialização Firebase
// ========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

const firebaseConfig = window.CCPB_FIREBASE_CONFIG;

const app = initializeApp(firebaseConfig);

window.firebaseApp = app;

console.log("CCPB conectado ao Firebase.");