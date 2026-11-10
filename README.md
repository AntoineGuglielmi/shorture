# Shorture

Shorture transforme un smartphone en surface tactile pour déclencher des raccourcis clavier sur un ordinateur Windows.

## Premier prototype

- Application PC : Electron, React et TypeScript.
- Téléphone : interface web mobile, sans APK.
- Communication : WebSocket sur le réseau Wi-Fi local.
- Déclenchement : raccourcis clavier Windows via PowerShell / WScript.Shell.

Le prototype est volontairement limité à une petite liste de raccourcis prédéfinis. Il ne permet pas d'exécuter des commandes arbitraires.

## Prérequis

- Windows 10 ou 11.
- Node.js 20 ou supérieur (Node 22 recommandé).
- npm.
- PC et téléphone sur le même réseau Wi-Fi.
- Google Chrome sur le téléphone.

## Lancer en développement

Dans un terminal PowerShell, à la racine du dépôt :

```powershell
npm install
npm run dev
```

L'application Shorture s'ouvre sur le PC. Le serveur mobile écoute sur le réseau local.

1. Dans Shorture, clique sur **Choisir un .exe** et sélectionne l'application à piloter (par exemple `Code.exe` pour Visual Studio Code).
2. Repère l'adresse mobile et le code à six chiffres affichés dans Shorture.
3. Sur le Redmi, connecté au même Wi-Fi, ouvre l'adresse indiquée (par exemple `http://192.168.1.20:5173/mobile`).
4. Saisis le code à six chiffres.
5. Accepte l'accès réseau privé si le pare-feu Windows le demande.
6. Teste les gestes sur la surface tactile.

## Gestes du prototype

| Geste | Raccourci | Résultat attendu |
| --- | --- | --- |
| Glissement de trois doigts vers le haut | Ctrl + Shift + P | Palette de commandes VS Code |
| Appui simultané de deux doigts | Ctrl + S | Enregistrer |
| Pincement entrant | Ctrl + Z | Annuler |
| Pincement sortant | Ctrl + Shift + P | Palette de commandes |

Le raccourci est envoyé à la fenêtre de l'application sélectionnée. Si elle n'est pas ouverte, Shorture tente de la lancer.

## Dépannage

- **Le téléphone ne se connecte pas :** vérifie que les deux appareils sont sur le même Wi-Fi, que le réseau Windows est défini comme privé et que l'accès réseau est autorisé pour Node/Electron.
- **Aucune adresse n'apparaît :** vérifie que le PC est bien connecté au Wi-Fi, puis actualise les informations.
- **Le geste est détecté mais rien ne se passe :** vérifie que l'application cible a bien été sélectionnée. Certains logiciels ou fenêtres élevées peuvent empêcher l'activation automatique.
- **Les gestes à plusieurs doigts ne répondent pas :** teste dans Chrome Android et garde les doigts dans la surface sombre. MIUI peut intercepter certains gestes système sur les bords de l'écran.

## Limites connues

- Windows uniquement pour l'envoi des raccourcis.
- Les raccourcis sont une liste fixe dans ce prototype.
- La détection multi-touch dépend du navigateur et du comportement tactile du téléphone.
- Le serveur n'est pas conçu pour être exposé à Internet : utilise uniquement un réseau local de confiance.
- La configuration et la sélection de l'application ne sont pas encore persistées après fermeture.

## Scripts

- `npm run dev` : lance Vite et Electron.
- `npm run typecheck` : vérifie les types.
- `npm run build` : construit l'interface et le processus Electron.
