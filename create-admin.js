// create-admin.js
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdmin() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    const adminData = {
        nom: 'Administrateur',
        email: 'admin@gmail.com',
        password: '1234567',
        role: 'admin'
    };

    const hashedPassword = await bcrypt.hash(adminData.password, 10);

    try {
        // Supprimer l'ancien admin
        await pool.query('DELETE FROM users WHERE email = ?', ['admin@neivos.fr']);
        console.log('✅ Ancien admin supprimé');
        
        // Vérifier si admin@gmail.com existe déjà
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [adminData.email]);
        
        if (existing.length > 0) {
            // Mettre à jour
            await pool.query(
                'UPDATE users SET nom = ?, password = ?, role = ?, is_active = 1 WHERE email = ?',
                [adminData.nom, hashedPassword, adminData.role, adminData.email]
            );
            console.log('✅ Administrateur mis à jour');
        } else {
            // Créer nouveau
            await pool.query(
                'INSERT INTO users (nom, email, password, role, is_active) VALUES (?, ?, ?, ?, 1)',
                [adminData.nom, adminData.email, hashedPassword, adminData.role]
            );
            console.log('✅ Nouvel administrateur créé');
        }
        
        console.log(`\n📧 Email: ${adminData.email}`);
        console.log(`🔑 Mot de passe: ${adminData.password}`);
        console.log(`👤 Nom: ${adminData.nom}`);
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    } finally {
        await pool.end();
    }
}

createAdmin();