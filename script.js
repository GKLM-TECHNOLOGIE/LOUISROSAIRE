document.addEventListener('DOMContentLoaded', () => {
    // --- ÉLÉMENTS DU DOM ---
    const mainContent = document.querySelector('.content');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // Formulaires
    const formAchat = document.getElementById('form-achat');
    const formVenteStock = document.getElementById('form-vente-stock');
    const formVenteService = document.getElementById('form-vente-service');
    const formDepense = document.getElementById('form-depense');
    const formAjustementStock = document.getElementById('form-stock-ajustement');
    const genererBilanBtn = document.getElementById('generer-bilan');

    // Listes (tbody)
    const achatsList = document.getElementById('achats-list');
    const stockList = document.getElementById('stock-list');
    const etatsStockList = document.getElementById('etats-stock-list');
    const ventesStockList = document.getElementById('ventes-stock-list');
    const ventesServiceList = document.getElementById('ventes-service-list');
    const depensesList = document.getElementById('depenses-list');
    
    // Champs spécifiques
    const venteStockProduitSelect = document.getElementById('vente-stock-produit');
    const venteTypePrixSelect = document.getElementById('vente-type-prix');
    const venteStockPrixInput = document.getElementById('vente-stock-prix');
    const ajustProduitSelect = document.getElementById('ajust-produit');
    
    // Modal
    const editModal = document.getElementById('edit-modal');
    const modalForm = document.getElementById('modal-form');
    const modalTitle = document.getElementById('modal-title');

    let caChartInstance = null;

    // --- BASE DE DONNÉES (LocalStorage) ---
    let db = {
        achats: JSON.parse(localStorage.getItem('achats')) || [],
        stock: JSON.parse(localStorage.getItem('stock')) || [],
        ventes: JSON.parse(localStorage.getItem('ventes')) || [],
        depenses: JSON.parse(localStorage.getItem('depenses')) || []
    };
    const saveData = () => Object.keys(db).forEach(key => localStorage.setItem(key, JSON.stringify(db[key])));

    // --- MISE À JOUR DU STOCK ---
    function updateStock(produitNom, quantite, info = {}) {
        let produit = db.stock.find(p => p.nom.toLowerCase() === produitNom.toLowerCase());
        if (produit) {
            produit.quantite += quantite;
            if (info.prixDetail != null) produit.prixVenteDetail = info.prixDetail;
            if (info.prixGros != null) produit.prixVenteGros = info.prixGros;
        } else if (quantite > 0) {
            const seuil = prompt(`Nouveau produit "${produitNom}". Définir un seuil d'alerte :`, 10);
            db.stock.push({
                id: Date.now(), nom: produitNom, quantite: quantite,
                seuilAlerte: parseInt(seuil) || 5,
                prixVenteDetail: info.prixDetail || 0, prixVenteGros: info.prixGros || 0,
            });
        }
    }

    // --- FONCTIONS DE RENDU (AFFICHAGE) ---
    const renderAll = () => {
        renderAchats(); renderStock(); renderEtatsStock();
        renderVentesStock(); renderVentesService(); renderDepenses();
        renderDashboard(); updateSelects();
    };

    const createActionsCell = (item, type) => `
        <td class="actions-cell">
            <button class="action-btn edit-btn" data-id="${item.id}" data-type="${type}" title="Modifier">✏️</button>
            <button class="action-btn delete-btn" data-id="${item.id}" data-type="${type}" title="Supprimer">🗑️</button>
        </td>`;

    const renderAchats = () => {
        achatsList.innerHTML = db.achats.sort((a,b) => b.id - a.id).map(achat => `
            <tr>
                <td>${new Date(achat.date).toLocaleDateString()}</td>
                <td>${achat.designation}</td>
                <td>${achat.quantite}</td>
                <td>${achat.cout.toFixed(0)} FCFA</td>
                <td>${(achat.quantite * achat.cout).toFixed(0)} FCFA</td>
                ${createActionsCell(achat, 'achat')}
            </tr>`).join('');
    };
    
    const renderStock = () => {
        stockList.innerHTML = db.stock.sort((a,b) => a.nom.localeCompare(b.nom)).map(p => {
            const enAlerte = p.quantite <= p.seuilAlerte;
            return `<tr>
                <td>${p.nom}</td>
                <td class="${enAlerte ? 'stock-alerte' : 'stock-ok'}">${p.quantite}</td>
                <td>${p.seuilAlerte}</td>
                <td>${p.prixVenteDetail.toFixed(0)} FCFA</td>
                <td>${p.prixVenteGros.toFixed(0)} FCFA</td>
                <td><span class="${enAlerte ? 'stock-alerte' : 'stock-ok'}">${enAlerte ? 'Stock Faible' : 'OK'}</span></td>
                ${createActionsCell(p, 'stock')}
            </tr>`;
        }).join('');
    };

    const renderEtatsStock = () => {
        etatsStockList.innerHTML = db.stock.sort((a,b) => a.nom.localeCompare(b.nom)).map(produit => {
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
        ventesStockList.innerHTML = db.ventes.filter(v => v.typeVente === 'stock').sort((a,b) => b.id - a.id).map(v => `
            <tr>
                <td>${new Date(v.date).toLocaleDateString()}</td>
                <td>${v.designation}</td>
                <td>${v.quantite}</td>
                <td>${v.prixUnitaire.toFixed(0)} FCFA</td>
                <td>${v.total.toFixed(0)} FCFA</td>
                ${createActionsCell(v, 'vente-stock')}
            </tr>`).join('');
    };

    const renderVentesService = () => {
        ventesServiceList.innerHTML = db.ventes.filter(v => v.typeVente === 'service').sort((a,b) => b.id - a.id).map(v => `
            <tr>
                <td>${new Date(v.date).toLocaleDateString()}</td>
                <td>${v.designation}</td>
                <td>${v.quantite}</td>
                <td>${v.total.toFixed(0)} FCFA</td>
                ${createActionsCell(v, 'vente-service')}
            </tr>`).join('');
    };
    
    const renderDepenses = () => {
        depensesList.innerHTML = db.depenses.sort((a,b) => b.id - a.id).map(d => `
            <tr>
                <td>${new Date(d.date).toLocaleDateString()}</td>
                <td>${d.motif}</td>
                <td>${d.montant.toFixed(0)} FCFA</td>
                ${createActionsCell(d, 'depense')}
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
        const stockOptions = db.stock.map(p => `<option value="${p.nom}">${p.nom} (Stock: ${p.quantite})</option>`).join('');
        venteStockProduitSelect.innerHTML = `<option value="">-- Sélectionner --</option>${stockOptions}`;
        ajustProduitSelect.innerHTML = `<option value="">-- Sélectionner --</option>${db.stock.map(p => `<option value="${p.nom}">${p.nom}</option>`).join('')}`;
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
            if (pageId === 'dashboard' || pageId === 'stock') {
                renderAll();
            }
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
            id: Date.now(),
            date: document.getElementById('achat-date').value, designation, quantite,
            cout: parseFloat(document.getElementById('achat-cout').value),
            prixDetail: parseFloat(document.getElementById('achat-prix-detail').value),
            prixGros: parseFloat(document.getElementById('achat-prix-gros').value),
        };
        db.achats.push(nouvelAchat);
        updateStock(designation, quantite, { prixDetail: nouvelAchat.prixDetail, prixGros: nouvelAchat.prixGros });
        saveData(); renderAll(); formAchat.reset();
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
        db.ventes.push({
            id: Date.now(), date: document.getElementById('vente-stock-date').value,
            typeVente: 'stock', designation: nomProduit, quantite: quantiteVendue, prixUnitaire,
            total: quantiteVendue * prixUnitaire
        });
        updateStock(nomProduit, -quantiteVendue);
        saveData(); renderAll(); formVenteStock.reset();
    });

    formVenteService.addEventListener('submit', e => { e.preventDefault(); db.ventes.push({ id: Date.now(), date: document.getElementById('vente-service-date').value, typeVente: 'service', designation: document.getElementById('vente-service-designation').value, quantite: parseInt(document.getElementById('vente-service-quantite').value), total: parseFloat(document.getElementById('vente-service-prix-global').value) }); saveData(); renderAll(); formVenteService.reset(); });
    formDepense.addEventListener('submit', e => { e.preventDefault(); db.depenses.push({ id: Date.now(), date: document.getElementById('depense-date').value, motif: document.getElementById('depense-motif').value, montant: parseFloat(document.getElementById('depense-montant').value) }); saveData(); renderAll(); formDepense.reset(); });
    
    formAjustementStock.addEventListener('submit', e => {
        e.preventDefault();
        const nomProduit = ajustProduitSelect.value;
        const nouvelleQte = parseInt(document.getElementById('ajust-quantite').value);
        const produit = db.stock.find(p => p.nom === nomProduit);
        if (produit && !isNaN(nouvelleQte)) {
            produit.quantite = nouvelleQte;
            saveData(); renderAll(); formAjustementStock.reset();
            alert(`Stock de "${nomProduit}" ajusté à ${nouvelleQte}.`);
        } else {
            alert('Veuillez sélectionner un produit et entrer une quantité valide.');
        }
    });

    mainContent.addEventListener('click', e => {
        const target = e.target.closest('.action-btn');
        if (!target) return;
        const { id, type } = target.dataset;
        if (target.classList.contains('delete-btn')) handleDelete(parseInt(id), type);
        if (target.classList.contains('edit-btn')) handleEdit(parseInt(id), type);
    });

    const handleDelete = (id, type) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cet élément ? Cette action est irréversible.')) return;
        let item, idx;
        switch(type) {
            case 'achat':
                idx = db.achats.findIndex(i => i.id === id);
                if (idx > -1) { item = db.achats[idx]; updateStock(item.designation, -item.quantite); db.achats.splice(idx, 1); }
                break;
            case 'vente-stock':
                idx = db.ventes.findIndex(i => i.id === id);
                if (idx > -1) { item = db.ventes[idx]; updateStock(item.designation, item.quantite); db.ventes.splice(idx, 1); }
                break;
            case 'vente-service': db.ventes = db.ventes.filter(i => i.id !== id); break;
            case 'depense': db.depenses = db.depenses.filter(i => i.id !== id); break;
            case 'stock': db.stock = db.stock.filter(i => i.id !== id); break;
        }
        saveData(); renderAll();
    };

    const handleEdit = (id, type) => { /* La logique de la modale est complexe, nous la simplifions pour le moment. */ };
    
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
            if (dernierAchat) {
                coutDesMarchandisesVendues += vente.quantite * dernierAchat.cout;
            }
        }
        
        const margeBrute = totalVentes - coutDesMarchandisesVendues;
        const beneficeNet = margeBrute - totalDepenses;
        
        document.getElementById('bilan-resultat').innerHTML = `
            <h2>Résultat du Bilan</h2>
            <h4>Période du ${startDate.toLocaleDateString()} au ${endDate.toLocaleDateString()}</h4>
            <p>Chiffre d'affaires total : <strong>${totalVentes.toFixed(0)} FCFA</strong></p>
            <p>Coût des marchandises vendues : <strong>${coutDesMarchandisesVendues.toFixed(0)} FCFA</strong></p>
            <p>Marge brute totale : <strong>${margeBrute.toFixed(0)} FCFA</strong></p>
            <p>Total des dépenses opérationnelles : <strong>${totalDepenses.toFixed(0)} FCFA</strong></p>
            <hr>
            <p><strong>Bénéfice Net : <span style="font-size: 1.5rem; color: ${beneficeNet >= 0 ? 'var(--success-color)' : 'var(--error-color)'};">${beneficeNet.toFixed(0)} FCFA</span></strong></p>
        `;
    });

    // --- INITIALISATION ---
    (() => {
        document.getElementById('bilan-date-specifique').valueAsDate = new Date();
        renderAll();
    })();
});