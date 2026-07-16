// ========================================
// CCPB - Realtime Database
// ========================================

import {
    getDatabase,
    ref,
    set,
    get,
    update,
    remove
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const db = getDatabase(window.firebaseApp);

window.CCPB_DB = db;

window.CCPB = {

    salvar(caminho, dados) {
        return set(ref(db, caminho), dados);
    },

    atualizar(caminho, dados) {
        return update(ref(db, caminho), dados);
    },

    ler(caminho) {
        return get(ref(db, caminho));
    },

    excluir(caminho) {
        return remove(ref(db, caminho));
    }

};

console.log("Realtime Database conectado.");