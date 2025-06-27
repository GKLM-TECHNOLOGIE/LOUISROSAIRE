// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDk0Kqme3rqsdCP3QkTJ6dugrSzuWDmcqU",
    authDomain: "louis-rosaire.firebaseapp.com",
    databaseURL: "https://louis-rosaire-default-rtdb.firebaseio.com",
    projectId: "louis-rosaire",
    storageBucket: "louis-rosaire.firebasestorage.app",
    messagingSenderId: "855365343229",
    appId: "1:855365343229:web:99df133fb567e860a3ab94",
    measurementId: "G-G83X4FS4XN"
};

// --- INITIALIZE FIREBASE ---
firebase.initializeApp(firebaseConfig);
const database = firebase.database();


document.addEventListener('DOMContentLoaded', () => {
    // --- ÉLÉMENTS DU DOM ---
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');
    const footerUserInfo = document.getElementById('footer-user-info');

    const mainContent = document.querySelector('.content');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // Formulaires
    const formAchat = document.getElementById('form-achat');
    const formVenteStock = document.getElementById('form-vente-stock');
    const formVenteService = document.getElementById('form-vente-service');
    const formDepense = document.getElementById('form-depense');
    const formAjustementStock = document.getElementById('form-stock-ajustement');
    const formAdminUser = document.getElementById('form-admin-user');
    const genererBilanBtn = document.getElementById('generer-bilan');

    // Listes (tbody)
    const achatsList = document.getElementById('achats-list');
    const stockList = document.getElementById('stock-list');
    const etatsStockList = document.getElementById('etats-stock-list');
    const ventesStockList = document.getElementById('ventes-stock-list');
    const ventesServiceList = document.getElementById('ventes-service-list');
    const depensesList = document.getElementById('depenses-list');
    const usersList = document.getElementById('users-list');
    
    // Champs spécifiques
    const venteStockProduitSelect = document.getElementById('vente-stock-produit');
    const venteTypePrixSelect = document.getElementById('vente-type-prix');
    const venteStockPrixInput = document.getElementById('vente-stock-prix');
    const ajustProduitSelect = document.getElementById('ajust-produit');
    
    // Modal
    const editModal = document.getElementById('edit-modal');
    const modalForm = document.getElementById('modal-form');
    const modalTitle = document.getElementById('modal-title');
    const modalCancelBtn = document.getElementById('modal-cancel');
    const modalSaveBtn = document.getElementById('modal-save');

    let caChartInstance = null;
    let originalItemForEdit = null; // Pour gérer les changements de quantité en stock

    // --- BASE DE DONNÉES (Local cache of Firebase data) ---
    let db = {
        achats: [], stock: [], ventes: [], depenses: [], users: []
    };
    
    // --- LOGIN / AUTHENTICATION ---
    const showLogin = () => {
        loginContainer.classList.add('active');
        appContainer.classList.remove('active');
    };

    const showApp = (user) => {
        loginContainer.classList.remove('active');
        appContainer.classList.add('active');
        footerUserInfo.textContent = `Connecté: ${user.username}`;
    };

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        loginError.textContent = '';
        const user = db.users.find(u => u.username === username && u.password === password);
        if (user) {
            sessionStorage.setItem('currentUser', JSON.stringify(user));
            showApp(user);
        } else {
            loginError.textContent = 'Nom d\'utilisateur ou mot de passe incorrect.';
        }
    });

    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.removeItem('currentUser');
        location.reload();
    });

    // --- MISE À JOUR DU STOCK ---
    function updateStock(produitNom, quantiteChange, info = {}) {
        let produit = db.stock.find(p => p.nom.toLowerCase() === produitNom.toLowerCase());
        if (produit) {
            const newQuantity = produit.quantite + quantiteChange;
            const updates = { quantite: newQuantity };
            if (info.prixDetail != null) updates.prixVenteDetail = info.prixDetail;
            if (info.prixGros != null) updates.prixVenteGros = info.prixGros;
            database.ref('stock/' + produit.id).update(updates);
        } else if (quantiteChange > 0) {
            const seuil = prompt(`Nouveau produit "${produitNom}". Définir un seuil d'alerte :`, 10);
            const nouveauProduit = {
                nom: produitNom, quantite: quantiteChange, seuilAlerte: parseInt(seuil) || 5,
                prixVenteDetail: info.prixDetail || 0, prixVenteGros: info.prixGros || 0,
            };
            database.ref('stock').push(nouveauProduit);
        }
    }

    // --- FONCTIONS DE RENDU (AFFICHAGE) ---
    const renderAll = () => {
        renderAchats(); renderStock(); renderEtatsStock();
        renderVentesStock(); renderVentesService(); renderDepenses();
        renderUsers(); renderDashboard(); updateSelects();
    };

    const createActionsCell = (item, type) => `
        <td class="actions-cell">
            <button class="action-btn edit-btn" data-id="${item.id}" data-type="${type}" title="Modifier">✏️</button>
            <button class="action-btn delete-btn" data-id="${item.id}" data-type="${type}" title="Supprimer">🗑️</button>
        </td>`;

    const renderAchats = () => {
        achatsList.innerHTML = [...db.achats].sort((a, b) => new Date(b.date) - new Date(a.date)).map(achat => `
            <tr>
                <td>${new Date(achat.date).toLocaleDateString()}</td>
                <td>${achat.designation}</td>
                <td>${achat.quantite}</td>
                <td>${(achat.cout || 0).toFixed(0)} FCFA</td>
                <td>${((achat.quantite || 0) * (achat.cout || 0)).toFixed(0)} FCFA</td>
                ${createActionsCell(achat, 'achat')}
            </tr>`).join('');
    };
    
    const renderStock = () => {
        stockList.innerHTML = [...db.stock].sort((a,b) => a.nom.localeCompare(b.nom)).map(p => {
            const enAlerte = p.quantite <= p.seuilAlerte;
            return `<tr>
                <td>${p.nom}</td>
                <td class="${enAlerte ? 'stock-alerte' : 'stock-ok'}">${p.quantite}</td>
                <td>${p.seuilAlerte}</td>
                <td>${(p.prixVenteDetail || 0).toFixed(0)} FCFA</td>
                <td>${(p.prixVenteGros || 0).toFixed(0)} FCFA</td>
                <td><span class="${enAlerte ? 'stock-alerte' : 'stock-ok'}">${enAlerte ? 'Stock Faible' : 'OK'}</span></td>
                ${createActionsCell(p, 'stock')}
            </tr>`;
        }).join('');
    };

    const renderEtatsStock = () => {
        etatsStockList.innerHTML = [...db.stock].sort((a,b) => a.nom.localeCompare(b.nom)).map(produit => {
            const qteVendue = db.ventes
                .filter(v => v.typeVente === 'stock' && v.designation === produit.nom)
                .reduce((sum, v) => sum + v.quantite, 0);
            const qteInitiale = produit.quantite + qteVendue;
            return `<tr>
                <td>${produit.nom}</td>
                <td>${qteInitiale}</td>
                <td>${qteVendue}</td>
                <td>${produit.quantite}</td>
            </tr>`;
        }).join('');
    };

    const renderVentesStock = () => {
        ventesStockList.innerHTML = db.ventes.filter(v => v.typeVente === 'stock').sort((a,b) => new Date(b.date) - new Date(a.date)).map(v => `
            <tr>
                <td>${new Date(v.date).toLocaleDateString()}</td>
                <td>${v.designation}</td>
                <td>${v.quantite}</td>
                <td>${(v.prixUnitaire || 0).toFixed(0)} FCFA</td>
                <td>${(v.total || 0).toFixed(0)} FCFA</td>
                ${createActionsCell(v, 'vente-stock')}
            </tr>`).join('');
    };

    const renderVentesService = () => {
        ventesServiceList.innerHTML = db.ventes.filter(v => v.typeVente === 'service').sort((a,b) => new Date(b.date) - new Date(a.date)).map(v => `
            <tr>
                <td>${new Date(v.date).toLocaleDateString()}</td>
                <td>${v.designation}</td>
                <td>${v.quantite}</td>
                <td>${(v.total || 0).toFixed(0)} FCFA</td>
                ${createActionsCell(v, 'vente-service')}
            </tr>`).join('');
    };
    
    const renderDepenses = () => {
        depensesList.innerHTML = [...db.depenses].sort((a,b) => new Date(b.date) - new Date(a.date)).map(d => `
            <tr>
                <td>${new Date(d.date).toLocaleDateString()}</td>
                <td>${d.motif}</td>
                <td>${(d.montant || 0).toFixed(0)} FCFA</td>
                ${createActionsCell(d, 'depense')}
            </tr>`).join('');
    };

    const renderUsers = () => {
        usersList.innerHTML = [...db.users].sort((a, b) => a.username.localeCompare(b.username)).map(user => `
            <tr>
                <td>${user.username}</td>
                <td>${user.level}</td>
                ${createActionsCell(user, 'user')}
            </tr>`).join('');
    };

    const renderDashboard = () => {
        const aujourdhui = new Date();
        const caJour = db.ventes.filter(v => new Date(v.date).toDateString() === aujourdhui.toDateString()).reduce((sum, v) => sum + v.total, 0);
        document.getElementById('kpi-ca-jour').textContent = `${caJour.toFixed(0)} FCFA`;
        const depensesMois = db.depenses.filter(d => new Date(d.date).getMonth() === aujourdhui.getMonth() && new Date(d.date).getFullYear() === aujourdhui.getFullYear()).reduce((sum, d) => sum + d.montant, 0);
        document.getElementById('kpi-depenses-mois').textContent = `${depensesMois.toFixed(0)} FCFA`;
        document.getElementById('kpi-stock-alerte').textContent = db.stock.filter(p => p.quantite <= p.seuilAlerte).length;
        renderCaChart();
    };

    const renderCaChart = () => {
        const datePoints = Array.from({length: 7}, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d; }).reverse();
        const labels = datePoints.map(d => d.toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'}));
        const data = datePoints.map(d => db.ventes.filter(v => new Date(v.date).toDateString() === d.toDateString()).reduce((sum, v) => sum + v.total, 0));
        const ctx = document.getElementById('ca-chart').getContext('2d');
        if (caChartInstance) caChartInstance.destroy();
        caChartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'CA (FCFA)', data, backgroundColor: 'rgba(25, 42, 86, 0.7)' }] },
            options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });
    };

    const updateSelects = () => {
        const stockOptions = db.stock.sort((a,b) => a.nom.localeCompare(b.nom)).map(p => `<option value="${p.nom}">${p.nom} (Stock: ${p.quantite})</option>`).join('');
        venteStockProduitSelect.innerHTML = `<option value="">-- Sélectionner --</option>${stockOptions}`;
        ajustProduitSelect.innerHTML = `<option value="">-- Sélectionner --</option>${db.stock.sort((a,b) => a.nom.localeCompare(b.nom)).map(p => `<option value="${p.nom}">${p.nom}</option>`).join('')}`;
    };
    
    const updateVentePrix = () => {
        const produit = db.stock.find(p => p.nom === venteStockProduitSelect.value);
        if (produit) {
            venteStockPrixInput.value = venteTypePrixSelect.value === 'gros' ? produit.prixVenteGros : produit.prixVenteDetail;
        }
    };

    // --- GESTIONNAIRES D'ÉVÉNEMENTS ---
    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const pageId = link.dataset.page;
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(`${pageId}-page`).classList.add('active');
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    mainContent.addEventListener('click', e => {
        if (e.target.classList.contains('tab-btn')) {
            const tabButton = e.target;
            const page = tabButton.closest('.page');
            const tabId = tabButton.dataset.tab;
            page.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            tabButton.classList.add('active');
            page.querySelector(`#tab-content-${tabId}`).classList.add('active');
        }
    });

    formAchat.addEventListener('submit', e => {
        e.preventDefault();
        const designation = document.getElementById('achat-designation').value;
        const quantite = parseInt(document.getElementById('achat-quantite').value);
        const nouvelAchat = {
            date: document.getElementById('achat-date').value, designation, quantite,
            cout: parseFloat(document.getElementById('achat-cout').value),
            prixDetail: parseFloat(document.getElementById('achat-prix-detail').value),
            prixGros: parseFloat(document.getElementById('achat-prix-gros').value),
        };
        database.ref('achats').push(nouvelAchat);
        updateStock(designation, quantite, { prixDetail: nouvelAchat.prixDetail, prixGros: nouvelAchat.prixGros });
        formAchat.reset();
    });
    
    venteStockProduitSelect.addEventListener('change', updateVentePrix);
    venteTypePrixSelect.addEventListener('change', updateVentePrix);
    
    formVenteStock.addEventListener('submit', e => {
        e.preventDefault();
        const nomProduit = venteStockProduitSelect.value;
        const quantiteVendue = parseInt(document.getElementById('vente-stock-quantite').value);
        const produitEnStock = db.stock.find(p => p.nom === nomProduit);
        if (!produitEnStock || quantiteVendue > produitEnStock.quantite) return alert('Stock insuffisant !');
        const prixUnitaire = parseFloat(venteStockPrixInput.value);
        database.ref('ventes').push({
            date: document.getElementById('vente-stock-date').value,
            typeVente: 'stock', designation: nomProduit, quantite: quantiteVendue, prixUnitaire,
            total: quantiteVendue * prixUnitaire
        });
        updateStock(nomProduit, -quantiteVendue);
        formVenteStock.reset();
    });

    formVenteService.addEventListener('submit', e => { e.preventDefault(); database.ref('ventes').push({ date: document.getElementById('vente-service-date').value, typeVente: 'service', designation: document.getElementById('vente-service-designation').value, quantite: parseInt(document.getElementById('vente-service-quantite').value), total: parseFloat(document.getElementById('vente-service-prix-global').value) }); formVenteService.reset(); });
    formDepense.addEventListener('submit', e => { e.preventDefault(); database.ref('depenses').push({ date: document.getElementById('depense-date').value, motif: document.getElementById('depense-motif').value, montant: parseFloat(document.getElementById('depense-montant').value) }); formDepense.reset(); });
    
    formAjustementStock.addEventListener('submit', e => {
        e.preventDefault();
        const nomProduit = ajustProduitSelect.value;
        const nouvelleQte = parseInt(document.getElementById('ajust-quantite').value);
        const produit = db.stock.find(p => p.nom === nomProduit);
        if (produit && !isNaN(nouvelleQte)) {
            database.ref('stock/' + produit.id).update({ quantite: nouvelleQte });
            formAjustementStock.reset();
            alert(`Stock de "${nomProduit}" ajusté à ${nouvelleQte}.`);
        } else {
            alert('Veuillez sélectionner un produit et entrer une quantité valide.');
        }
    });

    formAdminUser.addEventListener('submit', e => {
        e.preventDefault();
        const username = document.getElementById('admin-username').value;
        if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            alert("Ce nom d'utilisateur existe déjà.");
            return;
        }
        const newUser = {
            username,
            password: document.getElementById('admin-password').value,
            level: document.getElementById('admin-access-level').value,
        };
        database.ref('users').push(newUser);
        formAdminUser.reset();
    });

    mainContent.addEventListener('click', e => {
        const target = e.target.closest('.action-btn');
        if (!target) return;
        const { id, type } = target.dataset;
        if (target.classList.contains('delete-btn')) handleDelete(id, type);
        if (target.classList.contains('edit-btn')) handleEdit(id, type);
    });

    const handleDelete = (id, type) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cet élément ? Cette action est irréversible.')) return;
        let path;
        let dbList;
        switch(type) {
            case 'achat': path = `achats/${id}`; dbList = db.achats; break;
            case 'vente-stock': path = `ventes/${id}`; dbList = db.ventes; break;
            case 'vente-service': path = `ventes/${id}`; dbList = db.ventes; break;
            case 'depense': path = `depenses/${id}`; break;
            case 'stock': path = `stock/${id}`; break;
            case 'user': path = `users/${id}`; break;
            default: console.error("Unknown delete type:", type); return;
        }
        
        if (type === 'achat' || type === 'vente-stock') {
            const item = dbList.find(i => i.id === id);
            if(item) {
                const stockChange = (type === 'achat') ? -item.quantite : item.quantite;
                updateStock(item.designation, stockChange);
            }
        }
        database.ref(path).remove();
    };

    const handleEdit = (id, type) => {
        let item = null;
        let formHtml = '';
        modalForm.innerHTML = '';
        const contextInputs = `<input type="hidden" id="modal-edit-id" value="${id}"><input type="hidden" id="modal-edit-type" value="${type}">`;
        
        switch(type) {
            case 'achat': item = db.achats.find(i => i.id === id); break;
            case 'stock': item = db.stock.find(i => i.id === id); break;
            case 'vente-stock': case 'vente-service': item = db.ventes.find(i => i.id === id); break;
            case 'depense': item = db.depenses.find(i => i.id === id); break;
            case 'user': item = db.users.find(i => i.id === id); break;
        }
        if (!item) return;
        originalItemForEdit = { ...item };

        switch(type) {
            case 'achat':
                modalTitle.textContent = "Modifier un Achat";
                formHtml = `
                    <div class="form-group"><label>Date</label><input type="date" id="modal-date" value="${item.date}"></div>
                    <div class="form-group"><label>Désignation</label><input type="text" id="modal-designation" value="${item.designation}" disabled></div>
                    <div class="form-group"><label>Quantité</label><input type="number" id="modal-quantite" value="${item.quantite}" min="1"></div>
                    <div class="form-group"><label>Coût d'achat</label><input type="number" id="modal-cout" value="${item.cout}"></div>
                    <div class="form-group"><label>Prix Détail</label><input type="number" id="modal-prixDetail" value="${item.prixDetail}"></div>
                    <div class="form-group"><label>Prix Gros</label><input type="number" id="modal-prixGros" value="${item.prixGros}"></div>`;
                break;
            case 'stock':
                 modalTitle.textContent = "Modifier un Produit en Stock";
                 formHtml = `
                    <div class="form-group" style="width:100%"><label>Désignation</label><input type="text" id="modal-nom" value="${item.nom}" disabled></div>
                    <div class="form-group"><label>Quantité Stock</label><input type="number" id="modal-quantite" value="${item.quantite}" min="0"></div>
                    <div class="form-group"><label>Seuil Alerte</label><input type="number" id="modal-seuil" value="${item.seuilAlerte}" min="0"></div>
                    <div class="form-group"><label>Prix Détail</label><input type="number" id="modal-prixDetail" value="${item.prixVenteDetail}"></div>
                    <div class="form-group"><label>Prix Gros</label><input type="number" id="modal-prixGros" value="${item.prixVenteGros}"></div>`;
                 break;
            case 'vente-stock':
                modalTitle.textContent = "Modifier une Vente de Produit";
                 formHtml = `
                    <div class="form-group"><label>Date</label><input type="date" id="modal-date" value="${item.date}"></div>
                    <div class="form-group"><label>Désignation</label><input type="text" id="modal-designation" value="${item.designation}" disabled></div>
                    <div class="form-group"><label>Quantité</label><input type="number" id="modal-quantite" value="${item.quantite}" min="1"></div>
                    <div class="form-group"><label>Prix Unitaire</label><input type="number" id="modal-prix" value="${item.prixUnitaire}"></div>`;
                break;
            case 'vente-service':
                modalTitle.textContent = "Modifier une Vente de Service";
                 formHtml = `
                    <div class="form-group"><label>Date</label><input type="date" id="modal-date" value="${item.date}"></div>
                    <div class="form-group" style="flex-grow:2;"><label>Désignation</label><input type="text" id="modal-designation" value="${item.designation}"></div>
                    <div class="form-group"><label>Quantité</label><input type="number" id="modal-quantite" value="${item.quantite}" min="1"></div>
                    <div class="form-group"><label>Prix Global</label><input type="number" id="modal-total" value="${item.total}"></div>`;
                break;
             case 'depense':
                modalTitle.textContent = "Modifier une Dépense";
                 formHtml = `
                    <div class="form-group"><label>Date</label><input type="date" id="modal-date" value="${item.date}"></div>
                    <div class="form-group" style="flex-grow:2;"><label>Motif</label><input type="text" id="modal-motif" value="${item.motif}"></div>
                    <div class="form-group"><label>Montant</label><input type="number" id="modal-montant" value="${item.montant}"></div>`;
                break;
            case 'user':
                modalTitle.textContent = "Modifier l'Utilisateur";
                formHtml = `
                    <div class="form-group"><label for="modal-username">Nom d'utilisateur</label><input type="text" id="modal-username" value="${item.username}" required></div>
                    <div class="form-group"><label for="modal-password">Nouveau mot de passe</label><input type="password" id="modal-password" placeholder="Laisser vide pour ne pas changer"></div>
                    <div class="form-group" style="width: 100%;"><label for="modal-access-level">Niveau d'accès</label><select id="modal-access-level" required>
                            <option value="Admin" ${item.level === 'Admin' ? 'selected' : ''}>Admin</option>
                            <option value="Editeur" ${item.level === 'Editeur' ? 'selected' : ''}>Editeur</option>
                            <option value="Lecteur" ${item.level === 'Lecteur' ? 'selected' : ''}>Lecteur</option></select></div>`;
                break;
            default: return;
        }
        modalForm.innerHTML = contextInputs + formHtml;
        editModal.classList.add('active');
    };

    modalSaveBtn.addEventListener('click', () => {
        const id = document.getElementById('modal-edit-id').value;
        const type = document.getElementById('modal-edit-type').value;
        if (!id || !type) return;
        
        let updates = {};
        let path = '';
        
        switch(type) {
             case 'achat':
                path = 'achats/' + id;
                const newQtyAchat = parseInt(document.getElementById('modal-quantite').value);
                const qtyDiffAchat = newQtyAchat - originalItemForEdit.quantite;
                if(qtyDiffAchat !== 0) updateStock(originalItemForEdit.designation, qtyDiffAchat);
                
                updates = {
                    date: document.getElementById('modal-date').value,
                    quantite: newQtyAchat,
                    cout: parseFloat(document.getElementById('modal-cout').value),
                    prixDetail: parseFloat(document.getElementById('modal-prixDetail').value),
                    prixGros: parseFloat(document.getElementById('modal-prixGros').value),
                };
                break;
            case 'stock':
                path = 'stock/' + id;
                updates = {
                    quantite: parseInt(document.getElementById('modal-quantite').value),
                    seuilAlerte: parseInt(document.getElementById('modal-seuil').value),
                    prixVenteDetail: parseFloat(document.getElementById('modal-prixDetail').value),
                    prixVenteGros: parseFloat(document.getElementById('modal-prixGros').value),
                };
                break;
            case 'vente-stock':
                path = 'ventes/' + id;
                const newQtyVente = parseInt(document.getElementById('modal-quantite').value);
                const prixVente = parseFloat(document.getElementById('modal-prix').value);
                const qtyDiffVente = newQtyVente - originalItemForEdit.quantite;
                if(qtyDiffVente !== 0) updateStock(originalItemForEdit.designation, -qtyDiffVente);
                
                updates = {
                    date: document.getElementById('modal-date').value,
                    quantite: newQtyVente,
                    prixUnitaire: prixVente,
                    total: newQtyVente * prixVente
                };
                break;
            case 'vente-service':
                path = 'ventes/' + id;
                updates = {
                    date: document.getElementById('modal-date').value,
                    designation: document.getElementById('modal-designation').value,
                    quantite: parseInt(document.getElementById('modal-quantite').value),
                    total: parseFloat(document.getElementById('modal-total').value)
                };
                break;
            case 'depense':
                path = 'depenses/' + id;
                updates = {
                    date: document.getElementById('modal-date').value,
                    motif: document.getElementById('modal-motif').value,
                    montant: parseFloat(document.getElementById('modal-montant').value)
                };
                break;
            case 'user':
                path = 'users/' + id;
                const newUsername = document.getElementById('modal-username').value;
                if (newUsername.toLowerCase() !== originalItemForEdit.username.toLowerCase() && db.users.some(u => u.username.toLowerCase() === newUsername.toLowerCase())) {
                    alert("Ce nom d'utilisateur existe déjà."); return;
                }
                updates = {
                    username: newUsername,
                    level: document.getElementById('modal-access-level').value
                };
                const newPassword = document.getElementById('modal-password').value;
                if (newPassword && newPassword.length > 0) {
                    updates.password = newPassword;
                }
                break;
            default: return;
        }
        database.ref(path).update(updates);
        editModal.classList.remove('active');
        originalItemForEdit = null;
    });

    modalCancelBtn.addEventListener('click', () => { editModal.classList.remove('active'); originalItemForEdit = null; });
    
    genererBilanBtn.addEventListener('click', () => {
        const periode = document.getElementById('bilan-periode').value;
        const dateRef = new Date(document.getElementById('bilan-date-specifique').value || new Date());
        let startDate, endDate = new Date(dateRef); endDate.setHours(23, 59, 59, 999);
        switch(periode) {
            case 'jour': startDate = new Date(dateRef); startDate.setHours(0, 0, 0, 0); break;
            case 'semaine':
                startDate = new Date(dateRef);
                const day = startDate.getDay();
                const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
                startDate = new Date(startDate.setDate(diff)); startDate.setHours(0, 0, 0, 0);
                endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 6); endDate.setHours(23, 59, 59, 999);
                break;
            case 'mois': startDate = new Date(dateRef.getFullYear(), dateRef.getMonth(), 1); endDate = new Date(dateRef.getFullYear(), dateRef.getMonth() + 1, 0); endDate.setHours(23, 59, 59, 999); break;
            case 'annee': startDate = new Date(dateRef.getFullYear(), 0, 1); endDate = new Date(dateRef.getFullYear(), 11, 31); endDate.setHours(23, 59, 59, 999); break;
        }
        const ventesFiltrees = db.ventes.filter(v => { const d = new Date(v.date); return d >= startDate && d <= endDate; });
        const depensesFiltrees = db.depenses.filter(d => { const d_ = new Date(d.date); return d_ >= startDate && d_ <= endDate; });
        const totalVentes = ventesFiltrees.reduce((sum, v) => sum + v.total, 0);
        const totalDepenses = depensesFiltrees.reduce((sum, d) => sum + d.montant, 0);
        let coutDesMarchandisesVendues = 0;
        const ventesDeStockFiltrees = ventesFiltrees.filter(v => v.typeVente === 'stock');
        for (const vente of ventesDeStockFiltrees) {
            const dernierAchat = db.achats.filter(a => a.designation === vente.designation).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            if (dernierAchat) { coutDesMarchandisesVendues += vente.quantite * dernierAchat.cout; }
        }
        const margeBrute = totalVentes - coutDesMarchandisesVendues;
        const beneficeNet = margeBrute - totalDepenses;

        const syntheseHtml = `
            <h2>Résultat du Bilan</h2>
            <h4>Période du ${startDate.toLocaleDateString()} au ${endDate.toLocaleDateString()}</h4>
            <p>Chiffre d'affaires total : <strong>${totalVentes.toFixed(0)} FCFA</strong></p>
            <p>Coût des marchandises vendues : <strong>${coutDesMarchandisesVendues.toFixed(0)} FCFA</strong></p>
            <p>Marge brute totale : <strong>${margeBrute.toFixed(0)} FCFA</strong></p>
            <p>Total des dépenses opérationnelles : <strong>${totalDepenses.toFixed(0)} FCFA</strong></p>
            <hr>
            <p><strong>Bénéfice Net : <span style="font-size: 1.5rem; color: ${beneficeNet >= 0 ? 'var(--success-color)' : 'var(--error-color)'};">${beneficeNet.toFixed(0)} FCFA</span></strong></p>`;

        const historiqueVentesHtml = `
            <table class="data-table">
                <thead><tr><th>Date</th><th>Désignation</th><th>Type</th><th>Qté</th><th>Total</th></tr></thead>
                <tbody>${ventesFiltrees.sort((a,b) => new Date(b.date) - new Date(a.date)).map(v => `
                    <tr>
                        <td>${new Date(v.date).toLocaleDateString()}</td>
                        <td>${v.designation}</td>
                        <td>${v.typeVente === 'stock' ? 'Produit' : 'Service'}</td>
                        <td>${v.quantite}</td>
                        <td>${v.total.toFixed(0)} FCFA</td>
                    </tr>`).join('') || '<tr><td colspan="5">Aucune vente pour cette période.</td></tr>'}
                </tbody>
            </table>`;

        const historiqueDepensesHtml = `
            <table class="data-table">
                <thead><tr><th>Date</th><th>Motif</th><th>Montant</th></tr></thead>
                <tbody>${depensesFiltrees.sort((a,b) => new Date(b.date) - new Date(a.date)).map(d => `
                    <tr>
                        <td>${new Date(d.date).toLocaleDateString()}</td>
                        <td>${d.motif}</td>
                        <td>${d.montant.toFixed(0)} FCFA</td>
                    </tr>`).join('') || '<tr><td colspan="3">Aucune dépense pour cette période.</td></tr>'}
                </tbody>
            </table>`;

        document.getElementById('tab-content-bilan-synthese').innerHTML = syntheseHtml;
        document.getElementById('tab-content-bilan-ventes').innerHTML = historiqueVentesHtml;
        document.getElementById('tab-content-bilan-depenses').innerHTML = historiqueDepensesHtml;
    });

    // --- INITIALISATION & FIREBASE LISTENERS ---
    const initFirebaseListeners = () => {
        const nodes = ['achats', 'stock', 'ventes', 'depenses', 'users'];
        let isInitialLoad = true;

        nodes.forEach(node => {
            database.ref(node).on('value', (snapshot) => {
                const data = snapshot.val();
                const list = [];
                if (data) {
                    for (const key in data) {
                        list.push({ id: key, ...data[key] });
                    }
                }
                db[node] = list;
                
                if (isInitialLoad && db.users.length > 0) {
                    isInitialLoad = false;
                    const savedUser = sessionStorage.getItem('currentUser');
                    if (savedUser) {
                        showApp(JSON.parse(savedUser));
                        renderAll();
                    } else {
                        showLogin();
                    }
                } else if (!isInitialLoad) {
                    renderAll();
                }
            });
        });
    };
    
    (() => {
        document.getElementById('achat-date').valueAsDate = new Date();
        document.getElementById('vente-stock-date').valueAsDate = new Date();
        document.getElementById('vente-service-date').valueAsDate = new Date();
        document.getElementById('depense-date').valueAsDate = new Date();
        document.getElementById('bilan-date-specifique').valueAsDate = new Date();
        initFirebaseListeners();
    })();
});