// API Base URL
const API_URL = window.location.origin;

// État de l'utilisateur
let currentUser = null;
let token = localStorage.getItem('token');

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    typeEffect();
    initScrollReveal();
    initScrollTop();
    initShowroom3D();
    checkAuth();

    document.getElementById('loginBtn').addEventListener('click', () => openModal('loginModal'));
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
});

// ==================== AUTHENTIFICATION ====================

async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        alert('Veuillez remplir tous les champs');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (response.ok) {
            token = data.token;
            currentUser = data.user;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(currentUser));
            closeModal('loginModal');
            loadUserProfile();
            alert(`Bienvenue ${currentUser.nom} !`);
        } else {
            alert(data.error || 'Erreur de connexion');
        }
    } catch (error) {
        alert('Erreur réseau');
    }
}

async function register() {
    const nom = document.getElementById('regNom').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const telephone = document.getElementById('regTelephone').value;
    const entreprise = document.getElementById('regEntreprise').value;

    if (!nom || !email || !password) {
        alert('Veuillez remplir tous les champs obligatoires');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nom, email, password, telephone, entreprise })
        });

        const data = await response.json();
        if (response.ok) {
            token = data.token;
            currentUser = data.user;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(currentUser));
            closeModal('loginModal');
            loadUserProfile();
            alert('Inscription réussie !');
        } else {
            alert(data.error || data.errors?.[0]?.msg || 'Erreur');
        }
    } catch (error) {
        alert('Erreur réseau');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    token = null;
    currentUser = null;
    closeModal('profileModal');
    alert('Déconnecté');
}

function checkAuth() {
    const savedUser = localStorage.getItem('user');
    if (savedUser && token) {
        currentUser = JSON.parse(savedUser);
        loadUserProfile();
    }
}

async function loadUserProfile() {
    if (!currentUser) return;

    document.getElementById('userName').innerHTML = currentUser.nom;

    try {
        // Charger les devis
        const quotesResp = await fetch(`${API_URL}/api/quotes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (quotesResp.ok) {
            const quotesData = await quotesResp.json();
            document.getElementById('userQuotesCount').innerText = quotesData.quotes?.length || 0;
            const quotesHtml = quotesData.quotes?.map(q => `
                <div class="bg-brand-border/30 p-3 rounded-xl">
                    <div class="flex justify-between"><span class="font-bold">${q.service_type}</span><span class="text-brand-blue">${q.montant_ht.toLocaleString()} € HT</span></div>
                    <div class="text-sm text-brand-muted">Durée: ${q.duree_mois} mois | Statut: ${q.status}</div>
                </div>
            `).join('') || '<p class="text-brand-muted">Aucun devis</p>';
            document.getElementById('userQuotesList').innerHTML = quotesHtml;
        }
    } catch (error) {
        console.error('Erreur chargement profil:', error);
    }

    openModal('profileModal');
}

// ==================== GENERATEUR DE DEVIS ====================

async function genererDevis() {
    const service = document.getElementById('devisService').value;
    const duree = parseInt(document.getElementById('devisDuree').value);
    const quantite = parseInt(document.getElementById('devisQuantite').value) || 1;
    const email = document.getElementById('devisEmail').value;

    if (!email) {
        alert('Veuillez renseigner votre email');
        return;
    }

    let basePrice = { outsourcing: 3500, formation: 2500, conseil: 5000 }[service] || 3000;
    let total = basePrice * duree * quantite;
    if (duree >= 6) total *= 0.9;
    if (duree >= 12) total *= 0.85;

    const montant = Math.round(total);

    const resultDiv = document.getElementById('devisResult');
    resultDiv.innerHTML = `<div class="text-center"><div class="text-3xl font-bold text-brand-blue">${montant.toLocaleString()} € HT</div>
        <div class="text-sm text-brand-muted mt-1">Service: ${service} | Durée: ${duree} mois | ${quantite} expert(s)</div>
        <button onclick="envoyerDevis('${email}', '${service}', ${duree}, ${quantite}, ${montant})" class="mt-3 bg-brand-blue text-white px-4 py-2 rounded-lg">📧 Envoyer ce devis</button></div>`;
    resultDiv.classList.remove('hidden');
}

async function envoyerDevis(email, service, duree, quantite, montant) {
    try {
        const response = await fetch(`${API_URL}/api/quotes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser?.id || null,
                client_email: email,
                client_nom: currentUser?.nom || null,
                service_type: service,
                duree_mois: duree,
                quantite: quantite,
                montant_ht: montant
            })
        });

        if (response.ok) {
            alert(`✅ Devis envoyé à ${email}\nMontant: ${montant.toLocaleString()} € HT\nUn expert vous contactera sous 24h.`);
        } else {
            alert('Erreur lors de l\'envoi');
        }
    } catch (error) {
        alert('Erreur réseau');
    }
}

// ==================== CONTACT & NEWSLETTER ====================

async function envoyerContact() {
    const nom = document.getElementById('contactNom').value;
    const email = document.getElementById('contactEmail').value;
    const telephone = document.getElementById('contactTelephone').value;
    const entreprise = document.getElementById('contactEntreprise').value;
    const message = document.getElementById('contactMessage').value;

    if (!nom || !email || !message) {
        alert('Veuillez remplir le nom, email et message');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser?.id || null,
                nom, email, telephone, entreprise, message
            })
        });

        if (response.ok) {
            alert('✅ Message envoyé ! Notre équipe vous répondra rapidement.');
            document.getElementById('contactNom').value = '';
            document.getElementById('contactEmail').value = '';
            document.getElementById('contactTelephone').value = '';
            document.getElementById('contactEntreprise').value = '';
            document.getElementById('contactMessage').value = '';
        } else {
            alert('Erreur lors de l\'envoi');
        }
    } catch (error) {
        alert('Erreur réseau');
    }
}

async function inscrireNewsletter() {
    const email = document.getElementById('newsletterEmail').value;
    if (!email) {
        alert('Veuillez renseigner votre email');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/newsletter`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (response.ok) {
            alert('✅ Inscription newsletter réussie !');
            document.getElementById('newsletterEmail').value = '';
        } else {
            alert('Erreur');
        }
    } catch (error) {
        alert('Erreur réseau');
    }
}

// ==================== UI UTILITIES ====================

function openModal(id) {
    document.getElementById(id).classList.add('show');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('show');
}

function showRegister() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
}

function showLogin() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
}

// Theme
function initTheme() {
    const saved = localStorage.getItem('theme');
    const html = document.documentElement;
    const body = document.body;
    const icon = document.getElementById('themeIcon');
    if (saved === 'light') {
        html.classList.remove('dark');
        body.classList.add('light-mode');
        if (icon) icon.className = 'fas fa-sun text-yellow-400';
    } else {
        html.classList.add('dark');
        body.classList.remove('light-mode');
        if (icon) icon.className = 'fas fa-moon text-brand-blue';
    }
}

function toggleTheme() {
    const html = document.documentElement;
    const body = document.body;
    const icon = document.getElementById('themeIcon');
    const isDark = html.classList.contains('dark');
    if (isDark) {
        html.classList.remove('dark');
        body.classList.add('light-mode');
        localStorage.setItem('theme', 'light');
        if (icon) icon.className = 'fas fa-sun text-yellow-400';
    } else {
        html.classList.add('dark');
        body.classList.remove('light-mode');
        localStorage.setItem('theme', 'dark');
        if (icon) icon.className = 'fas fa-moon text-brand-blue';
    }
}

// Typing animation
const phrases = ["Solutions IA, Outsourcing et Formation IT.", "Showroom 3D interactif.", "Devis instantané en 30 secondes."];
let iPhrase = 0, jChar = 0, isDeleting = false;

function typeEffect() {
    const el = document.getElementById('hero-subtitle-typed');
    if (!el) return;
    const current = phrases[iPhrase];
    if (isDeleting) {
        jChar--;
        el.innerHTML = current.substring(0, jChar);
    } else {
        jChar++;
        el.innerHTML = current.substring(0, jChar);
    }
    let speed = isDeleting ? 30 : 65;
    if (!isDeleting && jChar === current.length) {
        speed = 2000;
        isDeleting = true;
    } else if (isDeleting && jChar === 0) {
        isDeleting = false;
        iPhrase = (iPhrase + 1) % phrases.length;
        speed = 400;
    }
    setTimeout(typeEffect, speed);
}

// Scroll Reveal
function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.15 });
    document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
}

// Scroll Top
function initScrollTop() {
    const btn = document.getElementById('scrollTopBtn');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) btn.classList.add('show');
        else btn.classList.remove('show');
    });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// Showroom 3D
function initShowroom3D() {
    const canvas = document.getElementById('vr-canvas');
    if (!canvas) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050810);

    const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.set(4, 3, 7);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    const light = new THREE.AmbientLight(0x404060);
    scene.add(light);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(2, 5, 3);
    scene.add(dirLight);

    // Sol
    const grid = new THREE.GridHelper(10, 20, 0x3b82f6, 0x2a3143);
    grid.position.y = -0.5;
    scene.add(grid);

    // Centre
    const coreGeo = new THREE.IcosahedronGeometry(0.8, 1);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1e3a8a });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // Anneaux
    const ringGeo = new THREE.TorusGeometry(1.2, 0.05, 64, 200);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    scene.add(ring);

    // Particules
    const particlesGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(800 * 3);
    for (let i = 0; i < 800; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 12;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(particlesGeo, new THREE.PointsMaterial({ color: 0x8b5cf6, size: 0.05 }));
    scene.add(particles);

    let autoRotate = true;
    function animate() {
        requestAnimationFrame(animate);
        if (autoRotate) {
            core.rotation.y += 0.008;
            ring.rotation.z += 0.01;
            ring.rotation.x += 0.005;
            particles.rotation.y += 0.002;
        }
        renderer.render(scene, camera);
    }
    animate();

    let isDragging = false;
    let lastX = 0;
    canvas.addEventListener('mousedown', (e) => { isDragging = true; lastX = e.clientX; autoRotate = false; });
    window.addEventListener('mouseup', () => { isDragging = false; });
    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const delta = (e.clientX - lastX) * 0.01;
            camera.position.x += delta;
            camera.lookAt(0, 0, 0);
            lastX = e.clientX;
        }
    });

    document.getElementById('reset-view')?.addEventListener('click', () => {
        camera.position.set(4, 3, 7);
        camera.lookAt(0, 0, 0);
        autoRotate = false;
    });
    document.getElementById('auto-spin')?.addEventListener('click', (e) => {
        autoRotate = !autoRotate;
        e.target.querySelector('i').className = autoRotate ? 'fas fa-pause' : 'fas fa-play';
    });

    window.addEventListener('resize', () => {
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    });
}