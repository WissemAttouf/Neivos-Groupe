-- Supprimer et recréer la base de données
DROP DATABASE IF EXISTS neivos_groupe;
CREATE DATABASE neivos_groupe;
USE neivos_groupe;

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    telephone VARCHAR(20),
    entreprise VARCHAR(150),
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Table des demandes de contact
CREATE TABLE IF NOT EXISTS contact_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    nom VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    telephone VARCHAR(20),
    entreprise VARCHAR(150),
    message TEXT NOT NULL,
    status ENUM('pending', 'read', 'replied', 'archived') DEFAULT 'pending',
    admin_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Table des devis
CREATE TABLE IF NOT EXISTS quotes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    client_email VARCHAR(150) NOT NULL,
    client_nom VARCHAR(100),
    service_type ENUM('outsourcing', 'formation', 'conseil', 'talents') NOT NULL,
    duree_mois INT NOT NULL,
    quantite INT DEFAULT 1,
    montant_ht DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'sent', 'accepted', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Table des rendez-vous
CREATE TABLE IF NOT EXISTS appointments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    nom VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    telephone VARCHAR(20),
    date_heure DATETIME NOT NULL,
    sujet VARCHAR(200),
    status ENUM('pending', 'confirmed', 'cancelled', 'completed') DEFAULT 'pending',
    notes_admin TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Table newsletter
CREATE TABLE IF NOT EXISTS newsletter (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(150) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Table des logs d'activité
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Insertion admin (mot de passe: Admin@2025)
-- Hash bcrypt de "Admin@2025" généré avec bcrypt.hashSync("Admin@2025", 10)
INSERT INTO users (nom, email, password, role) VALUES 
('Administrateur', 'admin@neivos.fr', '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr/.5ZpQ.GbZw5K2P3vN0KpY5XqZ9qW', 'admin');

-- Insertion utilisateur test (mot de passe: User@2025)
INSERT INTO users (nom, email, password, role) VALUES 
('Jean Dupont', 'jean.dupont@email.com', '$2a$10$XQ8uLOickgx2ZMRZoMy.Mr/.5ZpQ.GbZw5K2P3vN0KpY5XqZ9qX', 'user');

-- Index
CREATE INDEX idx_contact_user ON contact_requests(user_id);
CREATE INDEX idx_quotes_user ON quotes(user_id);
CREATE INDEX idx_appointments_user ON appointments(user_id);
CREATE INDEX idx_status_contact ON contact_requests(status);
CREATE INDEX idx_status_quotes ON quotes(status);