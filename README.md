# Kezak — site et back-office

Site public et administration de Kezak, le studio de Victor Bertschy.
Astro 5 en rendu serveur, base SQLite, administration maison à `/admin`.

> **Deux choses à savoir avant de commencer.**
> Les polices ne sont pas dans le dépôt (licences à télécharger soi-même) :
> voir l'étape 6. Et sans fichier `.env`, la base atterrit dans le dossier du
> projet — c'est voulu en local, à ne surtout pas laisser en ligne (étape 4
> de la mise en ligne).

---

# Partie 1 — En local, avec VS Code

## 1. Ouvrir le projet

Décompressez l'archive, puis dans VS Code : **Fichier → Ouvrir le dossier**,
et choisissez le dossier `kezak`. Ouvrez le terminal intégré avec
**Ctrl + ù** (ou **Terminal → Nouveau terminal**) : toutes les commandes qui
suivent se tapent là, et vous devez voir `kezak` au bout du chemin affiché.

VS Code proposera d'installer les extensions recommandées — acceptez.
Il y en a quatre, définies dans `.vscode/extensions.json` :

| Extension | Ce qu'elle apporte |
| --- | --- |
| **Astro** | coloration et autocomplétion des fichiers `.astro` — indispensable |
| **Prettier** | remise en forme automatique à l'enregistrement |
| **EditorConfig** | respecte l'indentation du projet |
| **axe Linter** | signale les fautes d'accessibilité pendant que vous écrivez |

## 2. Vérifier Node

```bash
node -v
```

Il faut **20.12 au minimum**. **Node 22 LTS est le choix conseillé** :
c'est la version qui tournera chez Infomaniak, et travailler sur la même
qu'en production évite les mauvaises surprises. Node 24 fonctionne aussi.

Si la version est plus ancienne ou si la commande est inconnue, installez
Node 22 LTS depuis nodejs.org, puis **fermez et rouvrez le terminal**.

> Le projet ne dépend plus d'un binaire lié à une version précise de Node :
> `better-sqlite3` v13 utilise N-API, un binaire unique valable partout.
> Si vous voyez malgré tout une erreur `Could not locate the bindings file`,
> voir le tableau de dépannage en fin de document.

## 3. Installer les dépendances

```bash
npm install
```

Comptez une à trois minutes : `better-sqlite3` et `sharp` sont des modules
natifs, ils téléchargent un binaire précompilé.

La base de données, elle, se crée toute seule au premier démarrage — il n'y
a rien à lancer pour ça.

**Si l'installation échoue, ou si une commande se plaint ensuite de
`better-sqlite3` :** repartez d'une installation propre. C'est la panne la
plus fréquente, et elle vient presque toujours d'un `node_modules` construit
avec une autre version de Node.

```bash
# Windows (PowerShell)
Remove-Item -Recurse -Force node_modules; Remove-Item -Force package-lock.json
# macOS / Linux
rm -rf node_modules package-lock.json
```

puis `npm install` à nouveau. Si l'erreur persiste, il manque les outils de
compilation : sur Windows installez les *Build Tools for Visual Studio*
(charge de travail « Développement Desktop en C++ »), sur macOS lancez
`xcode-select --install`.

**Un conseil au passage** : sortez le dossier de `Téléchargements` et
mettez-le dans un dossier de travail à vous (par exemple
`C:\Users\vous\Projets\kezak`). Certains antivirus surveillent de près le
dossier de téléchargements et ralentissent, voire bloquent, l'écriture des
milliers de fichiers de `node_modules`.

## 4. Créer le fichier de configuration

```bash
cp .env.example .env
```

Sous Windows PowerShell : `copy .env.example .env`.

Ouvrez `.env` dans VS Code et changez **une seule ligne** pour l'instant :

```
DEV_INSECURE_COOKIES=1
```

Sans elle, le cookie de session exige HTTPS, et la connexion à `/admin`
boucle indéfiniment en local. Le SMTP peut rester vide : le formulaire de
contact enregistrera les messages en base sans envoyer de courriel.

## 5. Remplir le site et créer votre compte

```bash
npm run seed
```

Cela installe les contenus repris des maquettes : 12 projets, les six écrans
de l'accueil, les prestations, la FAQ, le parcours. Les textes entre
crochets — `[NOM]`, `[À COMPLÉTER]` — sont des trous à combler depuis
l'admin ; le tableau de bord en tient la liste. La commande ne fait rien si
du contenu existe déjà.

```bash
npm run compte
```

Adresse e-mail, puis mot de passe de **12 caractères minimum**, saisi deux
fois. C'est le seul moyen de créer un compte : il n'existe aucune
inscription, et aucune réinitialisation par courriel.

## 6. Déposer les polices

`public/fonts/` est vide, les fontes ne sont pas dans le dépôt. Il faut y
déposer sept fichiers **`.woff2`** :

| Fichier attendu | Où le trouver |
| --- | --- |
| `Lineal-Thin.woff2`, `Lineal-Light.woff2`, `Lineal-Regular.woff2` | velvetyne.fr/fonts/lineal — licence OFL |
| `Spectral-Light.woff2`, `Spectral-LightItalic.woff2`, `Spectral-Regular.woff2` | Google Fonts — OFL |
| `CutiveMono-Regular.woff2` | Google Fonts — OFL |

### a. Télécharger

Velvetyne et Google Fonts livrent des archives `.zip`. **Ouvrez l'archive
avant de convertir quoi que ce soit** : beaucoup de fonderies y glissent
déjà un dossier `webfonts`, `web` ou `woff2`. Si les `.woff2` sont là, il
n'y a rien à faire — passez au point c.

### b. Convertir, si vous n'avez que des `.ttf` ou `.otf`

Déposez les fichiers tels quels dans `public/fonts/`, puis :

```bash
npm run polices
```

La conversion se fait avec Node, que vous avez déjà — **aucun autre langage
à installer**. Le script renomme au passage vers les sept noms attendus
(`Lineal_Thin.ttf` devient `Lineal-Thin.woff2`), ignore ce qui existe déjà,
affiche le poids avant/après, et termine par la liste de ce qui manque.

Si le convertisseur n'est pas là, relancez `npm install` : il est déclaré
dans `package.json` sous `devDependencies`.

> **Sans rien installer du tout** : [transfonter.org](https://transfonter.org)
> fait le même travail dans le navigateur. Déposez vos fichiers, ne cochez
> que **WOFF2**, téléchargez, et gardez uniquement les `.woff2` en les
> renommant comme dans le tableau ci-dessus.

Une fois les `.woff2` obtenus, **supprimez les `.ttf` et `.otf`** de
`public/fonts/` : ils sont trois fois plus lourds et n'ont rien à faire en
ligne.

### c. Vérifier

```bash
npm run polices
```

Relancée sans rien à convertir, la commande se contente de faire l'inventaire
des sept fichiers. `npm run verif` le signale aussi.

Sans ces polices le site tourne, mais retombe sur celles du système — et la
direction artistique ne veut plus rien dire. C'est le symptôme « tout est en
Times New Roman ».

## 7. Lancer le site

```bash
npm run dev
```

Ouvrez **http://localhost:4321**. Le site se recharge tout seul à chaque
enregistrement de fichier. L'administration est sur
**http://localhost:4321/admin**.

Pour lancer depuis l'interface plutôt que le terminal : **Exécuter →
Démarrer le débogage** (ou **F5**), configuration « Kezak — dev (serveur) ».
Vous pouvez alors poser des points d'arrêt dans les fichiers `.ts`.

Pour arrêter : **Ctrl + C** dans le terminal.

## 8. Vérifier avant de livrer

```bash
npm run verif
```

Contrôle en une seconde : imports cassés, formulaire sans jeton anti-CSRF,
route d'admin sans contrôle de session, redirection non filtrée, couleur
hors de la palette, police manquante. **Lancez-la avant chaque mise en
ligne.**

```bash
npm run build && npm start
```

Construit la version de production et la sert sur le port 4321. C'est la
seule façon de tester ce que verront vraiment les visiteurs — la politique
de sécurité du contenu, par exemple, est stricte en production et desserrée
en développement.

---

# Partie 2 — Mise en ligne chez Infomaniak

## 1. Mettre le code sur GitHub ou GitLab

Dans VS Code, panneau **Contrôle de code source** (icône de branche dans la
barre latérale) → **Initialiser le dépôt** → **Publier sur GitHub**.
Choisissez **dépôt privé**.

Le `.gitignore` exclut déjà `node_modules`, `dist`, `.env`, `data/` et
`uploads/`. **Vérifiez que `.env` n'apparaît jamais dans les fichiers à
valider** : il contiendra le mot de passe de votre boîte mail.

## 2. Commander l'hébergement

Chez Infomaniak, offre **Hébergement Web** avec Node.js, à partir d'environ
11 CHF par mois. Dans le tableau de bord : **Hébergement → Sites → Ajouter
un site → Node.js**. Choisissez **Node 22**.

## 3. Récupérer le code sur le serveur

Toujours dans le tableau de bord, activez l'accès **SSH**, puis depuis votre
terminal :

```bash
ssh votre-identifiant@votre-serveur.infomaniak.ch
git clone https://github.com/vous/kezak.git ~/sites/kezak
cd ~/sites/kezak
npm ci
```

## 4. Créer les dossiers persistants — l'étape à ne pas rater

La base de données et les médias doivent vivre **hors du dossier déployé**,
sinon une mise à jour du code les efface.

```bash
mkdir -p ~/persistant/kezak/data ~/persistant/kezak/uploads
cp .env.example .env
nano .env
```

Dans `.env`, mettez les **chemins absolus** (`pwd` vous donne le vôtre) :

```
SITE_URL=https://kezak.ch
PORT=4321
DATA_DIR=/home/clients/xxxxxxxx/persistant/kezak/data
UPLOADS_DIR=/home/clients/xxxxxxxx/persistant/kezak/uploads
DEV_INSECURE_COOKIES=0

SMTP_HOST=mail.infomaniak.com
SMTP_PORT=587
SMTP_USER=contact@kezak.ch
SMTP_PASS=votre-mot-de-passe-de-boite-mail
MAIL_FROM=Site Kezak <contact@kezak.ch>
MAIL_TO=contact@kezak.ch
```

Pour sortir de nano : **Ctrl + O**, Entrée, **Ctrl + X**.

## 5. Construire et préparer les données

```bash
npm run build
npm run seed      # une seule fois, à la toute première mise en ligne
npm run compte    # votre compte d'administration, sur le serveur
```

Le mot de passe de production doit être **différent** de celui que vous
utilisez en local.

## 6. Démarrer l'application

Dans le tableau de bord Infomaniak, sur le site Node :

- **Commande de démarrage** : `node ./dist/server/entry.mjs`
- **Dossier de l'application** : `sites/kezak`
- **Port** : celui de la variable `PORT`, soit `4321`
- **Version de Node** : 22

Démarrez, puis consultez la console du tableau de bord : elle affiche les
erreurs éventuelles au lancement.

## 7. Domaine et certificat

Toujours dans le tableau de bord : pointez **kezak.ch** sur ce site,
activez le certificat **Let's Encrypt**, puis la **redirection HTTPS** et la
redirection de `www.kezak.ch` vers `kezak.ch`.

Ajoutez enfin une redirection **301** de `portfolio.kezak.ch` vers
`kezak.ch`, pour ne pas perdre les liens existants.

**Un réglage à ne pas oublier : la taille maximale d'une requête.**
L'application refuse d'elle-même un corps de plus de 512 Ko, sauf sur la
route de téléversement où la limite est de 80 Mo. Mais elle ne peut le
faire que si la requête annonce sa taille : un client malveillant peut
s'en dispenser. Le plafond qui compte vraiment est celui du serveur placé
devant. Cherchez **« taille maximale des requêtes »** ou
`client_max_body_size` dans le tableau de bord, et posez **80 Mo** — moins
empêcherait d'envoyer une vidéo de fond, beaucoup plus laisserait un
inconnu occuper la mémoire du serveur.

## 8. Programmer la sauvegarde

Tableau de bord → **Tâches planifiées** (cron), une fois par nuit :

```bash
cd ~/sites/kezak && npm run sauvegarde
```

Elle copie la base — à chaud, donc cohérente même site allumé — et les
médias dans `DATA_DIR/sauvegardes`, et purge les copies de plus de trente
jours. **Testez une restauration une fois** : une sauvegarde jamais restaurée
n'est pas une sauvegarde.

## 9. Le point à vérifier tout de suite

Connectez-vous à `/admin` et **enregistrez cinq ou six fois de suite**
n'importe quel texte. Si vous voyez une erreur de type *database is locked*,
c'est que le stockage d'Infomaniak est en réseau et que SQLite n'aime pas
ça. La parade est prévue : leur MariaDB est incluse et sans limite de
taille, et **seul `src/lib/db.ts` est à réécrire** — tout le reste du site
ne connaît que les fonctions qu'il exporte.

## 10. Mettre à jour plus tard

```bash
cd ~/sites/kezak
git pull
npm ci
npm run build
```

Puis **Redémarrer** depuis le tableau de bord. La base et les médias ne
bougent pas : ils sont ailleurs.

---

# Partie 3 — Au quotidien

## L'administration

`/admin`. La colonne de gauche suit l'ordre du site : **Accueil · Projets ·
Studio · Contact · Général · Médias · Messages**. Dans chaque page, les
sections portent les mêmes numéros que sur la page publique — on descend
dans l'admin comme on descend sur le site.

- **Accueil** — les six écrans de la séquence, réordonnables avec ↑ et ↓.
- **Projets** — l'ordre de la liste est celui de l'annuaire. « Nouveau
  projet » applique le gabarit : les quatre temps de l'étude de cas et une
  première ligne de générique sont déjà là. Un projet naît en **brouillon**,
  invisible tant que vous ne le publiez pas — mais vous pouvez relire sa
  page tant que vous êtes connecté.
- **Médias** — toute image envoyée est **automatiquement passée en bichromie
  cyanotype** et déclinée en AVIF et WebP sur quatre largeurs. Décochez la
  case pour garder les couleurs d'origine : à réserver aux logos de clients.
- **Messages** — ce que le formulaire a reçu. Les messages sont enregistrés
  en base **avant** l'envoi du courriel : si le SMTP tombe, rien n'est perdu.

## Changer le mot de passe

Il n'existe aucune page de réinitialisation, et c'est voulu : rien à
détourner depuis l'extérieur. Sur le serveur :

```bash
cd ~/sites/kezak && npm run compte
```

Même adresse e-mail = changement de mot de passe. Toutes les sessions
ouvertes sont fermées au passage.

## Les vidéos

**Vidéos de projet → YouTube.** Collez l'adresse dans la fiche du projet,
seul l'identifiant est conservé. Le site affiche une façade cliquable :
l'iframe `youtube-nocookie.com` n'est chargée qu'au clic, donc aucun script
tiers ni cookie au chargement.

**Vidéos de fond → sur le serveur.** MP4 ou WebM, envoyées depuis l'admin.
Réglage conseillé :

```bash
ffmpeg -i source.mov -t 5 -an -vf "scale=1920:-2" \
       -c:v libx264 -crf 26 -preset slow -movflags +faststart boucle.mp4
ffmpeg -i source.mov -t 5 -an -vf "scale=1920:-2" \
       -c:v libvpx-vp9 -crf 34 -b:v 0 boucle.webm
```

Trois à six secondes, **sans piste audio** (`-an`), 1 à 3 Mo. Le site les
charge à l'approche du scroll, jamais avant, et pas du tout si le visiteur a
demandé moins d'animations ou active l'économie de données.

## Dépannage

| Symptôme | Cause et remède |
| --- | --- |
| `/admin` renvoie en boucle vers la connexion, en local | `DEV_INSECURE_COOKIES=1` manque dans `.env` |
| « Jeton de sécurité invalide ou expiré » | la page est restée ouverte plus de 12 h : rechargez-la et renvoyez le formulaire |
| Les médias ne s'affichent pas | `UPLOADS_DIR` ne pointe pas au bon endroit, ou les droits du dossier |
| La base est vide après une mise à jour | `DATA_DIR` était resté dans le dossier déployé — étape 4 de la mise en ligne |
| Le site est en Times New Roman | les `.woff2` manquent dans `public/fonts` — `npm run polices` dit lesquels |
| `'pip' n'est pas reconnu` | vous suivez une ancienne version de ce guide : la conversion des polices ne passe plus par Python, mais par `npm run polices` |
| `Could not locate the bindings file` / `better_sqlite3.node` | `node_modules` a été construit avec une autre version de Node. Supprimez `node_modules` **et** `package-lock.json`, relancez `npm install` |
| `NODE_MODULE_VERSION ... was compiled against a different Node.js version` | même cause, même remède |
| Une image reste en noir et blanc | la version de sharp installée refuse la courbe ; le repli s'est déclenché, voir la console |
| `npm run dev` affiche des erreurs de script en console | vous avez modifié la politique de sécurité du contenu dans `src/middleware.ts` |
| Pas de fondu entre les panneaux de l'accueil | normal sur Firefox et Safari anciens : l'effet repose sur `animation-timeline`, que ces navigateurs n'ont pas encore. Le contenu apparaît alors au défilement, en fondu simple |
| Pas de transition entre les pages | idem : Chrome, Edge et Safari récents utilisent les transitions de document ; ailleurs, la page s'estompe et un fil avance en haut de l'écran |
| Du contenu reste invisible sur une page publique | `/js/site.js` ne s'est pas chargé. Un filet le rend visible au bout de 2,5 s ; regardez l'onglet « Réseau » de la console |
| Dans l'admin, un bouton « Enregistrer » ne réagit plus | il se débloque tout seul au bout de 15 s, ou dès que vous retouchez un champ du même formulaire |
| « Page trop ancienne » à l'enregistrement | l'onglet était ouvert depuis plus de trente jours. Rien n'a été enregistré : rouvrez la page |

---

# Annexes

## Ce que fait la sécurité

| Sujet | Mise en œuvre |
| --- | --- |
| Mot de passe | scrypt (`N=2^16, r=8, p=1`), ~340 ms par calcul, sel aléatoire |
| Sessions | jeton de 32 octets, **stocké haché** en SHA-256 ; cookie `HttpOnly; Secure; SameSite=Lax` |
| Durées | 7 jours glissants, 30 jours en absolu |
| Force brute | 5 essais / 15 min par adresse IP, 10 par compte, délai plancher de 600 ms |
| Énumération | un hachage factice est calculé quand le compte n'existe pas : le temps de réponse ne dit rien |
| CSRF | double soumission du jeton + vérification de l'en-tête `Origin` |
| Redirections | tout champ « retour » passe par `cheminInterne` — aucune redirection hors du site |
| Téléversements | taille vérifiée **avant** lecture, type reconnu **aux octets d'en-tête**, nom aléatoire, stockage hors du dossier web, `Content-Type` imposé par la route qui les sert |
| Injection SQL | requêtes préparées partout ; tables et colonnes modifiables sur liste blanche (`src/lib/admin.ts`) |
| XSS | échappement automatique d'Astro, aucun `set:html` sur du contenu de la base |
| En-têtes | CSP stricte en production, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'` |
| Formulaire public | pot de miel et délai minimal de remplissage, plutôt qu'un captcha inaccessible ; nom, organisation et adresse nettoyés de tout retour à la ligne avant de partir dans un en-tête de courriel |
| Taille des requêtes | plafond sur `Content-Length` avant toute lecture du corps : 512 Ko, 80 Mo sur la route de téléversement |
| Force brute, 3ᵉ garde | un compteur global de 100 échecs par quart d'heure, qui tient même si l'adresse d'origine n'est pas fiable |
| Messages d'erreur | seuls des codes transitent dans l'URL ; les phrases viennent d'une table (`MESSAGES` dans `src/lib/admin.ts`). Ni fuite du schéma, ni texte arbitraire affiché dans l'interface |
| Images | plafond de 50 Mpx à l'entrée de sharp ; le SVG n'est pas un format accepté |
| Admin | `no-store` et `noindex` sur toutes ses pages |

Le second facteur TOTP n'est pas activé : la colonne `totp_secret` existe
dans le schéma, il reste à brancher la vérification. Environ une demi-journée.

## Structure

```
.vscode/            réglages, extensions conseillées, débogage
src/
  pages/            index, projets/, studio, contact, 404
    admin/          login, tableau de bord, une page par page du site
    admin/api/      toutes les écritures
    media/          sert les fichiers téléversés
    api/contact.ts  réception du formulaire
  components/       Bandeau, Media, VideoFond, FacadeYoutube, Grain, Lignes
  layouts/          Base (site), Admin (back-office)
  lib/              db, auth, media, admin, motdepasse, schema, env
  styles/           tokens.css (la direction artistique), base.css,
                    transitions.css (le passage d'une page à l'autre), admin.css
scripts/            migrate, seed, creer-compte, sauvegarde, verif, polices
data/, uploads/     hors dépôt, et hors du dossier déployé en production
```

`src/styles/tokens.css` contient toute la direction artistique : cinq
valeurs d'un seul bleu plus un réactif, trois fontes, une échelle
typographique de rapport 1,25. **N'introduisez pas de couleur hors de cette
liste** — c'est la retenue chromatique qui fait le style, et `npm run verif`
refusera toute variable inconnue.

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run dev` | développement, rechargement à chaud |
| `npm run verif` | contrôles statiques — à lancer avant chaque mise en ligne |
| `npm run build` | construit `dist/` |
| `npm start` | démarre le serveur de production |
| `npm run migrate` | crée ou met à jour le schéma (sans danger, relançable) |
| `npm run seed` | contenus de départ — ne fait rien si du contenu existe |
| `npm run compte` | crée le compte, ou change le mot de passe |
| `npm run sauvegarde` | sauvegarde base + médias, purge à 30 jours |
| `npm run polices` | convertit les `.ttf`/`.otf` de `public/fonts` en `.woff2`, puis fait l'inventaire |
