const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Pool MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

// ==================== DISCORD BOT INTEGRATION ====================
let sendDiscordNotification = null;
try {
    const discordBot = require('./discord-bot');
    sendDiscordNotification = discordBot.sendDiscordNotification;
    console.log('✅ Module Discord chargé avec succès');
} catch (error) {
    console.log('⚠️ Module Discord non disponible:', error.message);
    console.log('   Le bot Discord ne sera pas actif');
}

// ==================== FONCTION ENVOI WEBHOOK DISCORD ====================
async function sendToWebhook(type, data, userInfo = null) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    let embed = {};
    const timestamp = new Date().toISOString();

    if (type === 'register') {
        embed = {
            title: '🆕 Nouvelle inscription',
            color: 0x10B981,
            fields: [
                { name: '👤 Nom', value: data.nom, inline: true },
                { name: '📧 Email', value: data.email, inline: true },
                { name: '📞 Téléphone', value: data.telephone || 'Non renseigné', inline: true },
                { name: '🏢 Entreprise', value: data.entreprise || 'Non renseignée', inline: true }
            ],
            footer: { text: 'NEIVOS GROUPE - Inscription' },
            timestamp: timestamp
        };
    } else if (type === 'login') {
        embed = {
            title: '🔐 Connexion utilisateur',
            color: 0x3B82F6,
            fields: [
                { name: '👤 Nom', value: data.nom, inline: true },
                { name: '📧 Email', value: data.email, inline: true }
            ],
            footer: { text: 'NEIVOS GROUPE - Connexion' },
            timestamp: timestamp
        };
    } else if (type === 'message') {
        embed = {
            title: '💬 Nouveau message client',
            color: 0x8B5CF6,
            fields: [
                { name: '👤 Client', value: userInfo?.nom || 'Inconnu', inline: true },
                { name: '📧 Email', value: userInfo?.email || 'Non renseigné', inline: true },
                { name: '🆔 ID Client', value: userInfo?.id?.toString() || 'Non connecté', inline: true },
                { name: '💬 Message', value: data.message.length > 500 ? data.message.substring(0, 500) + '...' : data.message },
                { name: '🕐 Date', value: new Date().toLocaleString('fr-FR'), inline: true }
            ],
            footer: { text: 'NEIVOS GROUPE - Support Client • Pour répondre: /reply [ID] [message]' },
            timestamp: timestamp
        };
    } else if (type === 'contact') {
        embed = {
            title: '📩 Nouvelle demande de contact',
            color: 0xF59E0B,
            fields: [
                { name: '👤 Nom', value: data.nom, inline: true },
                { name: '📧 Email', value: data.email, inline: true },
                { name: '📞 Téléphone', value: data.telephone || 'Non renseigné', inline: true },
                { name: '🏢 Entreprise', value: data.entreprise || 'Non renseignée', inline: true },
                { name: '💬 Message', value: data.message.length > 500 ? data.message.substring(0, 500) + '...' : data.message }
            ],
            footer: { text: 'NEIVOS GROUPE - Formulaire Contact' },
            timestamp: timestamp
        };
    } else if (type === 'quote') {
        embed = {
            title: '📄 Nouveau devis généré',
            color: 0x10B981,
            fields: [
                { name: '👤 Client', value: data.client_nom || 'Inconnu', inline: true },
                { name: '📧 Email', value: data.client_email, inline: true },
                { name: '🛠️ Service', value: data.service_type, inline: true },
                { name: '⏱️ Durée', value: `${data.duree_mois} mois`, inline: true },
                { name: '💰 Montant', value: `${data.montant_ht.toLocaleString()} € HT`, inline: true }
            ],
            footer: { text: 'NEIVOS GROUPE - Demande de devis' },
            timestamp: timestamp
        };
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });
        if (response.ok) console.log(`✅ Webhook Discord envoyé pour ${type}`);
        else console.error(`❌ Erreur webhook: ${response.status}`);
    } catch (error) {
        console.error('❌ Erreur envoi webhook:', error.message);
    }
}

// ==================== MIDDLEWARE AUTH ====================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Accès non autorisé' });
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token invalide' });
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    next();
};
// ==================== GESTION DES TECHNOLOGIES (CRUD) ====================
// Récupérer toutes les technologies (publique)
app.get('/api/technologies', async (req, res) => {
    try {
        const [technologies] = await pool.query('SELECT * FROM technologies WHERE is_active = TRUE ORDER BY id ASC');
        res.json({ technologies });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin: Ajouter une technologie
app.post('/api/admin/technologies', authenticateToken, isAdmin, async (req, res) => {
    const { title, icon, description, details } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'Titre et description requis' });
    try {
        const [result] = await pool.query(
            'INSERT INTO technologies (title, icon, description, details) VALUES (?, ?, ?, ?)',
            [title, icon || 'fas fa-microchip', description, details || null]
        );
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin: Modifier une technologie
app.put('/api/admin/technologies/:id', authenticateToken, isAdmin, async (req, res) => {
    const { title, icon, description, details } = req.body;
    try {
        await pool.query(
            'UPDATE technologies SET title = ?, icon = ?, description = ?, details = ? WHERE id = ?',
            [title, icon, description, details, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin: Supprimer une technologie
app.delete('/api/admin/technologies/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM technologies WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== GESTION DES SERVICES (CRUD) ====================
// Récupérer tous les services (publique)
app.get('/api/services', async (req, res) => {
    try {
        const [services] = await pool.query('SELECT * FROM services WHERE is_active = TRUE ORDER BY id ASC');
        res.json({ services });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin: Ajouter un service
app.post('/api/admin/services', authenticateToken, isAdmin, async (req, res) => {
    const { title, icon, description, details, price } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'Titre et description requis' });
    try {
        const [result] = await pool.query(
            'INSERT INTO services (title, icon, description, details, price) VALUES (?, ?, ?, ?, ?)',
            [title, icon || 'fas fa-handshake', description, details || null, price || null]
        );
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin: Modifier un service
app.put('/api/admin/services/:id', authenticateToken, isAdmin, async (req, res) => {
    const { title, icon, description, details, price } = req.body;
    try {
        await pool.query(
            'UPDATE services SET title = ?, icon = ?, description = ?, details = ?, price = ? WHERE id = ?',
            [title, icon, description, details, price, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin: Supprimer un service
app.delete('/api/admin/services/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM services WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== INSCRIPTIONS AUX SERVICES ====================
// Client: S'inscrire à un service
app.post('/api/user/subscribe', authenticateToken, async (req, res) => {
    const { service_id, service_name } = req.body;
    const userId = req.user.id;
    try {
        const [existing] = await pool.query(
            'SELECT id FROM service_subscriptions WHERE user_id = ? AND service_id = ? AND status != "rejected"',
            [userId, service_id]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Vous êtes déjà inscrit à ce service' });
        }
        await pool.query(
            'INSERT INTO service_subscriptions (user_id, service_id, service_name, status) VALUES (?, ?, ?, "pending")',
            [userId, service_id, service_name]
        );
        await pool.query(
            'INSERT INTO user_activities (user_id, action, icon) VALUES (?, ?, ?)',
            [userId, `Demande d\'inscription au service: ${service_name}`, 'fas fa-concierge-bell']
        );
        res.json({ success: true, message: `Demande d'inscription envoyée pour ${service_name}` });
    } catch (error) {
        console.error('Erreur inscription service:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin: Récupérer toutes les inscriptions
app.get('/api/admin/subscriptions', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [subscriptions] = await pool.query(`
            SELECT ss.*, u.nom as user_nom, u.email as user_email 
            FROM service_subscriptions ss
            JOIN users u ON ss.user_id = u.id
            ORDER BY ss.created_at DESC
        `);
        res.json({ subscriptions });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin: Mettre à jour le statut d'une inscription
app.put('/api/admin/subscriptions/:id', authenticateToken, isAdmin, async (req, res) => {
    const { status, admin_note } = req.body;
    try {
        await pool.query(
            'UPDATE service_subscriptions SET status = ?, admin_note = ? WHERE id = ?',
            [status, admin_note || null, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== ENVOI DE MESSAGE ADMIN -> CLIENT ====================
app.post('/api/admin/send-message', authenticateToken, isAdmin, async (req, res) => {
    const { user_id, message } = req.body;
    if (!user_id || !message) return res.status(400).json({ error: 'Données incomplètes' });
    try {
        await pool.query(
            'INSERT INTO messages (user_id, sender, message) VALUES (?, "admin", ?)',
            [user_id, message]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin: Récupérer la liste des clients pour envoyer des messages
app.get('/api/admin/clients', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [clients] = await pool.query(`
            SELECT id, nom, email, telephone, entreprise, created_at 
            FROM users WHERE role = 'user' 
            ORDER BY created_at DESC
        `);
        res.json({ clients });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// ==================== PROFIL UTILISATEUR ====================
// Mettre à jour le profil
app.put('/api/user/profile', authenticateToken, async (req, res) => {
    const { nom, telephone, entreprise } = req.body;
    const userId = req.user.id;
    
    try {
        await pool.query(
            'UPDATE users SET nom = ?, telephone = ?, entreprise = ? WHERE id = ?',
            [nom, telephone || null, entreprise || null, userId]
        );
        
        // Mettre à jour les infos dans le token
        const newToken = jwt.sign(
            { id: userId, email: req.user.email, nom: nom, role: req.user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );
        
        res.json({ success: true, token: newToken, user: { id: userId, nom, email: req.user.email, telephone, entreprise, role: req.user.role } });
    } catch (error) {
        console.error('Erreur mise à jour profil:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Supprimer le compte utilisateur
app.delete('/api/user/account', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        // Supprimer les données liées à l'utilisateur
        await pool.query('DELETE FROM messages WHERE user_id = ?', [userId]);
        await pool.query('DELETE FROM ia_proposals WHERE user_id = ?', [userId]);
        await pool.query('DELETE FROM user_activities WHERE user_id = ?', [userId]);
        await pool.query('DELETE FROM quotes WHERE user_id = ?', [userId]);
        await pool.query('DELETE FROM contact_requests WHERE user_id = ?', [userId]);
        await pool.query('DELETE FROM users WHERE id = ?', [userId]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur suppression compte:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== GESTION DES MESSAGES ====================
// Supprimer un message spécifique
app.delete('/api/messages/:id', authenticateToken, async (req, res) => {
    const messageId = req.params.id;
    const userId = req.user.id;
    try {
        await pool.query('DELETE FROM messages WHERE id = ? AND user_id = ?', [messageId, userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur suppression message:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Supprimer tous les messages de l'utilisateur
app.delete('/api/messages/all', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        await pool.query('DELETE FROM messages WHERE user_id = ?', [userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur suppression tous messages:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== INSCRIPTION AUX SERVICES ====================
app.post('/api/user/subscribe', authenticateToken, async (req, res) => {
    const { service } = req.body;
    const userId = req.user.id;
    
    // Récupérer le nom de l'utilisateur
    const [user] = await pool.query('SELECT nom, email FROM users WHERE id = ?', [userId]);
    
    try {
        // Enregistrer la demande d'inscription dans contact_requests
        await pool.query(
            `INSERT INTO contact_requests (user_id, nom, email, message, status) 
             VALUES (?, ?, ?, ?, 'pending')`,
            [userId, user[0].nom, user[0].email, `Demande d'inscription au service: ${service}`]
        );
        
        // Ajouter une activité
        await pool.query(
            'INSERT INTO user_activities (user_id, action, icon) VALUES (?, ?, ?)',
            [userId, `Inscription demandée pour le service: ${service}`, 'fas fa-concierge-bell']
        );
        
        // Notification Discord
        if (process.env.DISCORD_WEBHOOK_URL) {
            await sendToWebhook('service_subscription', { 
                nom: user[0].nom, 
                email: user[0].email, 
                service: service 
            });
        }
        
        res.json({ success: true, message: `Demande d'inscription envoyée pour ${service}` });
    } catch (error) {
        console.error('Erreur inscription service:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== ACTIVITÉS RÉCENTES ====================
app.get('/api/user/activities', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const [activities] = await pool.query(
            'SELECT * FROM user_activities WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
            [userId]
        );
        res.json({ activities });
    } catch (error) {
        console.error('Erreur chargement activités:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== SERVICES SOUSCRITS ====================
app.get('/api/user/subscriptions', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const [subscriptions] = await pool.query(
            `SELECT * FROM contact_requests 
             WHERE user_id = ? AND message LIKE 'Demande d''inscription%' 
             ORDER BY created_at DESC`,
            [userId]
        );
        res.json({ subscriptions });
    } catch (error) {
        console.error('Erreur chargement souscriptions:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// ==================== AUTHENTIFICATION ====================
// Inscription
app.post('/api/auth/register', async (req, res) => {
    const { nom, email, password, telephone, entreprise } = req.body;
    
    if (!nom || !email || !password) {
        return res.status(400).json({ error: 'Nom, email et mot de passe requis' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    try {
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            'INSERT INTO users (nom, email, password, telephone, entreprise, role) VALUES (?, ?, ?, ?, ?, "user")',
            [nom, email, hashedPassword, telephone || null, entreprise || null]
        );

        // Créer des propositions IA par défaut
        const defaultProposals = [
            { title: '💬 Chatbot IA Intelligent', description: 'Automatisez votre support client 24/7 avec notre chatbot IA. Réduction des coûts de 40%.', icon: 'fas fa-robot' },
            { title: '🧠 RAG sur vos documents', description: 'Transformez vos bases documentaires en connaissance actionnable.', icon: 'fas fa-database' },
            { title: '📚 Formation Data Science', description: 'Formation intensive sur les LLMs et le RAG. Certification incluse.', icon: 'fas fa-graduation-cap' }
        ];

        for (const prop of defaultProposals) {
            await pool.query(
                'INSERT INTO ia_proposals (user_id, title, description, icon) VALUES (?, ?, ?, ?)',
                [result.insertId, prop.title, prop.description, prop.icon]
            );
        }

        // Ajouter une activité
        await pool.query(
            'INSERT INTO user_activities (user_id, action, icon) VALUES (?, ?, ?)',
            [result.insertId, 'Inscription sur la plateforme NEIVOS', 'fas fa-user-plus']
        );

        // Notifications Discord
        await sendToWebhook('register', { nom, email, telephone, entreprise });
        if (sendDiscordNotification) {
            await sendDiscordNotification('register', { nom, email, telephone, entreprise });
        }

        const token = jwt.sign(
            { id: result.insertId, email, nom, role: 'user' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        res.status(201).json({
            success: true,
            token,
            user: { id: result.insertId, nom, email, role: 'user' }
        });

    } catch (error) {
        console.error('Erreur inscription:', error);
        res.status(500).json({ error: 'Erreur serveur lors de l\'inscription' });
    }
});

// Connexion
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        if (!user.is_active) {
            return res.status(401).json({ error: 'Votre compte a été désactivé. Contactez l\'administrateur.' });
        }

        await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

        await pool.query(
            'INSERT INTO user_activities (user_id, action, icon) VALUES (?, ?, ?)',
            [user.id, 'Connexion à la plateforme', 'fas fa-sign-in-alt']
        );

        // Notifications Discord
        await sendToWebhook('login', { nom: user.nom, email: user.email });
        if (sendDiscordNotification) {
            await sendDiscordNotification('login', { nom: user.nom, email: user.email });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, nom: user.nom, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                nom: user.nom,
                email: user.email,
                role: user.role,
                entreprise: user.entreprise,
                telephone: user.telephone
            }
        });

    } catch (error) {
        console.error('Erreur connexion:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
    }
});

// Vérifier le token
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, nom, email, role, entreprise, telephone FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Utilisateur non trouvé' });
        }
        res.json({ user: users[0] });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== MESSAGES ====================
app.get('/api/messages', authenticateToken, async (req, res) => {
    try {
        const [messages] = await pool.query(
            'SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC',
            [req.user.id]
        );
        await pool.query(
            'UPDATE messages SET is_read = TRUE WHERE user_id = ? AND sender = "admin"',
            [req.user.id]
        );
        res.json({ messages });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message requis' });
    
    try {
        await pool.query(
            'INSERT INTO messages (user_id, sender, message) VALUES (?, "user", ?)',
            [req.user.id, message]
        );
        
        const [userInfo] = await pool.query('SELECT id, nom, email FROM users WHERE id = ?', [req.user.id]);
        
        // Notifications Discord
        await sendToWebhook('message', { message }, userInfo[0]);
        if (sendDiscordNotification) {
            await sendDiscordNotification('message', {
                userId: userInfo[0].id,
                clientName: userInfo[0].nom,
                clientEmail: userInfo[0].email,
                message: message
            });
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
});

// ==================== RÉPONSE ADMIN (via API) ====================
app.post('/api/admin/messages/reply', authenticateToken, isAdmin, async (req, res) => {
    const { user_id, message } = req.body;
    if (!user_id || !message) return res.status(400).json({ error: 'Données incomplètes' });
    try {
        await pool.query(
            'INSERT INTO messages (user_id, sender, message) VALUES (?, "admin", ?)',
            [user_id, message]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
});

// ==================== PROPOSITIONS IA ====================
app.get('/api/proposals', authenticateToken, async (req, res) => {
    try {
        const [proposals] = await pool.query(
            'SELECT * FROM ia_proposals WHERE user_id = ? ORDER BY id ASC',
            [req.user.id]
        );
        res.json({ proposals });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
});

// ==================== ACTIVITÉS ====================
app.get('/api/activities', authenticateToken, async (req, res) => {
    try {
        const [activities] = await pool.query(
            'SELECT * FROM user_activities WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
            [req.user.id]
        );
        res.json({ activities });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
});

// ==================== DEVIS ====================
app.post('/api/quotes', authenticateToken, async (req, res) => {
    const { client_email, client_nom, service_type, duree_mois, quantite, montant_ht } = req.body;
    try {
        await pool.query(
            `INSERT INTO quotes (user_id, client_email, client_nom, service_type, duree_mois, quantite, montant_ht) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, client_email, client_nom, service_type, duree_mois, quantite, montant_ht]
        );
        
        const [userInfo] = await pool.query('SELECT nom FROM users WHERE id = ?', [req.user.id]);
        await sendToWebhook('quote', {
            client_nom: client_nom || userInfo[0]?.nom,
            client_email: client_email,
            service_type: service_type,
            duree_mois: duree_mois,
            montant_ht: montant_ht
        });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
});

app.get('/api/quotes', authenticateToken, async (req, res) => {
    try {
        const [quotes] = await pool.query(
            'SELECT * FROM quotes WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json({ quotes });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
});

// ==================== CONTACT & NEWSLETTER ====================
// Contact - fonctionne pour clients connectés ET non connectés
// Contact - fonctionne pour clients connectés ET non connectés
app.post('/api/contact', async (req, res) => {
    const { user_id, nom, email, telephone, entreprise, message } = req.body;
    
    // Validation
    if (!nom || !email || !message) {
        return res.status(400).json({ error: 'Nom, email et message sont requis' });
    }
    
    try {
        // Si user_id est fourni, vérifier qu'il existe
        let finalUserId = null;
        if (user_id) {
            const [user] = await pool.query('SELECT id FROM users WHERE id = ?', [user_id]);
            if (user.length > 0) finalUserId = user_id;
        }
        
        const [result] = await pool.query(
            'INSERT INTO contact_requests (user_id, nom, email, telephone, entreprise, message, status) VALUES (?, ?, ?, ?, ?, ?, "pending")',
            [finalUserId, nom, email, telephone || null, entreprise || null, message]
        );
        
        console.log(`✅ Demande contact enregistrée (ID: ${result.insertId}) - De: ${nom} (${email})`);
        
        // Envoyer notification Discord (si configuré)
        if (process.env.DISCORD_WEBHOOK_URL) {
            await sendToWebhook('contact', { nom, email, telephone, entreprise, message });
        }
        
        res.json({ success: true, message: 'Message envoyé avec succès' });
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement du contact:', error);
        res.status(500).json({ error: 'Erreur serveur, veuillez réessayer' });
    }
});

app.post('/api/newsletter', async (req, res) => {
    const { email } = req.body;
    try {
        await pool.query(
            'INSERT INTO newsletter (email) VALUES (?) ON DUPLICATE KEY UPDATE is_active = TRUE',
            [email]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
});

// ==================== ADMIN - GESTION ====================
app.get('/api/admin/messages', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [messages] = await pool.query(`
            SELECT m.*, u.nom as user_nom, u.email as user_email 
            FROM messages m 
            JOIN users u ON m.user_id = u.id 
            ORDER BY m.created_at DESC
            LIMIT 100
        `);
        res.json({ messages });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
});

app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [users] = await pool.query('SELECT COUNT(*) as total FROM users WHERE role = "user"');
        const [pending] = await pool.query('SELECT COUNT(*) as total FROM contact_requests WHERE status = "pending"');
        const [messages] = await pool.query('SELECT COUNT(*) as total FROM messages WHERE is_read = FALSE AND sender = "user"');
        const [quotes] = await pool.query('SELECT COUNT(*) as total FROM quotes');
        res.json({ stats: { total_users: users[0].total, pending_contacts: pending[0].total, unread_messages: messages[0].total, total_quotes: quotes[0].total } });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
});

app.get('/api/admin/contacts', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [contacts] = await pool.query('SELECT * FROM contact_requests ORDER BY created_at DESC');
        res.json({ contacts });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
});

app.put('/api/admin/contacts/:id', authenticateToken, isAdmin, async (req, res) => {
    const { status } = req.body;
    try {
        await pool.query('UPDATE contact_requests SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
});

app.get('/api/admin/quotes', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [quotes] = await pool.query('SELECT * FROM quotes ORDER BY created_at DESC');
        res.json({ quotes });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
});

app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, nom, email, telephone, entreprise, created_at, last_login FROM users WHERE role = "user" ORDER BY created_at DESC');
        res.json({ users });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
});
// ==================== ADMIN - GESTION DES TECHNOLOGIES (CRUD) ====================
// Récupérer toutes les technologies (admin)
app.get('/api/admin/technologies', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [technologies] = await pool.query('SELECT * FROM technologies ORDER BY id ASC');
        res.json({ technologies });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin: Ajouter une technologie
app.post('/api/admin/technologies', authenticateToken, isAdmin, async (req, res) => {
    const { title, icon, description, details } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'Titre et description requis' });
    try {
        const [result] = await pool.query(
            'INSERT INTO technologies (title, icon, description, details) VALUES (?, ?, ?, ?)',
            [title, icon || 'fas fa-microchip', description, details || null]
        );
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin: Modifier une technologie
app.put('/api/admin/technologies/:id', authenticateToken, isAdmin, async (req, res) => {
    const { title, icon, description, details } = req.body;
    try {
        await pool.query(
            'UPDATE technologies SET title = ?, icon = ?, description = ?, details = ? WHERE id = ?',
            [title, icon, description, details, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin: Supprimer une technologie
app.delete('/api/admin/technologies/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM technologies WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== ADMIN - GESTION DES SERVICES (CRUD) ====================
// Récupérer tous les services (admin)
app.get('/api/admin/services', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [services] = await pool.query('SELECT * FROM services ORDER BY id ASC');
        res.json({ services });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin: Ajouter un service
app.post('/api/admin/services', authenticateToken, isAdmin, async (req, res) => {
    const { title, icon, description, details, price } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'Titre et description requis' });
    try {
        const [result] = await pool.query(
            'INSERT INTO services (title, icon, description, details, price) VALUES (?, ?, ?, ?, ?)',
            [title, icon || 'fas fa-handshake', description, details || null, price || null]
        );
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin: Modifier un service
app.put('/api/admin/services/:id', authenticateToken, isAdmin, async (req, res) => {
    const { title, icon, description, details, price } = req.body;
    try {
        await pool.query(
            'UPDATE services SET title = ?, icon = ?, description = ?, details = ?, price = ? WHERE id = ?',
            [title, icon, description, details, price, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin: Supprimer un service
app.delete('/api/admin/services/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM services WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== ADMIN - GESTION DES INSCRIPTIONS AUX SERVICES ====================
// Récupérer toutes les inscriptions
app.get('/api/admin/subscriptions', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [subscriptions] = await pool.query(`
            SELECT ss.*, u.nom as user_nom, u.email as user_email 
            FROM service_subscriptions ss
            JOIN users u ON ss.user_id = u.id
            ORDER BY ss.created_at DESC
        `);
        res.json({ subscriptions });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin: Approuver une inscription
app.put('/api/admin/subscriptions/:id/approve', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE service_subscriptions SET status = "approved" WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin: Rejeter une inscription
app.put('/api/admin/subscriptions/:id/reject', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE service_subscriptions SET status = "rejected" WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== ADMIN - GESTION DES UTILISATEURS (CRUD) ====================
// Admin: Modifier un utilisateur
app.put('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
    const { nom, email, telephone, entreprise, is_active } = req.body;
    try {
        await pool.query(
            'UPDATE users SET nom = ?, email = ?, telephone = ?, entreprise = ?, is_active = ? WHERE id = ?',
            [nom, email, telephone || null, entreprise || null, is_active !== undefined ? is_active : 1, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin: Supprimer un utilisateur
app.delete('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        // Supprimer les données liées
        await pool.query('DELETE FROM messages WHERE user_id = ?', [req.params.id]);
        await pool.query('DELETE FROM quotes WHERE user_id = ?', [req.params.id]);
        await pool.query('DELETE FROM contact_requests WHERE user_id = ?', [req.params.id]);
        await pool.query('DELETE FROM service_subscriptions WHERE user_id = ?', [req.params.id]);
        await pool.query('DELETE FROM user_activities WHERE user_id = ?', [req.params.id]);
        await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== ADMIN - RÉPONSES INSTANTANÉES AUX MESSAGES ====================
// Envoyer une réponse instantanée à un message client
app.post('/api/admin/messages/instant-reply', authenticateToken, isAdmin, async (req, res) => {
    const { user_id, message, message_id } = req.body;
    if (!user_id || !message) return res.status(400).json({ error: 'Données incomplètes' });
    try {
        // Insérer la réponse
        await pool.query(
            'INSERT INTO messages (user_id, sender, message) VALUES (?, "admin", ?)',
            [user_id, message]
        );
        
        // Marquer le message original comme lu
        if (message_id) {
            await pool.query('UPDATE messages SET is_read = TRUE WHERE id = ?', [message_id]);
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== ADMIN - MARQUER MESSAGE COMME LU/NON LU ====================
app.put('/api/admin/messages/:id/toggle-read', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { is_read } = req.body;
    try {
        await pool.query('UPDATE messages SET is_read = ? WHERE id = ?', [is_read, id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== ADMIN - GESTION DES DEMANDES DE CONTACT ====================
// Supprimer une demande de contact
app.delete('/api/admin/contacts/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM contact_requests WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== ADMIN - MARQUER TOUS LES MESSAGES COMME LUS ====================
app.put('/api/admin/messages/mark-all-read', authenticateToken, isAdmin, async (req, res) => {
    try {
        await pool.query('UPDATE messages SET is_read = TRUE WHERE sender = "user"');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== SERVEUR FICHIERS STATIQUES ====================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ==================== MESSAGES ADMIN AVEC STATUT LU/NON LU ====================
// Récupérer tous les messages avec statut de lecture
app.get('/api/admin/messages', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [messages] = await pool.query(`
            SELECT m.*, u.nom as user_nom, u.email as user_email 
            FROM messages m 
            JOIN users u ON m.user_id = u.id 
            ORDER BY 
                CASE WHEN m.is_read = FALSE AND m.sender = 'user' THEN 0 ELSE 1 END,
                m.created_at DESC
        `);
        res.json({ messages });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
});

// Marquer un message comme lu
app.put('/api/admin/messages/:id/read', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE messages SET is_read = TRUE WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
});

// Marquer tous les messages d'un client comme lus
app.put('/api/admin/messages/user/:userId/read-all', authenticateToken, isAdmin, async (req, res) => {
    const { userId } = req.params;
    try {
        await pool.query('UPDATE messages SET is_read = TRUE WHERE user_id = ? AND sender = "user"', [userId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
});

// Compter les messages non lus
app.get('/api/admin/messages/unread-count', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [result] = await pool.query('SELECT COUNT(*) as count FROM messages WHERE is_read = FALSE AND sender = "user"');
        res.json({ unreadCount: result[0].count });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
});

// ==================== DÉMARRAGE ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    ┌─────────────────────────────────────────────────────────────┐
    │  🚀 NEIVOS GROUPE - Serveur démarré                         │
    ├─────────────────────────────────────────────────────────────┤
    │  📍 http://localhost:${PORT}                                 │
    │  📧 Admin: admin@neivos.fr | Mot de passe: Admin@2025       │
    │  👤 User: jean.dupont@email.com | Mot de passe: User@2025   │
    │  🤖 Discord Bot: ${sendDiscordNotification ? 'ACTIVÉ ✅' : 'DÉSACTIVÉ ⚠️'} │
    │  🌐 Webhook Discord: ${process.env.DISCORD_WEBHOOK_URL ? 'ACTIVÉ ✅' : 'DÉSACTIVÉ ⚠️'} │
    └─────────────────────────────────────────────────────────────┘
    `);
});