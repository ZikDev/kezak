/* Kezak — le lecteur de PDF des fiches projet.

   Un module, et non une partie de site.js : il ne se charge que sur les
   pages qui contiennent un document.

   Deux lecteurs, selon l'appareil :

     — sur un ordinateur dont le navigateur sait afficher un PDF dans une
       page, c'est lui qu'on utilise : un cadre, et le lecteur que chacun
       connaît — barre d'outils, zoom, recherche, vignettes, impression.
       Rien d'autre ne se télécharge ;
     — ailleurs — téléphones, tablettes —, ce lecteur n'existe pas dans une
       page : Chrome sur Android propose de télécharger le fichier, Safari
       sur iPhone n'en montre que la première page. On l'affiche alors
       nous-mêmes, avec pdf.js (1,8 Mo, téléchargé seulement à l'approche
       de la section). Tout ce qui suit la fonction « natif » le concerne.

   Ce que le lecteur ne fait volontairement pas :
     — exécuter le JavaScript qu'un PDF peut contenir ;
     — rendre les liens et les champs de formulaire du PDF cliquables :
       un lien « javascript: » glissé dans un document, cliqué sur notre
       domaine, s'exécuterait avec la session de qui clique ;
     — utiliser WebAssembly, que la politique de sécurité du site refuse.
       Les décodeurs JavaScript prennent le relais.

   Ce qu'il fait pour la lecture :
     — chaque page est dessinée à la largeur exacte du cadre, à la densité
       de l'écran, dans la limite d'une surface que tout téléphone accepte ;
     — une couche de texte invisible est posée sur chaque page : on peut
       sélectionner, copier, chercher avec Ctrl+F, et un lecteur d'écran
       lit le document. Pour un document de plus de 150 pages ou de plus
       de 8 Mo, seules les pages déjà parcourues ont leur texte — le
       téléchargement reste la voie pour chercher dans un très gros
       document ;
     — seules les pages proches de l'écran ont leur dessin en mémoire. Un
       PDF de quarante pages dessinées en pleine définition, c'est plus
       d'un demi-gigaoctet : de quoi faire fermer l'onglet par un téléphone. */

const BASE = '/vendor/pdfjs/';
// Au-delà de 2, la netteté ne se voit plus, la mémoire si.
const DENSITE_MAX = 2;
// Surface maximale d'une toile, en pixels. Safari sur iPhone refuse au-delà
// de 16,7 millions : la page reste alors blanche. Une page de 200 × 14 400
// points dessinée à pleine largeur réclamait 170 millions de pixels.
const PIXELS_MAX = 16 * 1024 * 1024;
// Au-delà de ce nombre de pages, le texte n'est posé que sur les pages
// parcourues : quelques centaines de couches de texte, c'est un document
// HTML de plusieurs dizaines de milliers de nœuds.
const PAGES_TEXTE_INTEGRAL = 150;
// Et au-delà de ce poids. Lire le texte d'une page, c'est télécharger les
// morceaux du fichier où il se trouve ; dans un PDF fait d'images, ce texte
// est semé entre elles, et le lire partout revenait à télécharger tout le
// fichier : 22 Mo sur un téléphone pour deux pages regardées.
const OCTETS_TEXTE_INTEGRAL = 8 * 1024 * 1024;

let promessePdfjs = null;
const chargerPdfjs = () => {
  if (!promessePdfjs) {
    promessePdfjs = import(BASE + 'pdf.min.js').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = BASE + 'pdf.worker.min.js';
      return pdfjs;
    });
  }
  return promessePdfjs;
};

// requestIdleCallback n'existe pas dans Safari : un délai court en tient lieu.
const auRepos = (fn) =>
  'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 40);

document.querySelectorAll('[data-pdf]').forEach(preparer);

/* Le lecteur du navigateur est-il là, et sur un ordinateur ?
   « pdfViewerEnabled » le dit (faux si le visiteur a choisi de toujours
   télécharger les PDF). Il ne suffit pas : Safari sur iPad répond oui et
   n'affiche pourtant qu'une page dans un cadre. D'où la deuxième
   condition — une souris ou un pavé tactile, pas un doigt. */
// Une déclaration de fonction, et non une constante : elle doit exister
// dès la ligne qui lance « preparer », plus haut dans le fichier.
function natif() {
  return (
    navigator.pdfViewerEnabled === true &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
  );
}

function preparer(section) {
  const cadre = section.querySelector('[data-cadre]');
  const etat = section.querySelector('[data-etat]');
  const compteur = section.querySelector('[data-compteur]');
  const boutonPlein = section.querySelector('[data-plein-ecran]');
  const titre = section.dataset.titre || 'Document';
  if (!cadre || !section.dataset.src) return;

  if (natif()) {
    const fenetre = document.createElement('iframe');
    fenetre.className = 'pdf__natif';
    fenetre.title = titre;
    // Chargé à l'approche seulement, comme le reste.
    fenetre.loading = 'lazy';
    fenetre.setAttribute('allow', 'fullscreen');
    // « view=FitH » : la page à la largeur du cadre (Chrome, Edge) ;
    // « zoom=page-width », la même chose pour Firefox. Chacun ignore
    // l'autre.
    fenetre.src = section.dataset.src + '#navpanes=0&view=FitH&zoom=page-width';
    cadre.replaceWith(fenetre);
    section.classList.add('pdf--natif');
    if (compteur) compteur.remove();
    return;
  }

  // Le cadre n'apparaît qu'ici, quand ce script tourne : sans lui — vieux
  // navigateur, script bloqué —, il ne resterait qu'un « Chargement… »
  // éternel. Seul le lien de téléchargement serait utile, et il est là.
  cadre.hidden = false;

  const dire = (texte) => {
    if (etat) etat.textContent = texte;
  };

  /* --- Le plein écran, là où il existe -------------------------------
     Il n'existe pas sur iPhone, où seul un élément vidéo peut passer en
     plein écran : le bouton n'y apparaît donc pas. Son libellé ne change
     pas : c'est « aria-pressed » qui dit s'il est enfoncé. Changer les
     deux faisait annoncer deux fois la même chose. */
  if (boutonPlein && section.requestFullscreen && document.fullscreenEnabled !== false) {
    boutonPlein.hidden = false;
    boutonPlein.addEventListener('click', () => {
      if (document.fullscreenElement === section) {
        document.exitFullscreen().catch(() => {});
      } else {
        section.requestFullscreen().catch(() => {});
      }
    });
    document.addEventListener('fullscreenchange', () => {
      const actif = document.fullscreenElement === section;
      boutonPlein.setAttribute('aria-pressed', String(actif));
      // On rend la main au cadre, pour que les flèches fassent défiler
      // le document et non la page derrière.
      if (actif) cadre.focus({ preventScroll: true });
    });
  }

  /* --- Ouvrir le document à l'approche ------------------------------ */
  if ('IntersectionObserver' in window) {
    const guetteur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) {
          guetteur.disconnect();
          ouvrir();
        }
      },
      { rootMargin: '800px 0px' }
    );
    guetteur.observe(section);
  } else {
    ouvrir();
  }

  async function ouvrir() {
    let pdfjs;
    let doc;
    try {
      pdfjs = await chargerPdfjs();
      const tache = pdfjs.getDocument({
        url: section.dataset.src,
        useWasm: false,
        wasmUrl: BASE + 'wasm/',
        standardFontDataUrl: BASE + 'standard_fonts/',
        enableXfa: false,
        // Une image de 20 000 × 20 000 pixels tient dans un PDF d'un
        // mégaoctet — elle se compresse très bien — et pèse 1,2 Go une
        // fois décompressée. Sans plafond, l'onglet du visiteur montait à
        // plus de 5 Go. 16 millions de pixels, c'est déjà une photo de 4900
        // × 3300 : plus que ce qu'une page affiche.
        maxImageSize: 16 * 1024 * 1024,
        // Ne lire du fichier que ce que les pages affichées demandent. Par
        // défaut, pdf.js télécharge le document entier dès l'ouverture —
        // un dossier de presse de 22 Mo coûtait 29 Mo de données mobiles
        // pour regarder sa couverture. Les deux réglages vont ensemble :
        // le premier sans le second ne change rien.
        disableAutoFetch: true,
        disableStream: true,
        // Des morceaux de 16 Ko au lieu de 64. À l'ouverture, pdf.js lit
        // l'en-tête de chaque page ; dans un PDF où chaque page est suivie
        // de son image, chaque en-tête coûtait un morceau entier : 7 Mo lus
        // pour ouvrir un document de 22 Mo, 2 Mo avec 16 Ko. Le nombre de
        // requêtes ne change pas — les morceaux qui se suivent partent
        // ensemble.
        rangeChunkSize: 16 * 1024,
      });
      // Un PDF protégé par mot de passe : on ne le demande pas — il n'y a
      // aucune raison de publier un document qu'il faut déverrouiller.
      tache.onPassword = () => {
        tache.destroy();
      };
      doc = await tache.promise;
    } catch (e) {
      const protege = e && e.name === 'PasswordException';
      dire(
        protege
          ? 'Ce document est protégé par un mot de passe et ne peut pas s’afficher ici.'
          : 'Ce document ne peut pas s’afficher ici. Vous pouvez le télécharger ci-dessous.'
      );
      if (compteur) compteur.textContent = '';
      return;
    }

    const total = doc.numPages;
    const pages = [];

    // Les cases sont posées tout de suite, à la proportion de la première
    // page : la barre de défilement a presque sa vraie longueur dès
    // l'ouverture. Chaque case prend ensuite ses propres proportions, en
    // tâche de fond, quand sa couche de texte est posée.
    let proportion = '1 / 1.4142';
    try {
      const premiere = await doc.getPage(1);
      const v = premiere.getViewport({ scale: 1 });
      proportion = `${v.width} / ${v.height}`;
    } catch (e) {
      /* on garde le format A4 */
    }

    const lot = document.createDocumentFragment();
    for (let n = 1; n <= total; n++) {
      const div = document.createElement('div');
      div.className = 'pdf__page';
      div.style.aspectRatio = proportion;
      div.setAttribute('role', 'group');
      div.setAttribute('aria-label', `Page ${n} sur ${total}`);
      div.dataset.n = String(n);
      lot.appendChild(div);
      pages.push({ div, n, jeton: 0, rendue: false, enCours: false, tache: null, proxy: null, texte: 'aucun' });
    }
    if (etat) etat.remove();
    cadre.appendChild(lot);
    cadre.setAttribute('aria-label', `${titre} — ${total} page${total > 1 ? 's' : ''}`);

    // La largeur CSS d'une page, la même pour toutes.
    const largeurPage = () => pages[0].div.clientWidth;

    /* --- La couche de texte d'une page --------------------------------
       Posée une fois, gardée toujours. Elle ne pèse presque rien à côté
       d'une toile, et c'est elle que lisent Ctrl+F et les lecteurs
       d'écran : la retirer avec la toile, c'était rendre le document muet
       dès qu'on s'éloignait d'une page. Sa taille suit la variable CSS
       « --scale-factor » : un changement de largeur la recale sans la
       refaire. */
    const poserTexte = async (p) => {
      if (p.texte !== 'aucun') return;
      p.texte = 'encours';
      try {
        const page = await doc.getPage(p.n);
        const base = page.getViewport({ scale: 1 });
        const largeur = largeurPage();
        if (!largeur) {
          p.texte = 'aucun';
          return;
        }
        const echelle = largeur / base.width;
        p.div.style.aspectRatio = `${base.width} / ${base.height}`;
        p.div.style.setProperty('--scale-factor', String(echelle));
        // « /UserUnit » : une page peut déclarer une unité plus grande que
        // le point. Sans elle, la couche de texte était deux fois trop
        // petite pour la toile.
        p.div.style.setProperty('--user-unit', String(page.userUnit || 1));
        const couche = document.createElement('div');
        couche.className = 'textLayer';
        p.div.appendChild(couche);
        const tl = new pdfjs.TextLayer({
          textContentSource: page.streamTextContent(),
          container: couche,
          viewport: page.getViewport({ scale: echelle }),
        });
        await tl.render();
        p.texte = 'pose';
      } catch (e) {
        p.texte = 'aucun';
      }
    };

    /* --- Dessiner une page, la libérer ------------------------------- */
    const liberer = (p) => {
      // Le jeton invalide tout dessin en cours : celui-ci s'arrêtera de
      // lui-même à sa prochaine étape, sans rien poser dans la page.
      p.jeton++;
      p.enCours = false;
      if (p.tache) {
        try {
          p.tache.cancel();
        } catch (e) {
          /* déjà terminée */
        }
        p.tache = null;
      }
      if (p.rendue) {
        // Mettre la toile à zéro rend la mémoire tout de suite ; la
        // retirer du document seulement, c'est attendre le ramasse-miettes.
        const toile = p.div.querySelector('canvas');
        if (toile) {
          toile.width = 0;
          toile.height = 0;
          toile.remove();
        }
        p.rendue = false;
      }
      // Et le cache de pdf.js pour cette page : images décodées, polices,
      // instructions de dessin. Sans cet appel, la mémoire de l'onglet
      // montait de page en page et ne redescendait jamais.
      if (p.proxy) {
        try {
          p.proxy.cleanup();
        } catch (e) {
          /* une page encore utilisée ne se nettoie pas : sans gravité */
        }
        p.proxy = null;
      }
    };

    const rendre = async (p) => {
      // « enCours » et non « tache » : entre la demande de la page et le
      // début du dessin, il n'y a pas encore de tâche, et un deuxième appel
      // aurait lancé un deuxième dessin de la même page.
      if (p.rendue || p.enCours) return;
      const jeton = ++p.jeton;
      p.enCours = true;
      try {
        const largeur = p.div.clientWidth;
        if (!largeur) return;
        const page = await doc.getPage(p.n);
        if (jeton !== p.jeton) return;
        p.proxy = page;
        const base = page.getViewport({ scale: 1 });
        p.div.style.aspectRatio = `${base.width} / ${base.height}`;
        const echelle = largeur / base.width;
        const vue = page.getViewport({ scale: echelle });
        // La densité, plafonnée deux fois : par l'écran, et par la surface.
        // Une page très haute est dessinée moins finement plutôt que pas
        // du tout.
        const densite = Math.min(
          window.devicePixelRatio || 1,
          DENSITE_MAX,
          Math.sqrt(PIXELS_MAX / Math.max(1, vue.width * vue.height))
        );

        const toile = document.createElement('canvas');
        toile.width = Math.max(1, Math.floor(vue.width * densite));
        toile.height = Math.max(1, Math.floor(vue.height * densite));
        toile.setAttribute('aria-hidden', 'true');

        p.tache = page.render({
          canvasContext: toile.getContext('2d'),
          viewport: vue,
          transform: densite === 1 ? null : [densite, 0, 0, densite, 0, 0],
        });
        await p.tache.promise;
        if (jeton !== p.jeton) return;
        p.tache = null;
        // La toile passe sous la couche de texte, si celle-ci existe déjà.
        p.div.prepend(toile);
        p.rendue = true;
        if (p.texte === 'aucun') poserTexte(p);
      } catch (e) {
        if (jeton === p.jeton) p.tache = null;
        // Une page annulée parce qu'elle a quitté l'écran n'est pas une
        // erreur. Les autres laissent la case vide : le reste du document
        // reste lisible.
      } finally {
        // Seul le dessin encore valable libère la place : un dessin
        // périmé qui se termine ne doit pas autoriser un doublon du
        // dessin qui l'a remplacé.
        if (jeton === p.jeton) p.enCours = false;
      }
    };

    /* --- Ne garder que les pages proches de l'écran ------------------- */
    const guetteur = new IntersectionObserver(
      (entrees) => {
        for (const e of entrees) {
          const p = pages[Number(e.target.dataset.n) - 1];
          if (!p) continue;
          if (e.isIntersecting) rendre(p);
          else liberer(p);
        }
      },
      // Une hauteur de cadre au-dessus et au-dessous — le cadre ayant la
      // hauteur d'une page, c'est la page d'avant et celle d'après : prêtes
      // avant qu'on y arrive, sans télécharger celles qu'on ne verra pas.
      { root: cadre, rootMargin: '100% 0px' }
    );
    pages.forEach((p) => guetteur.observe(p.div));

    /* --- Le texte de tout le document, en tâche de fond --------------- */
    const octets = Number(section.dataset.octets) || 0;
    if (total <= PAGES_TEXTE_INTEGRAL && octets > 0 && octets <= OCTETS_TEXTE_INTEGRAL) {
      let suivante = 0;
      const unePage = () => {
        while (suivante < total && pages[suivante].texte !== 'aucun') suivante++;
        if (suivante >= total) return;
        poserTexte(pages[suivante++]).then(() => auRepos(unePage));
      };
      auRepos(unePage);
    }

    /* --- Le numéro de page, et l'endroit où l'on lit -------------------
       Pas d'« aria-live » : un numéro annoncé à chaque cran de molette,
       c'est un lecteur d'écran qui ne dit plus rien d'autre. Chaque page
       porte son propre intitulé, c'est là qu'on le trouve.

       « ancre » retient la page lue ET la proportion déjà lue de cette
       page. Un changement de largeur — plein écran, rotation, fenêtre —
       change la hauteur de toutes les pages : la même position en pixels
       tombait alors trente pages plus loin. On revient à l'ancre. */
    let ancre = { n: 1, fraction: 0 };
    let enAttente = false;
    const relever = () => {
      enAttente = false;
      const haut = cadre.getBoundingClientRect().top;
      const repere = haut + cadre.clientHeight / 3;
      let courante = pages[0];
      for (const p of pages) {
        if (p.div.getBoundingClientRect().top <= repere) courante = p;
        else break;
      }
      const r = courante.div.getBoundingClientRect();
      ancre = { n: courante.n, fraction: r.height ? Math.min(1, Math.max(0, (haut - r.top) / r.height)) : 0 };
      if (compteur) compteur.textContent = `Page ${courante.n} / ${total}`;
    };
    cadre.addEventListener(
      'scroll',
      () => {
        if (!enAttente) {
          enAttente = true;
          requestAnimationFrame(relever);
        }
      },
      { passive: true }
    );
    relever();

    /* --- La largeur change : on recale, puis on redessine ------------- */
    if ('ResizeObserver' in window) {
      let minuteur = 0;
      let derniere = cadre.clientWidth;
      new ResizeObserver(() => {
        const l = cadre.clientWidth;
        if (Math.abs(l - derniere) < 2) return;
        derniere = l;
        // Tout de suite : les couches de texte suivent, et l'on revient à
        // l'endroit où l'on lisait — avant que le visiteur ne voie le saut.
        const largeur = largeurPage();
        for (const p of pages) {
          if (p.texte !== 'pose') continue;
          // La proportion de la case porte la largeur de la page en points
          // (« 595 / 842 ») : la nouvelle échelle s'en déduit.
          const w = Number(String(p.div.style.aspectRatio || '').split('/')[0]);
          if (w > 0) p.div.style.setProperty('--scale-factor', String(largeur / w));
        }
        // Le cadre est positionné : la position d'une page y est
        // directement une position de défilement.
        const p = pages[ancre.n - 1];
        if (p) cadre.scrollTop = p.div.offsetTop + ancre.fraction * p.div.offsetHeight;
        // Un peu plus tard : les toiles, refaites à la nouvelle largeur.
        // Une toile agrandie par le CSS est floue.
        clearTimeout(minuteur);
        minuteur = setTimeout(() => {
          for (const q of pages) {
            if (q.rendue || q.enCours) {
              liberer(q);
              rendre(q);
            }
          }
          relever();
        }, 160);
      }).observe(cadre);
    }
  }
}
