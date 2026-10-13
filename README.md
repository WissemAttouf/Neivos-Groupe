# Neivos Groupe

Plateforme web NEIVOS GROUPE avec interface publique, espace d’administration et intégration MySQL/Discord.

## Prérequis
- Node.js (version LTS recommandée)
- MySQL

## Installation locale
1. Installez les dépendances : `npm install`
2. Copiez `.env.example` vers `.env` et renseignez vos paramètres locaux.
3. Créez la base de données et exécutez `database/init.sql`.
4. Démarrez le serveur : `npm start`
5. Ouvrez `http://localhost:3000`.

## Configuration
Les identifiants de base de données, le secret JWT et les paramètres Discord doivent rester dans `.env`. Ne publiez jamais ce fichier. `.env.example` ne contient que des valeurs d’exemple.

## Déploiement
Le déploiement dépend de la configuration du serveur et de la disponibilité d’une base MySQL accessible depuis l’environnement d’hébergement. Configurez les variables d’environnement dans la plateforme de déploiement plutôt que de les inclure dans Git.

## Sécurité
- Ne commitez jamais `.env`, tokens, mots de passe ou secrets.
- Si un token Discord, webhook ou secret JWT a déjà été partagé, révoquez-le/renouvelez-le.
- Vérifiez que les paramètres CORS et les accès administrateur sont adaptés à votre environnement avant toute mise en production.
