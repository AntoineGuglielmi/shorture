# Shorture

**Shorture transforme un smartphone en surface de contrôle tactile pour déclencher des raccourcis clavier sur un ordinateur.**

L'idée est de piloter les actions fréquentes d'une application de bureau avec des gestes effectués sur son téléphone : enregistrer, annuler, ouvrir un panneau ou lancer une commande.

Ce dépôt contient le **premier prototype fonctionnel** de Shorture. Il valide principalement la communication entre le téléphone et l'ordinateur ainsi que l'exécution de raccourcis Windows.

## État du projet

Le prototype permet actuellement de :

- lancer une application de bureau depuis Shorture ou de cibler une instance déjà ouverte ;
- connecter un téléphone à l'ordinateur depuis un navigateur, sur le même réseau local ;
- détecter quelques gestes tactiles multi-touch ;
- transmettre l'action correspondante à l'application sélectionnée ;
- afficher les erreurs d'exécution sur l'ordinateur et copier leur diagnostic.

Les gestes et raccourcis sont prédéfinis. Il n'y a pas encore d'éditeur de configuration ni de création de surfaces personnalisées.

## Fonctionnement

Shorture est composé de deux interfaces :

- **Application ordinateur** : application Electron avec une interface React et TypeScript. Elle permet de sélectionner l'application à piloter et affiche les informations de connexion.
- **Interface mobile** : page web adaptée au tactile, ouverte dans le navigateur du téléphone. Aucun APK n'est nécessaire.

Les deux interfaces communiquent sur le réseau Wi-Fi local via WebSocket. Sur Windows, l'application ordinateur utilise PowerShell, `WScript.Shell` et `System.Windows.Forms.SendKeys` pour activer la fenêtre cible et envoyer les touches.

```text
Téléphone (Chrome)
       |
       | Wi-Fi local / WebSocket
       v
Shorture (Electron)
       |
       | PowerShell / SendKeys
       v
Application ciblée (ex. Visual Studio Code)
```

## Prérequis

- Windows 10 ou Windows 11.
- Node.js 22 LTS recommandé (20 ou supérieur).
- npm.
- Un téléphone et un ordinateur connectés au même réseau local.
- Un navigateur récent sur le téléphone (Chrome Android recommandé).

> L'envoi des raccourcis clavier est actuellement spécifique à Windows. Le serveur mobile est prévu pour un usage sur le réseau local, pas pour être exposé sur Internet.

## Installation

Récupérer le dépôt depuis GitHub :

```powershell
git clone --branch 001-first-prototype https://github.com/AntoineGuglielmi/shorture.git
cd shorture
```

Ou télécharger directement l'archive de la branche :

[Télécharger Shorture — branche 001-first-prototype](https://github.com/AntoineGuglielmi/shorture/archive/refs/heads/001-first-prototype.zip)

Installer les dépendances :

```powershell
npm install
```

## Lancer Shorture

À la racine du projet :

```powershell
npm run dev
```

Cette commande démarre Vite, la compilation du processus Electron et l'application de bureau.

L'application Shorture doit s'ouvrir sur l'ordinateur.

## Connecter le téléphone

1. Dans Shorture, clique sur **Choisir un .exe** et sélectionne l'exécutable de l'application à piloter. Pour Visual Studio Code, il s'agit généralement de `Code.exe`.
2. Repère l'adresse locale et le code PIN à six chiffres affichés dans l'application.
3. Sur le téléphone, connecté au même Wi-Fi, ouvre cette adresse dans Chrome. Elle ressemble à `http://192.168.1.20:5173/mobile`.
4. Saisis le code PIN affiché sur l'ordinateur.
5. Si Windows demande une autorisation pour le réseau privé, autorise l'accès.

Une fois connecté, la surface tactile du téléphone est prête à recevoir les gestes.

## Gestes disponibles

Les gestes suivants sont actuellement associés à des raccourcis prédéfinis :

| Geste | Action envoyée | Résultat attendu |
| --- | --- | --- |
| Appui simultané de deux doigts | `Ctrl + S` | Enregistrer le document |
| Glissement de trois doigts vers le haut | `Ctrl + Shift + P`, puis la commande `Terminal: Create New Terminal` | Ouvrir le terminal intégré de VS Code |
| Pincement entrant | `Ctrl + Z` | Annuler la dernière action |
| Pincement sortant | `Ctrl + Shift + P` | Ouvrir la palette de commandes |

Les raccourcis sont envoyés à la fenêtre de l'application sélectionnée. Si aucune fenêtre correspondante n'est trouvée, Shorture tente de démarrer l'application à partir de l'exécutable choisi.

> La commande d'ouverture du terminal utilise actuellement le libellé anglais de VS Code. Son exécution peut donc dépendre de la langue de l'interface.

## Vérifications et commandes utiles

Depuis la racine du dépôt :

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Lance l'application en développement |
| `npm run typecheck` | Vérifie les types TypeScript |
| `npm run build` | Vérifie et construit le projet |

## Dépannage

### Le téléphone n'arrive pas à se connecter

- Vérifie que le téléphone et le PC sont sur le même réseau Wi-Fi.
- Vérifie que le réseau Windows est défini comme réseau privé.
- Autorise Node.js / Electron dans le pare-feu Windows pour les réseaux privés.
- Vérifie que l'adresse saisie sur le téléphone correspond à celle affichée dans Shorture.

### Le geste est détecté, mais le raccourci ne s'exécute pas

- Vérifie qu'un fichier `.exe` valide a été sélectionné dans Shorture.
- Vérifie que l'application cible peut être lancée normalement.
- Consulte le panneau de diagnostic dans l'application ordinateur.
- Utilise le bouton de copie du diagnostic pour récupérer le détail complet de l'erreur.

### Les gestes multi-touch ne sont pas détectés correctement

- Utilise Chrome sur Android.
- Effectue les gestes à l'intérieur de la surface tactile de Shorture.
- Certains gestes système du téléphone ou de sa surcouche Android peuvent intercepter les mouvements, notamment près des bords de l'écran.

### L'application Electron ne démarre pas après l'installation

Vérifie d'abord que l'installation des dépendances s'est terminée correctement. Si le binaire Electron pour Windows n'a pas été téléchargé, supprime `node_modules`, relance `npm install` et vérifie à nouveau.

## Limites actuelles

- Windows uniquement pour l'exécution des raccourcis.
- Liste de gestes et de raccourcis codée en dur.
- Pas encore de configuration personnalisable des surfaces ou des actions.
- La détection des gestes dépend du navigateur et du matériel tactile.
- La sélection de l'application et la configuration ne sont pas encore persistées après fermeture.
- Le téléphone et le PC doivent rester sur le même réseau local.

## Stack technique

- Electron
- React
- TypeScript
- Vite
- WebSocket (`ws`)
- PowerShell et Windows Script Host pour l'envoi des raccourcis
