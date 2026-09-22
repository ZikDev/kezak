# Ce qui a été corrigé

## Version 6.1 — la mise en page, revue

Deux retours après la v6, tous deux justes.

### 1. Le contenu s'était plaqué contre le bord gauche

La version 5 avait supprimé le conteneur centré du site, pour que les
informations du premier écran atteignent vraiment les coins. C'était le
bon geste pour un héros ou une séquence d'écrans. C'était le mauvais pour
une page qui se lit : la marge, la colonne de texte et le générique
partaient du bord gauche, leur largeur était bornée, et tout ce que
l'écran avait en plus restait vide à droite. Sur un moniteur large, une
page de texte poussée dans un coin.

Les blocs de lecture sont de nouveau bornés **et centrés**, sur un axe
unique : bande d'informations, vidéo, marge + colonne de texte,
générique, sorties. Le héros, lui, garde toute la largeur — c'est là que
l'on veut le titre dans le coin bas.

La même correction s'applique au **Studio**, bâti sur la même grille, et
au **Contact**, dont les deux colonnes s'écartaient l'une de l'autre
d'autant que l'écran était large (le plafond était posé à 1760 px, ce qui
laissait la plupart des écrans de bureau s'écarteler).

*Vérifié par rendu :* la planche est mesurée centrée à 1728 px (125 px de
part et d'autre), et le couple marge + texte tient le milieu de l'écran à
douze pixels près.

### 2. La galerie était un meuble

Chaque vue portait un fond gris, un filet d'un pixel, et deux flèches en
boîte posées contre l'image. Trois objets autour d'une photo — et une
photo qu'on regarde à travers un objet n'est plus regardée.

Tout cela est parti :

- **aucun fond, aucune bordure.** Le média est posé sur la planche. Le
  vide laissé autour d'une image verticale n'est plus dessiné : il est
  simplement vide ;
- **les flèches se tiennent aux deux bords de la page**, à mi-hauteur de
  l'image, dans une voie qui leur est réservée — une image panoramique ne
  passe jamais dessous. Elles sont réduites à leur trait, sans cadre ;
- **l'image est vue en entier**, quelles que soient ses proportions, et
  centrée dans la scène ;
- le numéro de vue passe sous l'image, au centre ;
- sur un téléphone, les flèches descendent de part et d'autre du
  compteur : elles auraient rogné l'image d'un tiers.

**Trois défauts trouvés en vérifiant, et corrigés :**

1. La voie des flèches était prise en marge *intérieure*. Un conteneur de
   défilement se coupe à son cadre et non à son contenu : la vue suivante
   réapparaissait donc dans la voie, sous la flèche, en bande verticale.
   Elle est prise en marge extérieure.
2. Le navigateur pose d'office un retrait de 40 px à gauche de toute
   liste. Il décalait chaque vue d'autant, et la voisine reparaissait par
   la droite — le même défaut, par une autre porte.
3. Sur un téléphone, la hauteur de la scène ne tenait compte que de la
   hauteur de l'écran : une image horizontale y flottait au milieu de
   trois cents pixels de vide, qu'il fallait faire défiler pour rien. Elle
   tient maintenant compte des deux dimensions.

*Vérifié par rendu à 1728, 1280 et 390 px, image horizontale, verticale et
panoramique :* aucune vue voisine visible, aucune flèche sur l'image, la
dernière position d'accroche correspond exactement à la fin du
défilement — donc aucune vue inatteignable.

**Deux ajustements au passage.** La vidéo YouTube d'en-tête est centrée
dans la planche au lieu d'être calée contre son bord gauche. Et une
galerie d'une seule vue ne réserve plus de voie aux flèches qui
n'existent pas : l'image prend toute la largeur.

---


## Version 6 — la galerie, les filtres, et l'audit qui a suivi

### 1. Les filtres de la page « Projets »

Les boutons de catégorie ne filtraient rien et ne changeaient jamais
d'aspect. Trois choses manquaient, et la troisième expliquait les deux
autres.

La liste des catégories était écrite **deux fois** : une fois à la
création d'un projet (« Motion & 3D »), une fois dans la page de tri
(« motion »). On enregistrait un libellé et on cherchait une valeur : la
comparaison échouait toujours. Les deux endroits lisent maintenant la
même liste, `CATEGORIES` dans `src/lib/admin.ts` — ajouter une catégorie
se fait à un seul endroit, et les deux écrans suivent.

Le tri lui-même se fait par l'adresse (`/projets?c=video`), ce qui le
rend partageable, indexable, et fonctionnel sans JavaScript. Le
paramètre est borné à trente caractères et confronté aux catégories
réellement présentes : une valeur inconnue n'affiche pas une page vide
mais la totalité des projets, avec une phrase qui le dit.

Le bouton actif porte enfin `aria-current="page"` et le fond plein de
l'accent — la même information pour l'œil et pour un lecteur d'écran.

### 2. La galerie devient un carrousel

Une seule image occupait toute la largeur disponible et débordait de
l'écran en hauteur. Le nouveau composant `Carrousel.astro` montre une vue
à la fois, dans une hauteur bornée à `clamp(15rem, 58svh, 34rem)` : jamais
plus de 58 % de la hauteur réelle de l'écran, jamais moins de 15 rem sur
un téléphone posé à l'horizontale.

L'image est cadrée en `contain` et non en `cover` : **on la voit
entière**, quelle que soit sa proportion, quitte à laisser du fond autour.
C'était la demande, et c'est l'inverse du réflexe habituel.

Le défilement repose sur `scroll-snap` — donc sur le navigateur, pas sur
un script. Sans JavaScript, la piste reste défilante au doigt, à la
molette et au clavier (elle est atteignable par tabulation, avec un rôle
et un intitulé) ; seules les flèches apparaissent en plus quand le script
a bien été chargé. Les flèches annoncent leur état avec `aria-disabled`
plutôt que de disparaître, et `prefers-reduced-motion` coupe le
défilement animé.

Les vues sont de trois natures : image, vidéo déposée sur le site, ou
vidéo YouTube. C'est ce qui a demandé de toucher à la base — voir le
point 5.

**Les images de la galerie sont en couleur.** Le traitement bichrome
reste la signature du site, mais il était appliqué à tout ce qui montait
dans la médiathèque. Le formulaire d'ajout à la galerie force désormais
la couleur.

> **À savoir :** une image déjà téléversée en bichromie ne peut pas être
> remise en couleur — la conversion s'est faite à l'enregistrement, et
> l'original n'est pas conservé. Les vues concernées sont à **téléverser à
> nouveau** depuis la nouvelle section galerie.

### 3. La vidéo YouTube d'une fiche projet

Elle prenait toute la largeur de la colonne. Elle est maintenant bornée
par sa hauteur : `min(100%, 52rem, hauteur × 16/9)` — elle grandit
jusqu'à ce que l'un des trois plafonds soit atteint, et pas au-delà.

L'image d'attente a disparu : la façade reprend la vignette de YouTube
et laisse son interface par défaut apparaître au clic. Le bouton de
lecture est devenu un **lien** vers la vidéo : sans JavaScript, il ouvre
YouTube dans un onglet au lieu de ne rien faire.

*Réserve honnête, puisque la vignette vient de YouTube :* elle est
chargée dès l'affichage de la page, donc `i.ytimg.com` voit passer le
visiteur avant tout clic. C'est le prix de l'interface d'origine, qui
était la demande. Une vignette recopiée sur le serveur supprimerait cette
requête — dites-le si vous le souhaitez.

### 4. Ajouter à la galerie depuis la fiche du projet

La section « Galerie » de `/admin/projets/…` propose trois entrées
indépendantes : téléverser un fichier, reprendre un média déjà présent
sur le site, ou coller une adresse YouTube. Chacune est un formulaire
complet — pas d'onglet, pas d'état à mémoriser, rien qui se perde si la
page est rechargée.

Le lien YouTube accepte tout ce qu'on peut réellement copier : l'adresse
longue, l'adresse courte `youtu.be`, un `shorts/`, un `live/`, un
`embed/`, ou l'identifiant seul.

### 5. La base de données change de forme

La galerie ne pouvait contenir que des médias : la colonne `media_id`
était obligatoire. Elle devient facultative, et une colonne `youtube`
apparaît à côté.

SQLite ne sait pas retirer une contrainte `NOT NULL` : il faut
reconstruire la table. C'est l'objet de `src/lib/migrations.mjs`, nouveau
fichier, qui s'exécute tout seul au démarrage du serveur. **La mise à
jour ne demande donc aucune manipulation** — mais elle touche vos
données, et c'est la première fois : faites la sauvegarde indiquée dans
le tutoriel avant de redémarrer.

---

## L'audit de la version 6

### Sécurité

**1. La migration pouvait effacer des données — grave, et de mon fait.**
La première version du fichier de migration vérifiait « est-ce déjà
fait ? » **en dehors** de la transaction qui faisait le travail. Deux
processus démarrant ensemble — ce qui arrive à chaque redémarrage
applicatif — pouvaient tous deux conclure « non » ; le second
reconstruisait alors la table par-dessus le résultat du premier, et
comme sa copie remplit la colonne `youtube` avec une valeur vide,
**toutes les vidéos YouTube de la galerie disparaissaient** — invisibles
sur le site, et impossibles à supprimer depuis l'admin.

L'état des migrations est désormais tenu par `PRAGMA user_version`, lu et
écrit **dans** une transaction ouverte en `BEGIN IMMEDIATE` : le second
processus attend, relit la version, constate qu'il n'y a rien à faire et
ressort. *Vérifié par exécution sur une vraie base : la migration rejouée
dix fois ne change rien, les entrées YouTube survivent, une base neuve est
reconnue comme déjà à jour, et un contrôle des clés étrangères est passé
avant de valider — si une ligne était devenue orpheline, la transaction
serait annulée.*

**2. Le contrôle anti-CSRF était écrit à l'envers — sérieux.**
Il énumérait les types de contenu à vérifier (`form`, `json`) et laissait
passer le reste. Un POST en `text/plain`, ou sans en-tête de type du
tout, n'était soumis à aucun contrôle de jeton ; et comme le contrôle
d'origine ne s'applique que si l'en-tête « Origin » est présent, les deux
trous coïncidaient exactement. La route de déconnexion, qui ne lit jamais
son corps, était atteignable ainsi. Le contrôle est inversé : hors
téléversement, **tout** exige le jeton.

**3. Le plafond de taille se contournait — sérieux.**
La version 5 posait une limite sur l'en-tête `Content-Length` et le
disait : une requête découpée en morceaux n'annonce pas sa taille. Cette
réserve est levée. Le corps est lu par `corpsBorne`, qui compte les
octets au fil de la lecture et coupe la connexion au dépassement, sans
avoir rien gardé.

**4. Un lien « YouTube » pouvait venir de n'importe où — mineur.**
L'extraction se contentait de chercher `v=` dans l'adresse : n'importe
quel site contenant ce fragment était accepté, l'identifiant extrait
était inoffensif mais la vue s'affichait vide. Une liste d'hôtes admis a
été ajoutée. *Vérifié par exécution : les six formes d'adresse
légitimes passent ; un autre site, un sous-domaine trompeur
(`youtube.com.mechant.example`), un `javascript:`, et deux tentatives
d'injection de balise ou d'échappement d'attribut sont refusés.*

**5. Le média repris depuis la médiathèque est vérifié avant insertion.**
Sans quoi la clé étrangère refusait l'écriture avec un message SQLite
illisible affiché à l'administrateur.

### Fonctionnement

**6. Les vidéos YouTube étaient invisibles dans l'admin.** La requête qui
liste la galerie joignait la table des médias en jointure stricte : une
ligne sans média — donc toute ligne YouTube — disparaissait du résultat.
Passée en `LEFT JOIN`, avec la condition qui va avec.

**7. La position du carrousel dépendait d'une marge.** Le calcul mêlait
`offsetLeft`, mesuré depuis le cadre, et `scrollLeft`, mesuré depuis le
bord intérieur : les deux diffèrent exactement de la marge de la piste,
que j'avais ajoutée pour que l'anneau de mise au point d'une vidéo ne soit
pas rogné. La première vue sert maintenant d'origine, et la différence
s'annule — quelle que soit la marge, aujourd'hui ou plus tard. *Vérifié
par exécution sur quatre positions.*

**8. La touche flèche ne doit pas voler le clavier.** Dans le carrousel,
les flèches font défiler ; mais si le doigt est dans un champ, une vidéo
ou un sélecteur, elles lui reviennent.

### Responsive

Reprise complète des écrans étroits sur les pages touchées : la fiche
projet (voile de titre calculé en pixels plutôt qu'en pourcentage, vidéo
alignée à gauche plutôt qu'étirée), la page des projets (les filtres
passent en défilement horizontal plutôt qu'en pile), la section galerie
de l'admin (les trois formulaires d'ajout passent en colonne sous
48 rem), et la hauteur du carrousel, exprimée en `svh` là où le
navigateur le sait — c'est la hauteur réellement visible, barres du
navigateur déduites, celle qui compte sur un téléphone.

Le menu de l'admin et celui du site restent dépliés quand le script ne
s'est pas chargé : un menu replié par du CSS et déplié par du JavaScript
absent, c'est un site sans navigation.

---

## Version 5.1 — ce que la mise en ligne a révélé

Quatre corrections, toutes venues du passage en production. Aucune ne
pouvait se voir en local : elles tiennent toutes au proxy qui se trouve
devant l'application chez l'hébergeur.

**1. Impossible de se connecter à l'administration — bloquant.**
Toute soumission de formulaire répondait *Cross-site POST form submissions
are forbidden*, sur une page blanche, en anglais. C'est la protection
anti-CSRF intégrée d'Astro 5, active par défaut : elle compare l'en-tête
« Origin » à l'URL de la requête, **protocole compris**. Or le proxy
termine le HTTPS et transmet la requête en clair : le navigateur annonce
`https://kezak.ch`, l'application se croit sur `http://kezak.ch`, les deux
diffèrent, tout est refusé. La connexion à l'admin et le formulaire de
contact étaient touchés.

Elle est désactivée dans `astro.config.mjs`, au profit de celle du
middleware, qui était déjà là et qui en fait davantage : jeton à double
soumission comparé en temps constant, contrôle d'origine sur le nom
d'hôte seul, cookies en `SameSite=Lax`, et cela sur **toutes** les
méthodes mutantes là où Astro ne regarde que trois types de contenu. Le
raisonnement complet est écrit dans le fichier de configuration, à
l'endroit où la décision se lit.

**2. Le contrôle d'origine du middleware aurait échoué ensuite — sérieux.**
Il comparait l'hôte de l'en-tête « Origin » au seul hôte de la requête.
Si le proxy présente à l'application un hôte interne plutôt que le vrai
nom de domaine, un envoi parfaitement légitime devenait « Origine
refusée » — la même panne, avec un autre message. Le middleware accepte
désormais deux hôtes : celui de la requête et celui de `SITE_URL`.
*Vérifié en exécutant la logique sur sept cas : les quatre situations
légitimes passent, les trois tentatives depuis un autre site sont
refusées, y compris un sous-domaine trompeur du genre
`kezak.ch.mechant.example`.*

**3. Les adresses canoniques annonçaient du HTTP — mineur.**
Même cause : `Astro.url.href` commence par `http://` derrière le proxy.
Les balises `canonical` et `og:url` donnaient donc une adresse non
sécurisée, ce qui brouille le référencement et les aperçus de partage.
Elles repartent maintenant du domaine configuré, et n'empruntent à la
requête que le chemin et les paramètres.

**4. `www.kezak.ch` renvoie vers `kezak.ch` — ajout.**
La méthode habituelle passe par un `.htaccess`, qui ne s'applique pas à
un site Node.js. La redirection est donc faite par le middleware, en 301,
en conservant chemin, paramètres et ancre. Elle ne regarde que le préfixe
`www.` : l'URL de prévisualisation de l'hébergeur et le développement
local ne sont pas concernés. Sans quoi le site aurait répondu sous deux
adresses — contenu dupliqué pour les moteurs, et deux sessions distinctes
pour qui se connecte à l'administration.

**Au passage, deux dépendances relevées.** `sharp` et `nodemailer` sont
les deux seules bibliothèques auxquelles parviennent des données non
maîtrisées — les octets d'une image téléversée, le nom et l'adresse tapés
dans le formulaire de contact. Elles passent en 0.35.4 et 10.x, les
versions corrigées. L'import de nodemailer est rendu insensible à la
façon dont le paquet est publié, CommonJS ou ESM.

Astro reste en 5 : les failles annoncées passent toutes par des
fonctionnalités que ce site n'utilise pas — `define:vars`, attributs
étalés, directives `transition:*`, slots nommés dynamiques, îlots,
option `base`, composant `Image` d'`astro:assets` — ce qui a été vérifié
fichier par fichier. La montée en version 7 demande deux paliers majeurs
et une session dédiée.

---

## Version 5

Quatre demandes, plus un audit complet de sécurité et d'affichage. Le
détail est plus bas ; voici d'abord ce qui change quand on regarde le
site.

### 1. La page occupe vraiment la largeur de l'écran

La grille n'est plus une boîte centrée : la gouttière est la seule marge,
et elle grandit avec l'écran (20 px sur un téléphone, 80 px au-delà de
1440 px). Les quatre informations du premier écran sont donc posées dans
les quatre coins réels, sur un téléphone comme sur un 32 pouces, parce
que l'écart vertical vaut exactement l'écart horizontal. Seuls les blocs
de lecture restent bornés — par la mesure typographique, posée sur les
paragraphes, pas par le conteneur.

Trois corrections d'échelle sont venues de l'audit :

- **Le formulaire de contact et ses coordonnées s'écartaient de plus de
  deux mille pixels** au-delà de 1760 px — deux blocs qu'on ne peut plus
  regarder ensemble. Passé ce seuil, l'ensemble se plafonne et se centre.
- **Les images des grandes vignettes étaient floues sur un grand écran** :
  la grille passe à trois colonnes au-delà de 110 rem, mais l'attribut
  `sizes` annonçait toujours 480 px. Le navigateur choisissait une
  variante trop petite et l'agrandissait de moitié.
- **Un mot plus large que l'écran était coupé sans recours.** Seuls les
  titres avaient une règle de césure ; ailleurs, `overflow-x: hidden`
  ne supprimait pas le débordement, il rendait ses dernières lettres
  définitivement illisibles et non sélectionnables.

### 2. Le fondu au scroll entre les panneaux

Il est en CSS pur, piloté par la position de défilement
(`animation-timeline: view()`) : un voile de la couleur du site, opaque
quand un panneau entre et quand il sort, transparent quand il occupe
l'écran. Deux panneaux qui se suivent produisent un vrai fondu enchaîné,
qui suit le doigt au lieu de se déclencher par paliers. Le contenu dérive
légèrement en décalé — c'est ce décalage qui donne la profondeur.

**Et il ne fonctionnait dans aucun navigateur.** `.ecran` portait
`overflow: hidden`, ce qui fait de la section un conteneur de
défilement ; la chronologie se calait donc sur cette section, qui ne
défile jamais. Un seul mot à changer — `overflow: clip` rogne
exactement pareil sans créer de conteneur — et l'effet apparaît. C'est
la correction la plus importante de cette version : une fonctionnalité
entièrement écrite, jamais exécutée.

### 3. La transition entre deux pages, qui s'allonge si la suite tarde

Deux mécanismes, dans cet ordre.

Là où le navigateur sait faire les **transitions de document** (Chrome,
Edge, Safari récents), c'est lui qui travaille : il garde l'image de la
page quittée à l'écran jusqu'à ce que la suivante soit prête à peindre.
La transition dure donc exactement le temps du chargement et se prolonge
d'elle-même si la page met du temps à venir. Le `link rel="expect"` du
gabarit lui dit ce qu'il doit attendre.

Ailleurs — Firefox aujourd'hui — un repli : la page quittée s'estompe
jusqu'à 22 % sans jamais disparaître (un écran vide donne l'impression
d'une panne), et la nouvelle arrive en fondu. Rien ne referme cet état
avant l'arrivée de la page suivante : une destination lente étire
simplement l'attente. Le fil d'attente en haut de l'écran double le tout.

### 4. L'administration

Le tiroir de navigation groupé par rubrique, le fil d'Ariane, le lien
« Voir la page », le sommaire de section, la barre d'enregistrement qui
se colle en bas dès qu'un champ change, l'aperçu du média choisi,
l'aperçu du fichier avant envoi, les compteurs de caractères,
`Ctrl + S`. Et les corrections de l'audit, plus bas — dont deux qui
faisaient perdre du travail.

Trois réorganisations de fond :

- **Les textes de la page Projets étaient éditables dans « Général ».**
  Ils s'affichent sur `/projets` : ils sont maintenant sur
  `/admin/projets`, en section 00. Idem pour la mention en marge du
  générique, qui apparaît sur chaque fiche projet.
- **Les catégories s'affichaient en brut.** On choisissait « Motion & 3D »
  à la création et on relisait « motion » dans la fiche : la liste est
  désormais écrite une seule fois, dans `src/lib/admin.ts`.
- **La médiathèque dit où chaque média est utilisé**, et la confirmation
  de suppression nomme les emplacements qui deviendront vides.

---

## L'audit — ce qui a été trouvé et corrigé

### Sécurité

**1. Détournement de la réponse au formulaire de contact — sérieux.**
`replyTo` était assemblé à la main : `${nom} <${email}>`. Le nom n'étant
filtré que de ses caractères de contrôle, un visiteur pouvait envoyer
`Kezak <compta@attaquant.tld>, Victor` et obtenir **deux** adresses de
réponse. Au clic sur « Répondre », le devis serait parti chez les deux.
Corrigé en passant un objet `{ name, address }` à nodemailer, qui se
charge alors de l'échappement.

**2. Injection d'en-tête de courriel — sérieux.**
La fonction de nettoyage du formulaire de contact laissait passer le
retour chariot et le saut de ligne — ce qui est voulu dans le corps d'un
message, et dangereux dans un en-tête : ce sont eux qui permettent d'en
ajouter un. Un nom valant `Victor⏎Bcc: ailleurs@exemple.tld` aurait tenté
d'envoyer une copie cachée depuis le domaine. Nodemailer replie
normalement les en-têtes, mais une protection qui dépend du comportement
interne d'une dépendance n'en est pas une : le nom, l'organisation et
l'adresse passent maintenant par `nettoyerLigne`. Au passage, la copie
locale de la fonction de nettoyage a disparu — elle divergeait déjà de
l'originale.

**3. Déni de service par corps de requête — sérieux.**
Le contrôle anti-CSRF lit le corps pour y trouver le jeton, et il le fait
avant de savoir qui envoie. Sans plafond, un corps d'un gigaoctet était
mis en mémoire puis refusé : quelques requêtes simultanées suffisaient à
faire tomber le serveur. Plafond posé sur `Content-Length` — 512 Ko, et
80 Mo sur la seule route de téléversement. *Réserve honnête : une requête
en « chunked » n'annonce pas sa taille ; le plafond définitif est celui
du serveur placé devant l'application.*

**4. Calculs de mot de passe illimités — sérieux.**
Chaque tentative de connexion coûte 64 Mo de mémoire et ~300 ms, y
compris pour un compte inexistant (c'est voulu : le temps de réponse ne
doit pas révéler si le compte existe). Les deux compteurs existants ne
tenaient pas : celui par compte se contourne en changeant d'adresse
e-mail, celui par IP en changeant l'adresse annoncée — derrière un proxy
mal configuré, `X-Forwarded-For` est ce que l'appelant veut. Un troisième
compteur, global, a été ajouté : cent échecs par quart d'heure. Une seule
personne se connecte à ce site.

**5. Hameçonnage dans la vraie interface — sérieux.**
Le paramètre `err` de l'URL était affiché tel quel dans le bandeau
d'erreur de l'admin. Faire ouvrir
`kezak.ch/admin?err=Session+expirée,+reconnectez-vous+sur…` affichait
cette phrase dans la vraie interface, sur le vrai domaine, avec la vraie
mise en forme. Le texte était échappé — donc pas de script — mais c'est
un support d'hameçonnage crédible. Seul un **code** transite désormais
dans l'URL, et une table de messages donne la phrase ; un code inconnu
affiche une formule neutre.

**6. Fuite du schéma de la base — mineur.**
Le message brut de SQLite (`UNIQUE constraint failed: projets.slug`)
finissait dans la barre d'adresse. Il reste dans le journal du serveur,
où il sert.

**7. Bombe d'image — mineur.**
Aucune limite explicite de pixels n'était posée à sharp : un PNG de
16 000 × 16 000 tient dans les 15 Mo autorisés et réclame près d'un
gigaoctet à chaque décodage — et il y a un décodage par largeur produite.
Plafond à 50 Mpx, soit 8600 × 5800.

**8. Jeton anti-CSRF et changement de privilège — mineur.**
Il survivait à la connexion et à la déconnexion. Il est maintenant
renouvelé à l'une et supprimé à l'autre.

**9. Les refus partaient sans en-têtes de sécurité — mineur.**
Le 413, les refus d'origine, la page « jeton périmé » : tous renvoyés
avant le bloc qui pose la politique de sécurité du contenu. La page
d'erreur, qui est du HTML, partait donc sans CSP et sans
`frame-ancestors`.

**10. `..` acceptée par le filtre de suppression de fichiers — mineur,
non exploitable.** Le motif `^[A-Za-z0-9._-]+$` laisse passer `..`.
Aucun chemin d'écriture ne permet d'y mettre cette valeur — les noms sont
générés par le serveur — mais la route qui sert les médias, elle, l'écarte
explicitement. Les deux sont maintenant alignées.

**11. Gonflement de base à coût nul — mineur.**
Le formulaire de contact bornait la longueur de chaque case cochée, pas
leur nombre : cent mille champs `besoins` produisaient une ligne de
plusieurs centaines de kilo-octets. Bornés à dix.

### Fonctionnement

**12. Le fondu au défilement ne s'exécutait nulle part — bloquant.**
Voir le point 2 plus haut. `overflow: hidden` → `overflow: clip`.

**13. Tout le contenu à fondu pouvait rester invisible — bloquant.**
Le CSS armait ses fondus sur `@media (scripting: enabled)`, qui décrit
la capacité du navigateur, pas le succès du chargement. Si `site.js`
renvoyait 404, expirait sur un réseau lent ou levait une exception,
**les cartes de projet, les prestations et les blocs de l'accueil
restaient à opacité zéro, définitivement et sans le moindre signe** — la
page Projets se réduisant à un titre et des filets. Le script pose
maintenant une classe dès sa première ligne, et le CSS prévoit un filet :
au bout de deux secondes et demie, tout devient visible.

**14. L'accueil n'avait plus aucune navigation sans JavaScript —
bloquant.** Le bandeau y est masqué et rendu non cliquable en dur, et
seul le script le ramenait. Même remède, et la règle d'animation de
secours rétablit aussi `pointer-events`, sans quoi il serait revenu
visible mais mort.

**15. Le verrou anti-double-clic de l'admin pouvait condamner un
formulaire — bloquant.** Enchaînement : on modifie deux sections, on
enregistre la seconde, le navigateur demande « quitter la page ? » parce
que la première est encore ouverte, on répond « rester » — la navigation
est annulée, **rien n'est parti, et le bouton ne répond plus jamais**.
Sans message, et avec une interface affichant « enregistré ». Le verrou
se relâche maintenant au bout de quinze secondes, au retour sur l'onglet,
ou dès qu'on retouche le formulaire ; et l'avertissement de sortie ne
parle plus que de ce qui reste ouvert **ailleurs**.

**16. Le jeton anti-CSRF expirait avant la session — bloquant.**
Douze heures, jamais renouvelé, contre une semaine pour la session : un
onglet d'admin laissé ouvert la veille rejetait l'enregistrement du
lendemain, avec une page de texte brut pour toute explication — et le
conseil qu'elle donnait ne marchait pas, l'admin étant en `no-store`. Le
jeton est maintenant reposé à chaque page, et le refus affiche une vraie
page avec un bouton de retour.

**17. L'aperçu du fichier choisi ne marchait qu'en développement —
sérieux.** `blob:` manquait dans la politique de sécurité de production.
Un cadre vide en ligne, une erreur dans une console que personne n'ouvre.

**18. Un cadre d'aperçu vide s'affichait en permanence — sérieux.**
`display: grid` l'emporte sur la règle `[hidden] { display: none }` du
navigateur, quelle que soit la spécificité. Sous chaque champ de fichier,
un rectangle bordé contenant un tiret, qui se lit comme une image
manquante.

**19. Le formulaire de contact jetait le message en cas d'erreur —
sérieux.** Le serveur répond par une redirection : la page se
reconstruisait et les quatre mille caractères tapés avaient disparu. La
validation du navigateur évite maintenant la plupart des allers-retours,
et le reste est gardé le temps de l'aller-retour dans le stockage de
session — sans rien envoyer nulle part, et effacé dès l'envoi réussi.

**20. La confirmation d'enregistrement n'était jamais vue — sérieux.**
Le serveur renvoie vers la section concernée : la page s'ouvrait à
mi-hauteur et le message restait au-dessus de la ligne de flottaison,
pour s'effacer six secondes plus tard. Il est maintenant collé en haut,
et il reçoit le focus — une zone « aria-live » n'annonce que ce qui y
apparaît après son existence, et ce message-là vient du serveur : il
n'était annoncé nulle part.

**21. Le sommaire de la page Messages — sérieux.**
Construit à partir de n'importe quelle étiquette de section, il se
remplissait des dates des messages. Il ne prend plus que les titres
d'en-tête de section, plafonnés à douze, espaces normalisés.

**22. Un fichier trop lourd était signalé mais partait quand même —
mineur.** Deux minutes de téléversement pour rien. Le bouton est
maintenant désactivé, avec une limite par type : 15 Mo pour une image,
60 Mo pour une vidéo.

**23. Aucun retour pendant un envoi — sérieux.**
`aria-busy` était posé et aucune règle de style ne le regardait :
l'envoi d'une vidéo de 55 Mo laissait la page parfaitement immobile
pendant une minute. Les boutons annoncent maintenant « Enregistrement… ».

**24. La hauteur des zones de texte était figée avant le chargement des
polices — sérieux.** Le texte était mesuré en Georgia puis rendu en
Spectral : la zone restait trop courte, avec une barre de défilement
interne sur le seul écran où l'on vient relire un paragraphe. Recalculée
à `document.fonts.ready` et au redimensionnement.

**25. Les compteurs de caractères manquaient là où ils servaient —
sérieux.** Ils n'existaient que sur trois champs de la page de création,
dont « Année », où ils affichaient « 20 / 20 ». Ils sont maintenant sur la
description de référencement, le chapeau et le résumé, reliés au champ
par `aria-describedby`, et absents sous quarante caractères.

**26. Le saut vers un écran plein tombait 78 px trop bas — sérieux.**
`scroll-margin-top` était appliqué à tout élément porteur d'un
identifiant, y compris aux sections plein écran : après le bouton
« Descendre », on voyait une bande de l'écran précédent en haut et le bas
de l'écran visé passait sous la ligne de flottaison.

**27. Le menu mobile tombait au bon endroit par coïncidence — mineur.**
Le `backdrop-filter` du bandeau en fait le bloc conteneur de ses
descendants fixés ; le menu était positionné par rapport au bandeau, pas
à la fenêtre, et toute modification de la hauteur du bandeau l'aurait
décalé du double. Il est désormais en `absolute; top: 100%`.

**28. Le bouton du menu ne changeait jamais d'apparence — mineur.**
Une transition était déclarée, aucune règle ne posait jamais la
transformation. Les deux traits se croisent maintenant.

### Accessibilité et lisibilité

**29. Texte clair sur photo claire — sérieux.** Le numéro de planche des
vignettes était posé en blanc directement sur l'image, sans le moindre
assombrissement : sur un projet au coin haut-gauche clair — un ciel, un
mur blanc, de la neige — il était invisible. Bande sombre ajoutée sur les
vignettes et en haut des en-têtes de projet, voile renforcé sur les
écrans projet de l'accueil.

**30. Les voiles horizontaux sur écran étroit — sérieux.** Calculés pour
un écran large, où le texte occupe le premier tiers ; sur un téléphone le
même dégradé s'étale sur toute la largeur et la fin de chaque ligne
reposait sur la partie claire de l'image. Un second voile, vertical,
prend le relais sous 62 rem.

**31. Gris trop clair à 13 px — sérieux.** Le jeton portait pourtant sa
propre consigne (« ≥ 24 px uniquement »), respectée nulle part : la
catégorie sous chaque projet, les périodes du parcours et tout le pied de
page passaient de 3,4:1 à… rien du tout en plein soleil. Remplacé par un
gris à 9,3:1.

**32. On ne voyait pas où commençait un champ — sérieux.** Bordure à
1,4:1 sur le formulaire de contact, 1,6:1 dans l'admin, sans aucun autre
indice visuel. Un jeton dédié, `--filet-champ`, tient les 3:1 exigés pour
la limite d'un composant quand c'est elle qui l'identifie.

**33. Le lien d'évitement de l'admin était illisible — sérieux.** Le
thème clair redéfinissait la couleur d'accent mais pas celle du texte
posé dessus : 2,9:1.

**34. Le tiroir de navigation ne retenait pas le clavier — sérieux.**
Une tabulation depuis le dernier élément emmenait dans la page
principale, recouverte par un rideau opaque. Le reste de la page devient
inerte, et la tabulation boucle.

**35. Étiquettes à 11 px en capitales espacées — sérieux.** C'est
l'étiquette de chaque champ d'un outil de travail, pas une mention de bas
de page.

**36. Cibles tactiles à 34–36 px — mineur** sur les commandes les plus
manipulées au doigt (↑, ↓, Supprimer, sommaire). Portées à 40–44 px.

**37. Flèches de réordonnancement sans contexte — mineur.** Douze fois
« Monter, bouton » dans une même section. Elles nomment maintenant ce
qu'elles déplacent, et la confirmation de suppression aussi.

**38. Options de média illisibles — mineur.** Sans texte alternatif, la
liste affichait `#14 — a3f9c2e1.webp`. À défaut d'alternative, elle donne
maintenant le type et les dimensions.

**39. Champ obligatoire signalé par un astérisque jamais expliqué —
mineur.** Le mot est écrit.

**40. Réserve de hauteur unique pour tous les blocs différés — mineur.**
800 px pour un encart de 180 px comme pour le corps d'une page projet :
la page raccourcissait de 600 px dans un cas, s'allongeait de plusieurs
milliers dans l'autre. Deux variantes, court et long.

---

## Ce que je n'ai toujours pas pu vérifier

Le registre npm reste bloqué dans l'environnement où j'ai travaillé : je
n'ai pas pu lancer `npm install`, donc ni `astro build`, ni le site en
vrai.

Ce qui **a** été exécuté et vérifié pour cette version : le contrôle
syntaxique de tous les fichiers JavaScript ; le contrôle de types
TypeScript sur les douze fichiers `.ts` (seules subsistent les erreurs
attendues en l'absence de `node_modules` : types de Node manquants) ;
l'équilibre des balises des 28 fichiers `.astro` ; `npm run verif` sans
erreur ; les requêtes d'usage des médias rejouées dans SQLite sur le vrai
schéma ; les fonctions de nettoyage testées sur des entrées malveillantes ;
les rapports de contraste recalculés pour chaque couple de couleurs cité.

Reste possible au premier `npm run build` : une erreur de syntaxe propre
au compilateur Astro. Le message indiquera le fichier et la ligne.

Et trois points qui ne se tranchent qu'en navigateur, signalés ici plutôt
que passés sous silence :

- Le comportement exact d'un `@view-transition` imbriqué dans une requête
  média (mouvement réduit). Un filet indépendant a été ajouté, qui ne
  dépend pas de sa prise en charge.
- Le moment précis où le filet de deux secondes et demie se déclenche à
  l'intérieur d'un bloc en `content-visibility: auto`. Sans conséquence :
  le bloc finit visible dans tous les cas.
- Le rendu de la transition de repli sur Firefox, qui dépend de la
  fenêtre entre `pagehide` et le remplacement de la page.

---

## Version 4 — les polices sans Python

**L'étape 6 demandait `pip install fonttools brotli`.**
C'est la méthode standard pour convertir une fonte en WOFF2, mais elle
suppose Python installé. Sur une machine Windows neuve, il ne l'est pas :
la commande répond « 'pip' n'est pas reconnu ». Faire installer tout un
langage pour convertir sept fichiers, c'était une mauvaise idée de ma part.

La conversion se fait maintenant avec Node, déjà présent puisque le site
tourne dessus :

```bash
npm run polices
```

`scripts/polices.mjs` lit les `.ttf`/`.otf` déposés dans `public/fonts`,
les convertit en `.woff2`, **renomme vers les sept noms attendus** (les
fonderies écrivent `Lineal_Thin`, `Lineal Thin`, `Cutive_Mono`… le CSS, lui,
attend un seul orthographe), ignore ce qui existe déjà, affiche le poids
avant/après, et termine par l'inventaire de ce qui manque. Relancée sans
rien à convertir, elle ne fait que l'inventaire.

Le convertisseur (`wawoff2`, le portage WebAssembly de l'outil officiel de
Google) est déclaré en `devDependencies` : `npm install` le pose, il n'y a
aucune commande supplémentaire.

L'étape 6 du guide a été réécrite en trois temps — télécharger, convertir,
vérifier — avec deux précisions qui manquaient : **regarder d'abord dans
l'archive de la fonderie**, qui contient souvent déjà un dossier `webfonts`,
et **supprimer les `.ttf` une fois convertis**. Pour qui ne veut rien
installer, transfonter.org est indiqué en repli. Et `'pip' n'est pas
reconnu` est entré dans le tableau de dépannage.

---

## Version 3 — compatibilité Node 24

**`better-sqlite3` ne se chargeait pas sous Node 24.**
La version 11 fournit un binaire précompilé par version de Node, et il n'en
existe pas pour Node 24 (ABI 137) : `npm install` se terminait sans erreur
visible, puis `npm run seed` échouait sur
« Could not locate the bindings file ».

Trois corrections :

1. **`better-sqlite3` passe en v13**, qui utilise N-API — un binaire unique
   valable pour toutes les versions de Node, présentes et à venir. La panne
   ne peut plus se reproduire au prochain Node.
2. **Le `postinstall` a été retiré.** Il lançait la migration pendant
   `npm install` et avalait l'échec dans un simple avertissement, noyé au
   milieu de la sortie de npm — c'est pour ça que le problème n'est apparu
   que trois étapes plus tard. La base se crée de toute façon toute seule au
   premier démarrage.
3. **Le chargement de la base explique désormais la panne** au lieu d'afficher
   une trace de trente lignes : version de Node détectée, et les deux
   commandes exactes à taper, adaptées à Windows comme à macOS.

`npm run verif` vérifie en plus la version de Node et charge réellement
`better-sqlite3` et `sharp` : la prochaine incompatibilité de ce type sera
signalée avant de faire perdre du temps.

---

# Ce qui avait été corrigé en version 2

Revue complète de la version précédente. Treize défauts trouvés, tous
corrigés. Les quatre premiers auraient cassé quelque chose en vrai.

---

## Fonctionnement

**1. Le `.env` n'était pas lu en production — bloquant.**
Astro lit le `.env` à la *construction*, pas à l'*exécution*. Le serveur
compilé ne voyait donc ni `DATA_DIR`, ni `UPLOADS_DIR`, ni le SMTP : la base
et les médias seraient retombés dans le dossier déployé, et auraient été
effacés à la première mise à jour du code. Ajout de `src/lib/env.mjs`, qui
charge le fichier au démarrage via `process.loadEnvFile`, importé par la
couche données, la couche médias, le middleware et les scripts.
*Vérifié : `DATA_DIR` est bien lu à l'exécution.*

**2. La route des médias renvoyait un flux Node invalide — bloquant.**
`new Response(createReadStream(...))` : un flux Node n'est pas un corps de
réponse au sens du standard. Selon la version de Node, la route renvoyait un
corps vide ou levait une erreur — donc **aucune image ne s'affichait**.
Corrigé avec `Readable.toWeb()`. J'ai ajouté au passage la méthode `HEAD`,
que les lecteurs vidéo appellent avant de demander une plage d'octets.

**3. La politique de sécurité du contenu cassait `npm run dev`.**
`script-src 'self'` interdit les scripts en ligne et le WebSocket du
rechargement à chaud, qu'Astro utilise en développement. La CSP est
désormais stricte en production et desserrée en développement — et la
version desserrée n'est jamais envoyée en ligne.

**4. Ajouter une image à la galerie faisait planter l'admin.**
Le bouton « Ajouter un emplacement » insérait une ligne sans `media_id`,
alors que la colonne est `NOT NULL`. Le bouton a disparu : la galerie se
remplit par l'envoi de fichiers, ce qui est le seul geste qui a du sens.

**5. La bichromie pouvait échouer silencieusement.**
Selon la version de sharp, `greyscale()` peut sortir une image à un seul
canal — et `linear()` avec trois valeurs échoue alors, faisant échouer tout
le téléversement. Ajout de `toColourspace('srgb')`, et repli en noir et
blanc simple si la courbe ne passe pas, avec un message dans la console.

**6. Une page projet introuvable renvoyait une réponse vide.**
Elle affiche maintenant la vraie page 404 du site, via `Astro.rewrite`.

**7. Expressions régulières écrites avec des caractères de contrôle bruts.**
Elles fonctionnaient, mais étaient invisibles dans l'éditeur — impossibles à
relire, donc à maintenir. Réécrites en `\u0000` explicites.

---

## Sécurité

**8. Redirections ouvertes.**
Le champ caché `retour` de chaque formulaire d'admin était repris tel quel
dans la redirection : un lien piégé pouvait renvoyer l'administrateur vers
un site tiers juste après une action réussie, au moment où il fait le plus
confiance à ce qu'il voit. Ajout de `cheminInterne()`, appliqué aux cinq
routes d'écriture et aux deux points d'entrée de la connexion.

**9. Téléversement lu en mémoire avant d'être refusé.**
La taille n'était contrôlée qu'après `arrayBuffer()`. Un envoi de 500 Mo
était donc entièrement chargé en mémoire avant le refus — de quoi faire
tomber le serveur. La taille est maintenant vérifiée sur `File.size`, avant
toute lecture.

**10. Le cookie anti-CSRF pouvait ne pas partir.**
La garde de l'admin utilisait `Response.redirect`, qui court-circuite la
gestion des cookies d'Astro. Remplacé par `context.redirect`. Et un POST
arrivant sans cookie est désormais explicitement refusé, avec un message
qui dit quoi faire, au lieu d'un 403 muet.

**11. `SESSION_SECRET` était demandé mais ne servait à rien.**
Le jeton de session est tiré au hasard et stocké haché : il n'y a rien à
signer. La variable a été retirée du `.env.example` plutôt que de laisser
croire qu'elle protège quelque chose.

---

## Responsive

**12. `min-height: 100svh` sans repli.**
Sur un navigateur qui ne connaît pas `svh` — Safari avant 15.4 — la
déclaration est ignorée et **toutes les sections plein écran s'écrasent**.
Ajout systématique d'un `100vh` avant, sur les cinq pages concernées.

**13. Les tableaux de l'admin débordaient sur téléphone.**
Six colonnes sur 375 px poussaient toute la page vers la droite. Ils
défilent maintenant horizontalement dans leur cadre, et les en-têtes de
section passent en colonne.

**Aussi** : repli sans `color-mix()` sur les trois fonds translucides,
`-webkit-backdrop-filter` pour Safari, `overflow-wrap: break-word` sur les
titres pour qu'un mot long ne déborde jamais, `scroll-margin-top` pour que
les ancres ne se retrouvent pas sous le bandeau fixe, `contain-intrinsic-size`
ajusté pour que la barre de défilement ne saute plus, et `100dvh` sur la
colonne de l'admin.

---

## Ajouts

- **`npm run verif`** — contrôles statiques : imports cassés, formulaire
  sans jeton anti-CSRF, route d'admin sans contrôle de session, redirection
  non filtrée, couleur hors palette, police manquante. À lancer avant chaque
  mise en ligne.
- **`.vscode/`** — extensions conseillées, réglages, deux configurations de
  débogage (dev et production locale).
- **`.editorconfig`**, **`robots.txt`** qui écarte `/admin` des moteurs.
- Aperçu vidéo de l'admin doté d'un intitulé accessible et de contrôles.

---

## Ce que je n'ai toujours pas pu vérifier

Le registre npm est bloqué dans l'environnement où j'ai travaillé : je n'ai
pas pu lancer `npm install`, donc ni `astro build`, ni le site en vrai.

Ce qui **a** été exécuté et vérifié : le schéma SQL tourne dans SQLite, les
17 tables se créent, les clés étrangères se comportent comme prévu
(suppression d'un média → les pages l'oublient, suppression d'un projet →
ses sections suivent) ; le hachage de mot de passe fonctionne et coûte
340 ms ; le chargement du `.env` à l'exécution fonctionne ; tous les
fichiers JavaScript passent le contrôle syntaxique ; `npm run verif` ne
remonte aucune erreur ; les balises des fichiers `.astro` sont équilibrées.

Reste possible au premier `npm run build` : une erreur de syntaxe propre au
compilateur Astro dans un fichier `.astro`. Le message indiquera le fichier
et la ligne.
