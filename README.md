<!--
  Neivos Groupe — Project README
  Maintainer: Wissem Attouf
-->

<div align="center">

# NEIVOS GROUPE

### Plateforme web pour l’expertise technologique, les services numériques et la relation client

Une interface moderne associée à une API Node.js/Express, une base de données MySQL et des outils d’administration pour centraliser les services, les demandes et les interactions clients.

<br />

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://neivos-groupe.vercel.app/)
[![Repository](https://img.shields.io/badge/Source-GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/WissemAttouf/Neivos-Groupe)
[![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express.js-API-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-Database-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)

<br />

**[Voir la démonstration](https://neivos-groupe.vercel.app/) · [Explorer le code](https://github.com/WissemAttouf/Neivos-Groupe)**

</div>

---

## Présentation

**Neivos Groupe** est un projet web conçu autour d’une expérience digitale premium : une vitrine publique, un espace client et une interface d’administration connectés à un backend Node.js.

Le projet combine une interface responsive avec une API REST, la persistance des données sous MySQL, une authentification basée sur les tokens JWT et une intégration Discord destinée aux notifications.

> **Objectif technique :** réunir présentation des services, gestion des demandes et outils d’administration dans une application web structurée, avec une séparation claire entre interface, serveur et données.

## Fonctionnalités

### Interface publique
- Présentation des services et des technologies.
- Interface moderne avec thèmes visuels sombre et clair.
- Sections interactives et composants adaptés à une navigation web contemporaine.
- Accès aux parcours de connexion et d’inscription.

### Espace client
- Authentification et accès à un tableau de bord.
- Interactions liées aux demandes et aux messages clients.
- Parcours de contact et de demande de devis selon les fonctionnalités exposées par l’application.

### Administration
- Routes protégées réservées aux comptes administrateurs.
- Gestion des services et des technologies (opérations CRUD).
- Suivi des utilisateurs et des demandes enregistrées dans la base.
- Tableau de bord d’administration avec indicateurs et vues de gestion.

### Backend et intégrations
- API REST développée avec **Node.js** et **Express.js**.
- Stockage relationnel avec **MySQL** et le client mysql2.
- Hachage des mots de passe avec **bcryptjs**.
- Authentification par **JSON Web Token (JWT)**.
- Validation des entrées et limitation du débit avec express-validator et express-rate-limit.
- Intégration **Discord** pour les notifications configurées via webhook et bot.
- Configuration sensible externalisée dans les variables d’environnement.

## Stack technique

| Domaine | Technologies |
|---|---|
| Interface | HTML, CSS, JavaScript |
| Styles et icônes | Tailwind CSS, Font Awesome, Google Fonts |
| Visualisation et cartes | Three.js, Leaflet |
| Serveur | Node.js, Express.js |
| Base de données | MySQL, mysql2 |
| Authentification | JSON Web Token, bcryptjs |
| Validation et protection | express-validator, express-rate-limit, CORS |
| Intégration | Discord.js, Discord Webhooks |
| Outils | npm, Nodemon, Git, GitHub |
| Déploiement de la démo | Vercel |

## Architecture du projet

~~~text
Neivos-Groupe/
├── database/
│   └── init.sql                 # Schéma SQL et données initiales
├── public/
│   ├── index.html               # Site public
│   ├── dashboard.html           # Espace client
│   ├── admin.html               # Interface d’administration
│   ├── admin-dashboard.html     # Tableau de bord administrateur
│   ├── script.js                # Interactions du site public
│   ├── admin-script.js          # Interactions d’administration
│   ├── style.css                # Styles partagés
│   └── fix.js                   # Scripts complémentaires
├── .env.example                 # Exemple de configuration
├── .gitignore
├── create-admin.js              # Script utilitaire de création admin
├── discord-bot.js               # Intégration du bot Discord
├── package.json
├── package-lock.json
├── server.js                    # Serveur Express et API
└── README.md
~~~

## Démarrage en local

### Prérequis

- [Node.js](https://nodejs.org/) — une version LTS récente est recommandée.
- npm (fourni avec Node.js).
- [MySQL](https://www.mysql.com/) ou une installation locale via XAMPP.
- Git pour cloner le dépôt.

### 1. Cloner le dépôt

~~~bash
git clone https://github.com/WissemAttouf/Neivos-Groupe.git
cd Neivos-Groupe
~~~

### 2. Installer les dépendances

~~~bash
npm install
~~~

### 3. Configurer les variables d’environnement

Créez un fichier local .env à partir du modèle :

**Windows (CMD)**

~~~bat
copy .env.example .env
~~~

**macOS / Linux**

~~~bash
cp .env.example .env
~~~

Renseignez ensuite les valeurs adaptées à votre environnement :

~~~dotenv
PORT=3000

DB_HOST=localhost
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=neivos_groupe

JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRE=1d

DISCORD_WEBHOOK_URL=
DISCORD_BOT_TOKEN=
DISCORD_NOTIFICATION_CHANNEL_ID=
~~~

Utilisez un secret JWT long, aléatoire et privé. Les paramètres Discord sont facultatifs si vous n’activez pas les notifications.

### 4. Initialiser la base de données

Importez le fichier database/init.sql dans votre serveur MySQL, par exemple depuis phpMyAdmin, ou avec la commande suivante :

~~~bash
mysql -u your_mysql_user -p < database/init.sql
~~~

**Important :** le script SQL contient une instruction DROP DATABASE IF EXISTS neivos_groupe. Il supprime puis recrée cette base. Vérifiez le fichier et sauvegardez vos données avant de l’exécuter ; ne l’utilisez pas tel quel sur une base contenant des données à conserver.

### 5. Démarrer l’application

Mode normal :

~~~bash
npm start
~~~

Mode développement :

~~~bash
npm run dev
~~~

Si la configuration est correcte, ouvrez [http://localhost:3000](http://localhost:3000).

## Scripts disponibles

| Commande | Description |
|---|---|
| npm start | Démarre le serveur Node.js |
| npm run dev | Démarre le serveur avec Nodemon |

## Configuration et sécurité

Quelques bonnes pratiques à respecter avant un déploiement public :

- **Ne publiez jamais le fichier .env**, les mots de passe, les tokens ou les URLs de webhook privées.
- Utilisez des identifiants distincts pour le développement et la production.
- Configurez CORS selon les domaines autorisés au lieu d’ouvrir les accès inutilement.
- Vérifiez les rôles et les autorisations côté serveur pour chaque route sensible.
- Utilisez HTTPS et un secret JWT robuste en production.
- Contrôlez les données reçues par l’API et limitez les tentatives abusives.
- Remplacez ou désactivez tout compte et tout secret de démonstration avant une mise en production.

Le fichier .env.example sert uniquement de modèle : il ne doit contenir aucune valeur secrète réelle.

## Démonstration et déploiement

- **Démonstration en ligne :** [neivos-groupe.vercel.app](https://neivos-groupe.vercel.app/)
- **Code source :** [github.com/WissemAttouf/Neivos-Groupe](https://github.com/WissemAttouf/Neivos-Groupe)

Le site public est déployé sur Vercel. Le backend Express et les fonctionnalités qui dépendent de MySQL ou d’un processus Discord nécessitent toutefois un environnement compatible et correctement configuré. Configurez les variables d’environnement dans la plateforme d’hébergement et vérifiez les routes API, la connexion à la base et les intégrations après chaque déploiement.

## Pistes d’amélioration

Les évolutions suivantes peuvent renforcer davantage la qualité du projet :

- Ajouter des tests automatisés pour les routes API et les parcours d’authentification.
- Documenter l’API avec OpenAPI/Swagger.
- Mettre en place une intégration continue pour exécuter les vérifications avant déploiement.
- Ajouter des captures d’écran réelles et une démonstration des principaux parcours.
- Centraliser la journalisation et améliorer le suivi des erreurs en production.

## Auteur

**Wissem Attouf** — Software Engineer | Full Stack Developer

- GitHub : [@WissemAttouf](https://github.com/WissemAttouf)
- Portfolio : [wissemattouf.github.io/portfolio-wissem](https://wissemattouf.github.io/portfolio-wissem/)

---

<div align="center">

**Merci de visiter le projet Neivos Groupe.**

Si ce projet vous intéresse, n’hésitez pas à explorer le code et à partager vos retours.

<sub>Conçu pour présenter une expérience web moderne et des pratiques de développement full-stack.</sub>

</div>
