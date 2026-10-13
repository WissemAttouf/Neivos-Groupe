const API_URL = window.location.origin;
let currentAdmin = null;
let token = localStorage.getItem('adminToken');
let currentReplyId = null;

// Vérification authentification admin
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    if (!token) {
        const email = prompt('Email administrateur:');
        const password = prompt('Mot de passe:');
        if (email && password) await adminLogin(email, password);
        else window.location.href = '/';
    } else {
        await loadAdminData();
    }
});

async function adminLogin(email, password) {
    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (response.ok && data.user.role === 'admin') {
            token = data.token;
            currentAdmin = data.user;
            localStorage.setItem('adminToken', token);
            document.getElementById('adminName').innerText = currentAdmin.nom;
            await loadAdminData();
        } else {
            alert('Accès non autorisé');
            window.location.href = '/';
        }
    } catch (error) {
        alert('Erreur de connexion');
    }
}

async function loadAdminData() {
    await loadStats();
    await loadContacts();
    await loadQuotes();
    await loadAppointments();
    await loadUsers();
    await loadCharts();
}

async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/api/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            document.getElementById('statUsers').innerText = data.stats.total_users || 0;
            document.getElementById('statContacts').innerText = data.stats.pending_contacts || 0;
            document.getElementById('statQuotes').innerText = data.stats.total_quotes || 0;
            document.getElementById('statAppointments').innerText = data.stats.pending_appointments || 0;
        }
    } catch (error) { console.error(error); }
}

async function loadContacts() {
    try {
        const response = await fetch(`${API_URL}/api/admin/contacts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            const tbody = document.getElementById('contactsList');
            tbody.innerHTML = data.contacts.map(c => `
                <tr class="border-b border-brand-border">
                    <td class="p-2">${new Date(c.created_at).toLocaleDateString()}</td>
                    <td class="p-2">${c.nom}</td>
                    <td class="p-2">${c.email}</td>
                    <td class="p-2 max-w-xs truncate">${c.message.substring(0, 50)}...</td>
                    <td class="p-2"><span class="px-2 py-1 rounded-full text-xs ${c.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : c.status === 'read' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}">${c.status}</span></td>
                    <td class="p-2"><button onclick="openReplyModal(${c.id})" class="text-brand-blue"><i class="fas fa-reply"></i></button></td>
                </tr>
            `).join('');
        }
    } catch (error) { console.error(error); }
}

async function loadQuotes() {
    try {
        const response = await fetch(`${API_URL}/api/admin/quotes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            const tbody = document.getElementById('quotesList');
            tbody.innerHTML = data.quotes.map(q => `
                <tr class="border-b border-brand-border">
                    <td class="p-2">${new Date(q.created_at).toLocaleDateString()}</td>
                    <td class="p-2">${q.client_nom || q.client_email}</td>
                    <td class="p-2">${q.service_type}</td>
                    <td class="p-2">${q.duree_mois} mois</td>
                    <td class="p-2 text-brand-blue">${parseInt(q.montant_ht).toLocaleString()} €</td>
                    <td class="p-2">${q.status}</td>
                </tr>
            `).join('');
        }
    } catch (error) { console.error(error); }
}

async function loadAppointments() {
    try {
        const response = await fetch(`${API_URL}/api/admin/appointments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            const tbody = document.getElementById('appointmentsList');
            tbody.innerHTML = data.appointments.map(a => `
                <tr class="border-b border-brand-border">
                    <td class="p-2">${new Date(a.date_heure).toLocaleString()}</td>
                    <td class="p-2">${a.nom}</td>
                    <td class="p-2">${a.email}</td>
                    <td class="p-2">${a.telephone || '-'}</td>
                    <td class="p-2">${a.sujet || '-'}</td>
                    <td class="p-2">${a.status}</td>
                </tr>
            `).join('');
        }
    } catch (error) { console.error(error); }
}

async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            const tbody = document.getElementById('usersList');
            tbody.innerHTML = data.users.map(u => `
                <tr class="border-b border-brand-border">
                    <td class="p-2">${u.id}</td>
                    <td class="p-2">${u.nom}</td>
                    <td class="p-2">${u.email}</td>
                    <td class="p-2">${u.entreprise || '-'}</td>
                    <td class="p-2">${new Date(u.created_at).toLocaleDateString()}</td>
                    <td class="p-2"><span class="px-2 py-1 rounded-full text-xs ${u.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${u.is_active ? 'Actif' : 'Inactif'}</span></td>
                </tr>
            `).join('');
        }
    } catch (error) { console.error(error); }
}

async function loadCharts() {
    try {
        const response = await fetch(`${API_URL}/api/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            const ctx1 = document.getElementById('monthlyChart')?.getContext('2d');
            const ctx2 = document.getElementById('serviceChart')?.getContext('2d');
            if (ctx1) new Chart(ctx1, { type: 'line', data: { labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'], datasets: [{ label: 'Devis', data: [12, 19, 15, 22, 28, data.stats.total_quotes || 0], borderColor: '#3B82F6' }] } });
            if (ctx2) new Chart(ctx2, { type: 'doughnut', data: { labels: ['Outsourcing', 'Formation', 'Conseil'], datasets: [{ data: [45, 25, 30], backgroundColor: ['#3B82F6', '#8B5CF6', '#06B6D4'] }] } });
        }
    } catch (error) { console.error(error); }
}

function openReplyModal(id) {
    currentReplyId = id;
    document.getElementById('replyModal').classList.remove('hidden');
}

function closeReplyModal() {
    document.getElementById('replyModal').classList.add('hidden');
    currentReplyId = null;
}

async function submitReply() {
    const note = document.getElementById('replyNote').value;
    const status = document.getElementById('replyStatus').value;
    try {
        await fetch(`${API_URL}/api/admin/contacts/${currentReplyId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status, admin_note: note })
        });
        alert('Mise à jour effectuée');
        closeReplyModal();
        loadContacts();
    } catch (error) { alert('Erreur'); }
}

function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

function logout() {
    localStorage.removeItem('adminToken');
    window.location.href = '/';
}

function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
        document.documentElement.classList.remove('dark');
        document.body.classList.add('light-mode');
    }
}
