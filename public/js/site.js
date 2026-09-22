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
     classe est ce qui l'annule. */
  var racine = document.documentElement;
  racine.classList.add('js-ok');

  var moinsDeMouvement =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var economie =
    navigator.connection && (navigator.connection.saveData === true ||
      /2g/.test(navigator.connection.effectiveType || ''));

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

  /* --- Vidéos de fond, chargées à l'approche ---------------------- */
  var videos = document.querySelectorAll('video[data-video]');
  if (videos.length && !moinsDeMouvement && !economie && 'IntersectionObserver' in window) {
    var obsVideo = new IntersectionObserver(
      function (entrees) {
        entrees.forEach(function (e) {
          var v = e.target;
          if (e.isIntersecting) {
            if (!v.src) {
              v.src = v.getAttribute('data-video');
              v.addEventListener(
                'loadeddata',
                function () {
                  v.classList.add('prete');
                },
                { once: true }
              );
            }
            var p = v.play();
            if (p && p.catch) p.catch(function () {});
          } else if (!v.paused) {
            v.pause();
          }
        });
      },
      { rootMargin: '200px 0px' }
    );
    videos.forEach(function (v) {
      obsVideo.observe(v);
    });
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
      minuteur = setTimeout(function () {
        fil.classList.remove('actif');
        void fil.offsetWidth; /* redémarre l'animation */
        fil.classList.add('actif');
      }, 180);
      // Garde-fou : si la navigation n'a finalement pas lieu — lien
      // annulé, réponse sans contenu, clic sur Échap — rien ne viendrait
      // rendre la page à son état normal. Au bout de quinze secondes,
      // on la rend quoi qu'il arrive.
      clearTimeout(plafond);
      plafond = setTimeout(function () {
        desarmer();
      }, 15000);
    };
    var desarmer = function () {
      clearTimeout(minuteur);
      clearTimeout(plafond);
      fil.classList.remove('actif');
      racine.classList.remove('part');
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

  /* --- Façade YouTube : rien de tiers avant le clic --------------- */
  document.querySelectorAll('.yt').forEach(function (bloc) {
    var bouton = bloc.querySelector('.yt__bouton');
    if (!bouton) return;
    bouton.addEventListener('click', function () {
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
