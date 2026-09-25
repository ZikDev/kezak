/* Kezak — le seul script du site public. Environ 3 Ko.
   Le bandeau, les fondus à l'entrée, les médias différés, et le fil
   d'attente pendant qu'une page se charge.

   Ce qui n'est PAS ici : le fondu entre les panneaux de l'accueil et la
   transition d'une page à l'autre. Les deux sont faits en CSS pur, par
   le navigateur — rien à observer, rien à recalculer, rien à casser si
   le script ne part pas. */
(function () {
  'use strict';

  /* --- Signal de vie ----------------------------------------------
     Première ligne exécutée, et elle compte. Le CSS arme ses fondus sur
     « scripting: enabled », qui dit seulement que le navigateur sait
     exécuter du JavaScript — pas que CE fichier s'est chargé. S'il
     renvoyait 404, expirait sur un réseau lent ou levait une exception,
     tout le contenu à fondu restait invisible, définitivement et sans
     aucun signe. Le CSS prévoit donc un filet à 2,5 secondes ; cette
     classe est ce qui l'annule.

     Le rideau de chargement, lui, a son propre filet — six secondes, et
     il n'est PAS annulé par cette classe : voir le commentaire de
     RideauChargement.astro, qui explique pourquoi. */
  var racine = document.documentElement;
  racine.classList.add('js-ok');

  var moinsDeMouvement =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var economie =
    navigator.connection && (navigator.connection.saveData === true ||
      /2g/.test(navigator.connection.effectiveType || ''));

  /* --- Le rideau de chargement -------------------------------------
     Il est déjà à l'écran quand cette ligne s'exécute : le CSS l'affiche
     d'emblée là où le navigateur sait exécuter du JavaScript. Tout ce qui
     suit ne sert qu'à décider QUAND le lever, et à le redescendre au
     départ vers la page suivante.

     On attend quatre choses, et on ne les attend jamais longtemps :

       — un délai minimum, sans quoi le rideau clignoterait sur une page
         déjà en cache : un éclair noir est pire que pas de rideau ;
       — les polices, sinon la page se découvre en Times New Roman et
         change de graisse sous les yeux une demi-seconde plus tard ;
       — les images déclarées prioritaires — celle du héros, en pratique ;
       — la première image de la boucle vidéo de fond, quand il y en a
         une. C'est elle, la raison d'être de ce rideau.

     Chacune de ces attentes a sa propre limite, et l'ensemble a un
     plafond : au-delà, on lève le rideau et le reste continue de charger
     derrière. Faire attendre quelqu'un devant un écran fixe plus de
     quatre secondes, c'est lui faire croire à une panne. */
  /* Le minuteur de secours est armé ICI, avant toute autre chose, et il
     ne dépend de rien : ni du rideau, ni d'une requête, ni d'une seule
     ligne de ce qui suit. Si quoi que ce soit lève une exception plus
     bas, c'est lui qui rendra la page. Le CSS a le sien, une seconde et
     demie plus tard, pour le cas où ce fichier ne se charge pas du
     tout. */
  setTimeout(function () {
    racine.classList.add('rideau-leve');
  }, 4500);

  var rideau = document.querySelector('[data-rideau-chargement]');
  var leverRideau = function () {};

  if (rideau) {
    leverRideau = function () {
      // On part vers une autre page : le rideau doit rester, et un lever
      // programmé avant le clic n'a plus lieu d'être. Sans ce contrôle,
      // un clic donné pendant le tout premier chargement découvrait la
      // page en pleine navigation.
      if (racine.classList.contains('va-partir')) return;
      racine.classList.add('rideau-leve');
    };

    var uneFois = function (fn) {
      var fait = false;
      return function () {
        if (fait) return;
        fait = true;
        fn();
      };
    };

    // Un compteur, pas une promesse : le fichier n'en utilise nulle part
    // ailleurs, et un navigateur sans « Promise » se retrouverait avec un
    // rideau que rien ne lève.
    var restant = 1; // la pose des attentes compte pour une
    var uneDeMoins = function () {
      restant--;
      if (restant <= 0) leverRideau();
    };
    var attendre = function (poser, limite) {
      restant++;
      var fini = uneFois(uneDeMoins);
      poser(fini);
      if (limite) setTimeout(fini, limite);
    };

    // 1. le délai minimum
    attendre(function (fini) {
      setTimeout(fini, 420);
    });

    // 2. les polices
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      attendre(function (fini) {
        document.fonts.ready.then(fini, fini);
      }, 1800);
    }

    // 3. les images prioritaires — celles que le gabarit a marquées
    //    « eager », c'est-à-dire l'image du héros et rien d'autre.
    var prioritaires = document.querySelectorAll('img[fetchpriority="high"], img[loading="eager"]');
    for (var ip = 0; ip < prioritaires.length; ip++) {
      (function (im) {
        if (im.complete) return;
        attendre(function (fini) {
          im.addEventListener('load', fini, { once: true });
          im.addEventListener('error', fini, { once: true });
        }, 2600);
      })(prioritaires[ip]);
    }

    // 4. la boucle vidéo de fond de la première vue. Pas celles des
    //    cartes : elles ne se chargent qu'au survol, et attendre un
    //    survol qui n'aura peut-être jamais lieu n'a aucun sens.
    var premiereVideo = document.querySelector('video[data-video]:not([data-survol])');
    // Même condition que le chargement des boucles, plus bas : sans
    // « IntersectionObserver », aucune vidéo ne reçoit jamais de source,
    // et l'attente ci-dessous irait au bout de sa limite pour rien.
    if (premiereVideo && !moinsDeMouvement && !economie && 'IntersectionObserver' in window) {
      attendre(function (fini) {
        if (premiereVideo.readyState >= 2) {
          fini();
          return;
        }
        premiereVideo.addEventListener('loadeddata', fini, { once: true });
        premiereVideo.addEventListener('error', fini, { once: true });
      }, 2600);
    }

    uneDeMoins(); // les attentes sont posées
    // Plafond général, quoi qu'il arrive.
    setTimeout(leverRideau, 4200);

    // Quelqu'un vient d'appuyer sur Tab : il veut la page, pas l'écran
    // d'attente. Sans cela, la bague de focus se promenait derrière le
    // rideau, sur des liens que personne ne voyait.
    document.addEventListener('focusin', leverRideau);

    // Retour arrière, page restaurée depuis le cache du navigateur : la
    // page est déjà là, complète, et le rideau serait une insulte.
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) {
        racine.classList.remove('va-partir');
        racine.classList.add('rideau-leve');
      }
    });
  }


  /* --- Menu mobile ------------------------------------------------ */
  var bascule = document.querySelector('.bandeau__bascule');
  var menu = document.getElementById('menu');
  if (bascule && menu) {
    bascule.addEventListener('click', function () {
      var ouvert = menu.classList.toggle('ouvert');
      bascule.setAttribute('aria-expanded', String(ouvert));
    });
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        menu.classList.remove('ouvert');
        bascule.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('ouvert')) {
        menu.classList.remove('ouvert');
        bascule.setAttribute('aria-expanded', 'false');
        bascule.focus();
      }
    });
  }

  /* --- Bandeau différé sur l'accueil ------------------------------ */
  var bandeau = document.querySelector('.bandeau[data-differe]');
  if (bandeau) {
    var sentinelle = document.querySelector('.ecran');
    if (sentinelle && 'IntersectionObserver' in window) {
      new IntersectionObserver(
        function (entrees) {
          bandeau.classList.toggle('visible', !entrees[0].isIntersecting);
        },
        { threshold: 0, rootMargin: '-60% 0px 0px 0px' }
      ).observe(sentinelle);
    } else {
      bandeau.classList.add('visible');
    }
  }

  /* --- Fondu à l'entrée : la seule animation du site --------------- */
  var aFondre = document.querySelectorAll('.entree');
  if (moinsDeMouvement || !('IntersectionObserver' in window)) {
    aFondre.forEach(function (el) {
      el.classList.add('vu');
    });
  } else {
    var obsFondu = new IntersectionObserver(
      function (entrees) {
        entrees.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('vu');
            obsFondu.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    aFondre.forEach(function (el) {
      obsFondu.observe(el);
    });
  }

  /* --- Les boucles vidéo ------------------------------------------
     Trois emplois, un seul mécanisme : le fond d'un écran d'accueil, le
     héros d'une fiche projet, la vignette d'une carte d'annuaire.

     Rien n'est chargé tant que ce n'est pas nécessaire, et rien du tout
     si l'on a demandé moins d'animations ou activé l'économie de
     données. L'image reste dessous : si la vidéo ne vient pas, la page
     est déjà juste.

     Deux conduites, selon l'attribut « data-survol » :

       — sans lui, un fond : il se lance à l'approche du défilement et
         s'arrête dès qu'il sort du champ ;
       — avec lui, une carte : elle se lance au survol de la souris ou à
         la mise au point au clavier. Une grille de six vignettes qui
         tourneraient toutes en même temps, ce sont six décodages vidéo
         simultanés pour une seule qu'on regarde. Là où il n'y a pas de
         souris — un téléphone, une tablette — on retombe sur « la carte
         occupe vraiment l'écran, on la lance », ce qui en fait au plus
         une ou deux à la fois. */
  var lancerBoucle = function (v) {
    if (!v.src) {
      v.src = v.getAttribute('data-video');
      v.addEventListener(
        'loadeddata',
        function () {
          // Le chargement peut se terminer après que la souris est
          // repartie : sans ce contrôle, la vidéo apparaissait alors
          // seule et figée sur sa première image.
          if (!v.hasAttribute('data-survol') || !v.paused) v.classList.add('prete');
        },
        { once: true }
      );
    } else if (v.readyState >= 2) {
      v.classList.add('prete');
    }
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  };

  var arreterBoucle = function (v, revenir) {
    if (!v.paused) v.pause();
    if (!revenir) return;
    // On repasse à l'image : la classe part, le fondu se fait tout seul,
    // et la vidéo ne revient au début qu'une fois devenue invisible —
    // sinon on verrait le saut.
    v.classList.remove('prete');
    setTimeout(function () {
      if (!v.classList.contains('prete')) {
        try {
          v.currentTime = 0;
        } catch (e) {
          /* la vidéo n'est pas encore assez chargée pour être rembobinée */
        }
      }
    }, 700);
  };

  if (!moinsDeMouvement && !economie && 'IntersectionObserver' in window) {
    var fonds = document.querySelectorAll('video[data-video]:not([data-survol])');
    if (fonds.length) {
      var obsFond = new IntersectionObserver(
        function (entrees) {
          entrees.forEach(function (e) {
            if (e.isIntersecting) lancerBoucle(e.target);
            else arreterBoucle(e.target, false);
          });
        },
        { rootMargin: '200px 0px' }
      );
      fonds.forEach(function (v) {
        obsFond.observe(v);
      });
    }

    var cartes = document.querySelectorAll('video[data-survol]');
    if (cartes.length) {
      var avecSouris =
        window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

      if (avecSouris) {
        // Une carte lancée au survol — ou à la mise au point au clavier —
        // ne s'arrêtait que si la souris repassait dessus. Au clavier,
        // elle n'en repartait jamais : on tabulait, on faisait défiler, et
        // la vidéo continuait de se décoder trois écrans plus haut. Ce
        // guetteur ne lance rien, il ne fait qu'arrêter ce qui a quitté
        // l'écran.
        var obsSortie = new IntersectionObserver(
          function (entrees) {
            entrees.forEach(function (e) {
              if (!e.isIntersecting) arreterBoucle(e.target, true);
            });
          },
          { rootMargin: '100px 0px' }
        );

        cartes.forEach(function (v) {
          obsSortie.observe(v);
          // Le cadre écouté est la carte entière, et non la vidéo : la
          // vidéo ne reçoit aucun événement de pointeur, et c'est voulu —
          // c'est le lien qui doit rester cliquable de bout en bout.
          var cadre = v.closest('a') || v.parentNode;
          if (!cadre) return;
          cadre.addEventListener('pointerenter', function () {
            lancerBoucle(v);
          });
          cadre.addEventListener('pointerleave', function () {
            arreterBoucle(v, true);
          });
          cadre.addEventListener('focusin', function () {
            lancerBoucle(v);
          });
          cadre.addEventListener('focusout', function () {
            arreterBoucle(v, true);
          });
        });
      } else {
        // Sans souris, c'est la carte la mieux visible qui joue — et elle
        // seule. Un simple seuil de visibilité en lançait trois d'un coup
        // sur un téléphone, la grille y étant sur une colonne : trois
        // décodages vidéo simultanés pour une page qu'on fait défiler.
        var laMieuxVisible = function () {
          var meilleure = null;
          for (var i = 0; i < cartes.length; i++) {
            var part = cartes[i].partVisible || 0;
            if (part >= 0.5 && (!meilleure || part > meilleure.partVisible)) meilleure = cartes[i];
          }
          for (var j = 0; j < cartes.length; j++) {
            if (cartes[j] === meilleure) lancerBoucle(cartes[j]);
            else arreterBoucle(cartes[j], true);
          }
        };

        var obsCarte = new IntersectionObserver(
          function (entrees) {
            entrees.forEach(function (e) {
              e.target.partVisible = e.isIntersecting ? e.intersectionRatio : 0;
            });
            laMieuxVisible();
          },
          // Plusieurs seuils : sans eux, on n'est prévenu qu'au passage de
          // la barre, et la carte qui devient la mieux visible sans jamais
          // franchir de seuil ne déclenche rien.
          { threshold: [0, 0.25, 0.5, 0.75, 1] }
        );
        cartes.forEach(function (v) {
          obsCarte.observe(v);
        });
      }
    }
  }

  /* --- Le fil d'attente ------------------------------------------
     Une ligne fine en haut de l'écran, du clic jusqu'à l'affichage de la
     page suivante. Elle avance vite puis ralentit sans jamais atteindre
     le bout : elle dit « ça travaille », pas « il reste 30 % ».

     Là où le navigateur sait faire les transitions de document, elle
     double la transition sans la gêner. Ailleurs — Firefox aujourd'hui —
     c'est le seul signe qu'un clic a été pris en compte, et c'est ce qui
     évite le deuxième clic d'impatience. */
  /* Les transitions de document existent-elles ici ? « onpagereveal » est
     apparu avec elles : c'est le signal le plus sûr dont on dispose sans
     tester un at-rule. Là où elles existent, le navigateur fait tout —
     et surtout il tient l'image de la page quittée jusqu'à ce que la
     suivante soit prête, ce qui est exactement le comportement voulu.
     Ailleurs, le CSS de repli prend le relais. */
  var transitionsDeDocument = 'onpagereveal' in window;
  if (!transitionsDeDocument) racine.classList.add('replis');

  var fil = document.querySelector('.fil');
  if (fil) {
    var minuteur = 0;
    var plafond = 0;
    // Rien ne s'affiche avant 180 ms : sur une page qui arrive tout de
    // suite, un fil qui clignote serait juste du bruit.
    var armer = function () {
      clearTimeout(minuteur);
      // Le départ, lui, est immédiat : c'est ce qui donne le sentiment
      // que le clic a été pris. Il ne se referme jamais tout seul — une
      // page lente prolonge donc l'attente au lieu de la couper.
      if (!transitionsDeDocument && !moinsDeMouvement) racine.classList.add('part');
      // Le rideau redescend : c'est lui qui couvre l'attente, et c'est
      // lui qui sera déjà à l'écran quand la page suivante se peindra.
      // Les deux images — celle qu'on quitte et celle qui arrive —
      // portent alors le même rideau : la jointure ne se voit pas.
      racine.classList.add('va-partir');
      minuteur = setTimeout(function () {
        fil.classList.remove('actif');
        void fil.offsetWidth; /* redémarre l'animation */
        fil.classList.add('actif');
      }, 180);
      // Garde-fou : si la navigation n'a finalement pas lieu — lien vers
      // un fichier à télécharger, réponse sans contenu, navigation
      // interrompue — rien ne viendrait rendre la page à son état normal.
      // Le délai était de quinze secondes, ce qui était supportable pour
      // un fil de deux pixels en haut de l'écran ; depuis que le rideau
      // couvre tout, quinze secondes de noir, c'est une panne. Neuf
      // secondes, et la touche Échap rend la page tout de suite.
      clearTimeout(plafond);
      plafond = setTimeout(function () {
        desarmer();
      }, 9000);
    };
    var desarmer = function () {
      clearTimeout(minuteur);
      clearTimeout(plafond);
      fil.classList.remove('actif');
      racine.classList.remove('part');
      // La navigation n'a pas eu lieu : on rend la page, rideau compris.
      //
      // Et seulement dans ce cas : cette fonction est aussi appelée à
      // chaque « pageshow », donc à chaque chargement de page. Elle posait
      // « rideau-leve » sans condition — le rideau se levait donc au
      // premier souffle, avant d'avoir attendu quoi que ce soit, et tout
      // ce fichier ne servait plus à rien.
      if (racine.classList.contains('va-partir')) {
        racine.classList.remove('va-partir');
        racine.classList.add('rideau-leve');
      }
    };

    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target || a.hasAttribute('download')) return;

      var destination;
      try {
        destination = new URL(a.href, location.href);
      } catch (err) {
        return;
      }
      // Ni mailto:, ni tel:, ni un autre site, ni une ancre de cette page.
      if (destination.origin !== location.origin) return;
      if (destination.protocol !== 'http:' && destination.protocol !== 'https:') return;
      if (
        destination.pathname === location.pathname &&
        destination.search === location.search &&
        destination.hash
      ) {
        return;
      }
      armer();
    });

    // Formulaires : l'envoi du contact peut prendre une seconde.
    document.addEventListener('submit', function (e) {
      if (!e.defaultPrevented) armer();
    });

    // Échap : on renonce. C'est le geste de quelqu'un qui a cliqué par
    // erreur, ou que l'attente inquiète — dans les deux cas, lui rendre
    // sa page immédiatement est la seule réponse acceptable.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') desarmer();
    });

    // Retour arrière, page restaurée depuis le cache, navigation annulée :
    // dans tous les cas, le fil s'efface.
    window.addEventListener('pageshow', desarmer);
    window.addEventListener('pagehide', desarmer);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') desarmer();
    });
  }

  /* --- Ne pas perdre ce qu'on vient d'écrire ----------------------
     Le formulaire de contact répond par une redirection : en cas
     d'erreur, la page se reconstruit et tout ce qui avait été tapé —
     jusqu'à quatre mille caractères — avait disparu. La validation du
     navigateur évite maintenant la plupart des allers-retours, mais pas
     ceux qui viennent du serveur.

     Les valeurs sont donc gardées le temps de l'aller-retour, dans le
     stockage de session : elles ne quittent pas l'onglet, rien n'est
     envoyé nulle part, et tout est effacé dès qu'elles sont
     réinstallées ou que le message est passé. Le stockage peut être
     refusé — navigation privée, réglages stricts — d'où les
     try/catch : dans ce cas on perd simplement le filet, pas la page. */
  (function () {
    var formulaire = document.querySelector('form[data-garder]');
    var cle = 'kezak-contact';

    var champsUtiles = function (f) {
      return Array.prototype.filter.call(f.elements, function (el) {
        return (
          el.name &&
          el.name !== 'csrf' &&
          el.name !== 'depart' &&
          el.name !== 'site' &&
          el.type !== 'submit'
        );
      });
    };

    if (formulaire) {
      formulaire.addEventListener('submit', function () {
        var valeurs = {};
        champsUtiles(formulaire).forEach(function (el) {
          if (el.type === 'checkbox') valeurs[el.name + '|' + el.value] = el.checked;
          else valeurs[el.name] = el.value;
        });
        try {
          sessionStorage.setItem(cle, JSON.stringify(valeurs));
        } catch (e) {
          /* stockage refusé : tant pis pour le filet */
        }
      });

      // Retour en erreur : on réinstalle. Le brouillon reste tant que
      // l'envoi n'est pas passé, et il est effacé dès que la page de
      // contact s'ouvre sans erreur — après un envoi réussi, donc.
      if (/[?&]erreur=/.test(location.search)) {
        try {
          var gardees = JSON.parse(sessionStorage.getItem(cle) || '{}');
          champsUtiles(formulaire).forEach(function (el) {
            if (el.type === 'checkbox') {
              var v = gardees[el.name + '|' + el.value];
              if (typeof v === 'boolean') el.checked = v;
            } else if (typeof gardees[el.name] === 'string') {
              el.value = gardees[el.name];
            }
          });
        } catch (e) {
          /* rien à réinstaller */
        }
      }
    }

    // Message parti, ou page de contact rouverte sans erreur : on efface.
    if (!formulaire || !/[?&]erreur=/.test(location.search)) {
      try {
        sessionStorage.removeItem(cle);
      } catch (e) {
        /* rien à effacer */
      }
    }
  })();

  /* --- Le carrousel de la galerie ---------------------------------
     Tout le déplacement est fait par le navigateur : on ne fait que lui
     demander de défiler d'une vue, et l'accroche CSS s'occupe de
     s'arrêter au bon endroit. Rien n'est calculé à la main, donc rien ne
     se désaligne quand la fenêtre change de taille.

     Sans ce script, la piste reste un défilement horizontal ordinaire :
     on fait glisser au doigt, à la molette, ou au clavier. */
  document.querySelectorAll('[data-carrousel]').forEach(function (carrousel) {
    var piste = carrousel.querySelector('[data-piste]');
    if (!piste) return;
    var vues = Array.prototype.slice.call(piste.children);
    if (vues.length < 2) return;

    var prec = carrousel.querySelector('[data-prec]');
    var suiv = carrousel.querySelector('[data-suiv]');
    var rang = carrousel.querySelector('[data-rang]');

    // « offsetLeft » se mesure depuis le cadre, « scrollLeft » depuis le
    // bord intérieur de la piste : les deux diffèrent de la marge de la
    // piste. On prend la première vue comme origine, et la différence
    // disparaît — quelle que soit la marge, aujourd'hui ou demain.
    var origine = function () {
      return vues[0].offsetLeft;
    };

    var indexCourant = function () {
      // La vue dont le bord gauche est le plus proche du bord de la piste.
      var base = origine();
      var meilleur = 0;
      var ecartMin = Infinity;
      for (var i = 0; i < vues.length; i++) {
        var ecart = Math.abs(vues[i].offsetLeft - base - piste.scrollLeft);
        if (ecart < ecartMin) {
          ecartMin = ecart;
          meilleur = i;
        }
      }
      return meilleur;
    };

    // L'index visé, et non celui mesuré : pendant l'animation, la position
    // lue est encore celle de la vue précédente, et deux clics rapides
    // redemandaient donc deux fois la même destination.
    var vise = 0;

    var allerA = function (i) {
      vise = Math.max(0, Math.min(vues.length - 1, i));
      var cible = vues[vise];
      if (!cible) return;
      // « prefers-reduced-motion » : le CSS remet le défilement en
      // instantané, mais un « behavior: smooth » passé ici l'emporterait.
      piste.scrollTo({
        left: cible.offsetLeft - origine(),
        behavior: moinsDeMouvement ? 'auto' : 'smooth',
      });
      etatDesFleches();
    };

    var etatDesFleches = function () {
      // « aria-disabled » et non « disabled » : désactiver un bouton qui a
      // le focus le renvoie au début du document, sans un mot. Le bouton
      // reste donc focalisable, et c'est le gestionnaire qui ne fait rien.
      if (prec) prec.setAttribute('aria-disabled', String(vise === 0));
      if (suiv) suiv.setAttribute('aria-disabled', String(vise === vues.length - 1));
    };

    var rafraichir = function () {
      vise = indexCourant();
      if (rang) {
        var s = String(vise + 1);
        // Réécrire un texte identique suffit à le faire réannoncer par
        // certains lecteurs d'écran : à chaque doigt posé, on entendait
        // le même numéro.
        if (rang.textContent !== s) rang.textContent = s;
      }
      etatDesFleches();
    };

    if (prec) {
      prec.addEventListener('click', function () {
        if (prec.getAttribute('aria-disabled') !== 'true') allerA(vise - 1);
      });
    }
    if (suiv) {
      suiv.addEventListener('click', function () {
        if (suiv.getAttribute('aria-disabled') !== 'true') allerA(vise + 1);
      });
    }

    // Les flèches du clavier, quand le focus est dans le carrousel — mais
    // pas quand il est sur une vidéo : ce sont là ses commandes d'avance
    // et de recul, les plus utilisées au clavier.
    carrousel.addEventListener('keydown', function (e) {
      if (e.target.closest && e.target.closest('video, audio, input, textarea, select')) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        allerA(vise - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        allerA(vise + 1);
      }
    });

    var attente = 0;
    piste.addEventListener('scroll', function () {
      clearTimeout(attente);
      attente = setTimeout(rafraichir, 90);
    });
    window.addEventListener('resize', function () {
      clearTimeout(attente);
      attente = setTimeout(rafraichir, 150);
    });
    rafraichir();
  });

  /* --- Façade YouTube : rien de tiers avant le clic --------------- */
  document.querySelectorAll('.yt').forEach(function (bloc) {
    var bouton = bloc.querySelector('.yt__bouton');
    if (!bouton) return;
    bouton.addEventListener('click', function (e) {
      // Le repli est un lien vers YouTube : on l'intercepte pour ouvrir la
      // vidéo sur place. Un clic avec une touche de modification, ou du
      // bouton du milieu, garde son comportement d'ouverture normale.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      var id = bloc.getAttribute('data-youtube');
      var cadre = document.createElement('iframe');
      cadre.src =
        'https://www.youtube-nocookie.com/embed/' +
        encodeURIComponent(id) +
        '?autoplay=1&rel=0&modestbranding=1';
      cadre.title = bloc.getAttribute('data-titre') || 'Vidéo';
      cadre.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen';
      cadre.setAttribute('allowfullscreen', '');
      bloc.replaceChildren(cadre);
      cadre.focus();
    });
  });
})();
