// discord-bot.js - Bot Discord pour NEIVOS GROUPE (Version corrigée)
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Pool MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

// ID du salon où envoyer les notifications
const NOTIFICATION_CHANNEL_ID = process.env.DISCORD_NOTIFICATION_CHANNEL_ID;

// Fonction pour envoyer une notification dans le salon Discord
async function sendNotification(embed) {
    if (!NOTIFICATION_CHANNEL_ID) {
        console.log('⚠️ DISCORD_NOTIFICATION_CHANNEL_ID non configuré');
        return;
    }
    try {
        const channel = await client.channels.fetch(NOTIFICATION_CHANNEL_ID);
        if (channel) await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Erreur envoi notification:', error.message);
    }
}

// Fonction pour répondre à un client
async function replyToClient(userId, message, adminName) {
    try {
        await pool.query(
            'INSERT INTO messages (user_id, sender, message) VALUES (?, "admin", ?)',
            [userId, message]
        );
        
        const [clientInfo] = await pool.query('SELECT nom FROM users WHERE id = ?', [userId]);
        
        return { success: true, clientName: clientInfo[0]?.nom || 'Client' };
    } catch (error) {
        console.error('Erreur envoi réponse:', error);
        return { success: false, error: error.message };
    }
}

// Fonction pour obtenir la liste des clients récents
async function getRecentClients(limit = 10) {
    const [rows] = await pool.query(`
        SELECT u.id, u.nom, u.email, 
               (SELECT COUNT(*) FROM messages WHERE user_id = u.id AND is_read = FALSE AND sender = 'user') as unread,
               (SELECT created_at FROM messages WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as last_message
        FROM users u
        WHERE u.role = 'user'
        ORDER BY u.created_at DESC
        LIMIT ?
    `, [limit]);
    return rows;
}

// Fonction pour obtenir les statistiques
async function getStats() {
    const [stats] = await pool.query(`
        SELECT 
            (SELECT COUNT(*) FROM users WHERE role = 'user') as total_users,
            (SELECT COUNT(*) FROM contact_requests WHERE status = 'pending') as pending_contacts,
            (SELECT COUNT(*) FROM messages WHERE is_read = FALSE AND sender = 'user') as unread_messages,
            (SELECT COUNT(*) FROM quotes) as total_quotes,
            (SELECT COUNT(*) FROM users WHERE last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as active_week
    `);
    return stats[0];
}

// ==================== COMMANDES SLASH ====================
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    // Commande /reply - Répondre à un client
    if (commandName === 'reply') {
        await interaction.deferReply({ ephemeral: true });
        
        const userId = parseInt(options.getString('user_id'));
        const message = options.getString('message');
        
        if (isNaN(userId)) {
            return interaction.editReply('❌ ID utilisateur invalide');
        }
        
        const [users] = await pool.query('SELECT id, nom FROM users WHERE id = ? AND role = "user"', [userId]);
        if (users.length === 0) {
            return interaction.editReply('❌ Aucun client trouvé avec cet ID');
        }
        
        const result = await replyToClient(userId, message, interaction.user.username);
        
        if (result.success) {
            const embed = new EmbedBuilder()
                .setTitle('✅ Réponse envoyée')
                .setColor(0x00FF00)
                .addFields(
                    { name: '👤 Client', value: result.clientName, inline: true },
                    { name: '🆔 ID', value: userId.toString(), inline: true },
                    { name: '💬 Message', value: message.length > 100 ? message.substring(0, 100) + '...' : message },
                    { name: '👨‍💼 Admin', value: interaction.user.username, inline: true }
                )
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
            // Notification supplémentaire dans le salon
            const channel = interaction.channel;
            if (channel) {
                const notifEmbed = new EmbedBuilder()
                    .setTitle('📨 Réponse administrateur envoyée')
                    .setColor(0x3B82F6)
                    .setDescription(`**À :** ${result.clientName} (ID: ${userId})\n**Message :** ${message}`)
                    .setFooter({ text: `Répondu par ${interaction.user.username}` })
                    .setTimestamp();
                await channel.send({ embeds: [notifEmbed] });
            }
        } else {
            interaction.editReply(`❌ Erreur: ${result.error}`);
        }
    }
    
    // Commande /clients - Voir les clients récents
    else if (commandName === 'clients') {
        await interaction.deferReply();
        
        const clients = await getRecentClients(10);
        
        if (clients.length === 0) {
            return interaction.editReply('📭 Aucun client enregistré.');
        }
        
        const embed = new EmbedBuilder()
            .setTitle('👥 Clients NEIVOS')
            .setColor(0x8B5CF6)
            .setDescription('Liste des clients récents')
            .setTimestamp();
        
        clients.forEach(client => {
            embed.addFields({
                name: `🆔 ${client.id} - ${client.nom}`,
                value: `📧 ${client.email} | 📬 ${client.unread} message(s) non lu(s)\n🕐 Dernier message: ${client.last_message ? new Date(client.last_message).toLocaleString('fr-FR') : 'Aucun'}`,
                inline: false
            });
        });
        
        await interaction.editReply({ embeds: [embed] });
    }
    
    // Commande /stats - Voir les statistiques
    else if (commandName === 'stats') {
        await interaction.deferReply();
        
        const stats = await getStats();
        
        const embed = new EmbedBuilder()
            .setTitle('📊 Statistiques NEIVOS')
            .setColor(0x06B6D4)
            .addFields(
                { name: '👥 Utilisateurs', value: stats.total_users.toString(), inline: true },
                { name: '📩 Demandes en attente', value: stats.pending_contacts.toString(), inline: true },
                { name: '💬 Messages non lus', value: stats.unread_messages.toString(), inline: true },
                { name: '📄 Devis générés', value: stats.total_quotes.toString(), inline: true },
                { name: '📈 Actifs (7j)', value: stats.active_week.toString(), inline: true }
            )
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    }
    
    // Commande /help - Aide
    else if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('🤖 Commandes NEIVOS Bot')
            .setColor(0x3B82F6)
            .setDescription('Voici les commandes disponibles :')
            .addFields(
                { name: '/reply [user_id] [message]', value: '✅ Répondre à un client (admin uniquement)', inline: false },
                { name: '/clients', value: '👥 Voir la liste des clients récents', inline: false },
                { name: '/stats', value: '📊 Voir les statistiques de la plateforme', inline: false },
                { name: '/help', value: '❓ Afficher cette aide', inline: false }
            )
            .setFooter({ text: 'NEIVOS GROUPE - Support Client' });
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

// ==================== MESSAGES SIMPLES (alternative aux slash) ====================
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.guild) return;
    
    // Format: !reply 12 "Bonjour client"
    if (message.content.startsWith('!reply ')) {
        const match = message.content.match(/!reply (\d+) "?([^"]+)"?/);
        if (!match) {
            return message.reply('❌ Utilisation: `!reply [ID_client] "votre message"`\nExemple: `!reply 12 "Bonjour, votre devis est prêt"`');
        }
        
        const userId = parseInt(match[1]);
        const replyMessage = match[2];
        
        if (isNaN(userId)) {
            return message.reply('❌ ID client invalide');
        }
        
        const [users] = await pool.query('SELECT id, nom FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return message.reply('❌ Client non trouvé');
        }
        
        const result = await replyToClient(userId, replyMessage, message.author.username);
        
        if (result.success) {
            message.reply(`✅ Réponse envoyée à **${result.clientName}** (ID: ${userId})`);
        } else {
            message.reply(`❌ Erreur: ${result.error}`);
        }
    }
});

// ==================== EXPORTER LES FONCTIONS POUR server.js ====================
async function sendDiscordNotification(type, data) {
    let embed;
    
    // Ne pas utiliser .setTimestamp() avec une valeur - laisser vide pour timestamp auto
    if (type === 'register') {
        embed = new EmbedBuilder()
            .setTitle('🆕 Nouvelle inscription')
            .setColor(0x10B981)
            .addFields(
                { name: '👤 Nom', value: data.nom, inline: true },
                { name: '📧 Email', value: data.email, inline: true },
                { name: '📞 Téléphone', value: data.telephone || 'Non renseigné', inline: true },
                { name: '🏢 Entreprise', value: data.entreprise || 'Non renseignée', inline: true }
            )
            .setTimestamp(); // Pas de paramètre = timestamp actuel automatique
    } else if (type === 'login') {
        embed = new EmbedBuilder()
            .setTitle('🔐 Connexion utilisateur')
            .setColor(0x3B82F6)
            .addFields(
                { name: '👤 Nom', value: data.nom, inline: true },
                { name: '📧 Email', value: data.email, inline: true }
            )
            .setTimestamp();
    } else if (type === 'message') {
        embed = new EmbedBuilder()
            .setTitle('💬 Nouveau message client')
            .setColor(0x8B5CF6)
            .addFields(
                { name: '👤 Client', value: data.clientName, inline: true },
                { name: '📧 Email', value: data.clientEmail, inline: true },
                { name: '🆔 ID', value: data.userId.toString(), inline: true },
                { name: '💬 Message', value: data.message.length > 500 ? data.message.substring(0, 500) + '...' : data.message }
            )
            .setFooter({ text: 'Pour répondre: /reply [ID] [message]' })
            .setTimestamp();
    } else if (type === 'contact') {
        embed = new EmbedBuilder()
            .setTitle('📩 Nouvelle demande de contact')
            .setColor(0xF59E0B)
            .addFields(
                { name: '👤 Nom', value: data.nom, inline: true },
                { name: '📧 Email', value: data.email, inline: true },
                { name: '💬 Message', value: data.message.length > 500 ? data.message.substring(0, 500) + '...' : data.message }
            )
            .setTimestamp();
    }

    if (embed) await sendNotification(embed);
}

// ==================== DÉMARRAGE ====================
client.once('ready', async () => {
    console.log(`🤖 Bot Discord connecté en tant que ${client.user.tag}`);
    
    // Enregistrer les commandes slash globales
    const commands = [
        {
            name: 'reply',
            description: 'Répondre à un client NEIVOS',
            options: [
                { name: 'user_id', description: 'ID du client (visible dans le message)', type: 3, required: true },
                { name: 'message', description: 'Message de réponse', type: 3, required: true }
            ]
        },
        { name: 'clients', description: 'Voir la liste des clients récents' },
        { name: 'stats', description: 'Voir les statistiques de la plateforme' },
        { name: 'help', description: 'Afficher l\'aide' }
    ];
    
    try {
        await client.application.commands.set(commands);
        console.log('✅ Commandes slash enregistrées');
        console.log('   Commandes disponibles: /reply, /clients, /stats, /help');
    } catch (error) {
        console.error('Erreur enregistrement commandes:', error);
    }
});

// Connexion
client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
    console.error('❌ Erreur connexion Discord:', err.message);
});

module.exports = { sendDiscordNotification };