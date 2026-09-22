/* ===================================================================
   Kezak — l'administration, côté navigateur. Environ 6 Ko.

   Rien ici n'est indispensable : sans ce fichier, tous les formulaires
   s'envoient, toutes les pages fonctionnent. Ce qu'il ajoute, ce sont les
   confirmations qu'on aimerait avoir en travaillant — l'image qu'on vient
   de choisir, ce qui reste à taper, ce qui n'est pas encore enregistré,
   et le retour à l'endroit exact d'où l'on venait.
   =================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) {
    return (r || document).querySelector(s);
  };
  var $$ = function (s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  };

  /* -----------------------------------------------------------------
     1. Le tiroir de navigation, sur petit écran
     ----------------------------------------------------------------- */
  (function () {
    var bouton = $('[data-menu]');
    var cote = $('.adm__cote');
    var rideau = $('[data-rideau]');
    if (!bouton || !cote || !rideau) return;

    var corps = $('.adm__corps');
    var barre = $('.adm__barre');

    var basculer = function (ouvrir) {
      cote.classList.toggle('ouvert', ouvrir);
      rideau.hidden = !ouvrir;
      bouton.setAttribute('aria-expanded', String(ouvrir));
      // Le reste de la page devient inerte : sans cela, la tabulation
      // sortait du tiroir et continuait dans un contenu recouvert par un
      // rideau opaque — on se perdait derrière un voile noir.
      [corps, barre].forEach(function (el) {
        if (!el) return;
        if (ouvrir) el.setAttribute('inert', '');
        else el.removeAttribute('inert');
      });
      document.body.style.overflow = ouvrir ? 'hidden' : '';
      if (ouvrir) {
        var premier = cote.querySelector('a, button');
        if (premier) premier.focus();
      }
    };

    bouton.addEventListener('click', function () {
      basculer(cote.classList.contains('ouvert') === false);
    });
    rideau.addEventListener('click', function () {
      basculer(false);
      bouton.focus();
    });
    cote.addEventListener('click', function (e) {
      if (e.target.closest('a')) basculer(false);
    });
    document.addEventListener('keydown', function (e) {
      if (!cote.classList.contains('ouvert')) return;
      if (e.key === 'Escape') {
        basculer(false);
        bouton.focus();
        return;
      }
      // Repli pour les navigateurs sans « inert » : la tabulation boucle
      // sur les éléments du tiroir.
      if (e.key !== 'Tab') return;
      var cibles = $$('a[href], button:not([disabled])', cote);
      if (!cibles.length) return;
      var premier = cibles[0];
      var dernier = cibles[cibles.length - 1];
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      }
    });
  })();

  /* -----------------------------------------------------------------
     2. Sommaire de la page

     Construit à partir des sections réellement présentes : chaque page
     l'obtient sans avoir à le déclarer, et il disparaît quand il n'y a
     qu'une section — un sommaire d'un seul élément n'aide personne.
     Au passage, chaque section reçoit un identifiant : c'est lui qui
     permet de revenir au bon endroit après un enregistrement.
     ----------------------------------------------------------------- */
  (function () {
    var boite = $('[data-sommaire]');
    var sections = $$('.adm__section');
    sections.forEach(function (s, i) {
      if (!s.id) s.id = 'sec-' + (i + 1);
    });
    if (!boite || sections.length < 3) return;

    var liens = sections
      .map(function (s) {
        // Le titre de l'en-tête de section, et lui seul. En prenant
        // n'importe quel « .adm__num », la page Messages — dont
        // l'étiquette est une date — se retrouvait coiffée d'un mur de
        // deux cents pastilles ; en prenant n'importe quel « h2 », elle
        // affichait douze noms d'expéditeurs sous le titre « Sections de
        // cette page ».
        var etiquette = s.querySelector(':scope > header h2');
        if (!etiquette) return null;
        // Les espaces sont normalisés : une étiquette écrite sur trois
        // lignes dans le gabarit comptait ses retours à la ligne dans sa
        // longueur, et se faisait tronquer pour rien.
        var texte = (etiquette.textContent || '').replace(/\s+/g, ' ').trim();
        if (!texte) return null;
        var a = document.createElement('a');
        a.href = '#' + s.id;
        a.textContent = texte.length > 34 ? texte.slice(0, 33) + '…' : texte;
        if (texte.length > 34) a.title = texte;
        return a;
      })
      .filter(Boolean)
      .slice(0, 12);

    if (liens.length < 3) return;
    liens.forEach(function (a) {
      boite.appendChild(a);
    });
    boite.hidden = false;
  })();

  /* -----------------------------------------------------------------
     3. Ce qui n'est pas encore enregistré, et ce qui part

     Le suivi est fait formulaire par formulaire, et non pour la page
     entière : enregistrer la section 02 ne doit pas faire croire que la
     section 05, restée ouverte, l'a été aussi.

     Cette partie a été refaite. L'ancienne version tendait un piège :
     elle retirait « modifié » au moment du clic — donc avant tout envoi —
     et posait un verrou anti-double-clic définitif. Enchaînement observé :
     on modifie deux sections, on enregistre la seconde, le navigateur
     demande « quitter la page ? » parce que la première est encore
     ouverte, on répond « rester » — la navigation est annulée, rien n'est
     parti, et le bouton de la section 02 ne répond plus jamais. Sans le
     moindre message, et avec une interface qui affichait « enregistré ».

     Trois changements : « modifié » ne tombe qu'une fois la page vraiment
     quittée ; l'avertissement de sortie ne parle plus que de ce qui reste
     ouvert ailleurs, pas du formulaire qui part ; et le verrou se relâche
     — au bout de quinze secondes, au retour sur l'onglet, ou dès qu'on
     retouche le formulaire.
     ----------------------------------------------------------------- */
  var envoiEnCours = null;

  var etatDuFormulaire = function (f, texte) {
    var actions = f.querySelector('.adm__actions');
    if (!actions) return;
    var etat = actions.querySelector('.adm__etat');
    if (!etat) {
      etat = document.createElement('span');
      etat.className = 'adm__etat';
      actions.appendChild(etat);
    }
    if (texte) etat.textContent = texte;
    etat.hidden = !texte;
  };

  var liberer = function (f) {
    if (!f) return;
    delete f.dataset.envoye;
    f.removeAttribute('aria-busy');
    if (envoiEnCours === f) envoiEnCours = null;
    // Uniquement les boutons que l'on a nous-même désactivés : les
    // flèches « ↑ » de la première ligne et « ↓ » de la dernière sont
    // désactivées par le serveur, et les réveiller ferait mentir
    // l'interface.
    $$('button[data-libelle]', f).forEach(function (b) {
      b.textContent = b.dataset.libelle;
      delete b.dataset.libelle;
      b.disabled = false;
    });
    etatDuFormulaire(f, f.classList.contains('modifie') ? 'Non enregistré' : '');
  };

  var formulaires = $$('.adm form').filter(function (f) {
    return !f.hasAttribute('data-sans-garde');
  });

  formulaires.forEach(function (f) {
    var marquer = function () {
      // Retoucher un formulaire bloqué le débloque : c'est la sortie de
      // secours la plus naturelle, et elle ne demande rien à personne.
      if (f.dataset.envoye) liberer(f);
      if (f.classList.contains('modifie')) return;
      f.classList.add('modifie');
      etatDuFormulaire(f, 'Non enregistré');
    };
    f.addEventListener('input', marquer);
    f.addEventListener('change', marquer);
  });

  window.addEventListener('beforeunload', function (e) {
    // La question porte sur ce qui reste ouvert, pas sur ce qui part.
    // Demander « voulez-vous vraiment quitter ? » à quelqu'un qui vient
    // de cliquer sur « Enregistrer », c'est l'alerte qu'on apprend à
    // ignorer — mais se taire complètement pendant qu'un formulaire
    // part, c'était laisser perdre en silence une AUTRE section restée
    // ouverte. D'où « :not([data-envoye]) » : on avertit s'il reste du
    // travail non enregistré ailleurs.
    if (!document.querySelector('.adm form.modifie:not([data-envoye])')) return;
    e.preventDefault();
    e.returnValue = '';
  });

  /* -----------------------------------------------------------------
     4. Revenir là où on en était, et voir que ça travaille

     Le serveur renvoie vers la page indiquée par le champ « retour ».
     On lui joint le nom de la section : après enregistrement, la page se
     rouvre à la bonne hauteur au lieu de repartir du haut. Le fragment
     est ajouté par le serveur, après les paramètres — sans quoi il
     avalerait le reste de l'adresse.

     Et pendant ce temps, le bouton le dit. L'envoi d'une vidéo de 55 Mo
     laissait la page parfaitement immobile pendant une minute : seul
     « aria-busy » était posé, et aucune règle de style ne le regardait.
     ----------------------------------------------------------------- */
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!(f instanceof HTMLFormElement)) return;

    if (f.dataset.envoye) {
      e.preventDefault();
      return;
    }
    f.dataset.envoye = String(Date.now());
    f.setAttribute('aria-busy', 'true');
    envoiEnCours = f;

    if (!f.hasAttribute('data-sans-garde')) {
    $$('button[type="submit"], button:not([type])', f).forEach(function (b) {
      if (b.name === 'action' && b.value && b.value !== 'ajouter') return; // ↑ ↓ Supprimer
      b.dataset.libelle = b.textContent;
      b.textContent = 'Enregistrement…';
      // Désactivé après coup : un bouton désactivé pendant le traitement
      // de l'événement n'enverrait ni son nom ni sa valeur.
      setTimeout(function () {
        b.disabled = true;
      }, 0);
    });
    etatDuFormulaire(f, 'Envoi en cours…');
    }

    // Filet : si rien ne se passe — réponse qui ne vient pas, navigation
    // annulée — le formulaire redevient utilisable de lui-même.
    setTimeout(function () {
      liberer(f);
    }, 15000);

    var section = f.closest('.adm__section');
    if (!section || !section.id || !f.querySelector('[name="retour"]')) return;
    if (f.querySelector('[name="ancre"]')) return;
    var champ = document.createElement('input');
    champ.type = 'hidden';
    champ.name = 'ancre';
    champ.value = section.id;
    f.appendChild(champ);
  });

  // Page restaurée depuis le cache, ou onglet retrouvé : les formulaires
  // redeviennent utilisables. L'admin est en « no-store », donc le cache
  // de navigation ne s'applique pas — d'où le second événement, qui lui
  // se déclenche vraiment.
  var toutLiberer = function (ageMinimum) {
    $$('form[data-envoye]').forEach(function (f) {
      if (ageMinimum && Date.now() - Number(f.dataset.envoye) < ageMinimum) return;
      liberer(f);
    });
  };
  window.addEventListener('pageshow', function () {
    toutLiberer(0);
  });
  document.addEventListener('visibilitychange', function () {
    // Revenir sur l'onglet ne doit pas rouvrir un envoi encore en cours :
    // pendant le téléversement d'une vidéo de 55 Mo, on a tout le temps
    // d'aller voir ailleurs et de revenir.
    if (document.visibilityState === 'visible') toutLiberer(30000);
  });

  /* -----------------------------------------------------------------
     5. Ctrl + S enregistre la section où l'on se trouve
     ----------------------------------------------------------------- */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 's' || !(e.ctrlKey || e.metaKey) || e.altKey) return;
    var actif = document.activeElement;
    var f = actif && actif.closest ? actif.closest('form') : null;
    // Sans curseur dans un formulaire, on ne devine pas : l'ancienne
    // version prenait le premier formulaire modifié de la page, qui
    // n'était pas forcément celui qu'on regardait.
    if (!f || f.hasAttribute('data-sans-garde') || !f.classList.contains('modifie')) return;
    e.preventDefault();
    if (typeof f.requestSubmit === 'function') f.requestSubmit();
    else f.submit();
  });

  /* -----------------------------------------------------------------
     6. Confirmation avant suppression — elles sont définitives
     ----------------------------------------------------------------- */
  document.addEventListener(
    'click',
    function (e) {
      var cible = e.target.closest && e.target.closest('[data-confirmer]');
      if (cible && !window.confirm(cible.getAttribute('data-confirmer'))) {
        e.preventDefault();
        e.stopPropagation();
        var f = cible.closest('form');
        if (f) delete f.dataset.envoye;
      }
    },
    true
  );

  /* -----------------------------------------------------------------
     7. Le message d'enregistrement s'efface tout seul

     Et surtout : le paramètre disparaît de l'adresse. Sans ça, un simple
     rechargement réaffiche « Modifications enregistrées » alors que rien
     n'a été fait — on finit par ne plus y croire.
     ----------------------------------------------------------------- */
  (function () {
    if (window.history && window.history.replaceState && /[?&](ok|err)=/.test(location.search)) {
      var url = new URL(location.href);
      url.searchParams.delete('ok');
      url.searchParams.delete('err');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    // Mise au point sur le message : une zone « aria-live » n'annonce que
    // ce qui y apparaît après coup, et celui-ci vient du serveur. Sans
    // cela, l'enregistrement n'était confirmé ni à l'œil — le message
    // étant hors écran après le saut d'ancre — ni à la voix.
    var annonce = $('[data-annonce]');
    if (annonce) {
      setTimeout(function () {
        annonce.focus({ preventScroll: true });
      }, 60);

      // Le message de succès s'efface seul au bout de six secondes ; celui
      // d'erreur reste, parce qu'on doit pouvoir le relire. Mais il est
      // collé en haut de l'écran : sans moyen de le fermer, il recouvrirait
      // le travail jusqu'au prochain chargement.
      if (!annonce.hasAttribute('data-ephemere')) {
        var fermer = document.createElement('button');
        fermer.type = 'button';
        fermer.className = 'adm__fermer';
        fermer.textContent = '×';
        fermer.setAttribute('aria-label', 'Fermer ce message');
        fermer.addEventListener('click', function () {
          annonce.remove();
        });
        annonce.appendChild(fermer);
      }
    }

    var message = $('[data-ephemere]');
    if (!message) return;
    setTimeout(function () {
      message.style.transition = 'opacity 400ms ease';
      message.style.opacity = '0';
      setTimeout(function () {
        message.remove();
      }, 420);
    }, 6000);
  })();

  /* -----------------------------------------------------------------
     8. Ce qu'il reste à taper

     Sur les champs bornés — une description de référencement coupée par
     Google, un résumé qui doit tenir sur une carte — savoir qu'il reste
     douze caractères évite de découvrir la troncature sur le site.
     ----------------------------------------------------------------- */
  var numeroCompteur = 0;
  $$('.adm [maxlength]').forEach(function (champ) {
    var max = Number(champ.getAttribute('maxlength'));
    // Sous quarante caractères, un compteur est du bruit : sur le champ
    // « Année », il affichait « 20 / 20 » et n'apprenait rien.
    if (!max || max < 40 || max > 4000) return;
    var parent = champ.closest('.adm__champ');
    if (!parent) return;

    var compteur = document.createElement('p');
    compteur.className = 'adm__compteur';
    compteur.id = 'compteur-' + ++numeroCompteur;
    // Relié au champ : sans ça, l'information n'existe que pour l'œil.
    var decrit = champ.getAttribute('aria-describedby');
    champ.setAttribute('aria-describedby', decrit ? decrit + ' ' + compteur.id : compteur.id);
    parent.appendChild(compteur);

    var relire = function () {
      var reste = max - champ.value.length;
      var limite = reste <= 10;
      compteur.classList.toggle('adm__compteur--limite', limite);
      // La couleur seule ne suffit pas à signaler qu'on arrive au bout.
      compteur.textContent = limite ? reste + ' / ' + max + ' — presque plein' : reste + ' / ' + max;
    };
    champ.addEventListener('input', relire);
    relire();
  });

  /* -----------------------------------------------------------------
     9. Les zones de texte grandissent avec le texte
     ----------------------------------------------------------------- */
  var zones = $$('.adm textarea');
  var ajusterTout = function () {
    zones.forEach(function (zone) {
      zone.style.height = 'auto';
      // Un élément non rendu — onglet masqué, conteneur replié — a une
      // hauteur de défilement nulle : on le laisse tranquille plutôt que
      // de l'écraser sur deux pixels.
      if (!zone.scrollHeight) {
        zone.style.height = '';
        return;
      }
      zone.style.height = Math.min(zone.scrollHeight + 2, 640) + 'px';
    });
  };

  zones.forEach(function (zone) {
    zone.addEventListener('input', function () {
      zone.style.height = 'auto';
      if (zone.scrollHeight) zone.style.height = Math.min(zone.scrollHeight + 2, 640) + 'px';
    });
  });
  ajusterTout();

  // La hauteur était calculée une fois, avant le chargement des polices :
  // le texte était mesuré en Georgia puis rendu en Spectral, et la zone
  // restait trop courte, avec une barre de défilement interne sur le seul
  // écran où l'on vient relire un paragraphe entier.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(ajusterTout).catch(function () {});
  }
  var reajustement = 0;
  window.addEventListener('resize', function () {
    clearTimeout(reajustement);
    reajustement = setTimeout(ajusterTout, 150);
  });

  /* -----------------------------------------------------------------
     10. Le média choisi s'affiche

     Un champ qui dit « #14 » ne dit rien. Chaque option porte l'adresse
     de sa vignette ; il suffit de la montrer, et de la changer à chaque
     choix. C'est ce qui évite de mettre la mauvaise image en fond de
     l'écran d'accueil et de s'en apercevoir sur le site.
     ----------------------------------------------------------------- */
  $$('select[data-media]').forEach(function (select) {
    var bloc = select.closest('.adm__media');
    var apercu = bloc && bloc.querySelector('.adm__apercu');
    if (!apercu) return;

    var montrer = function () {
      var option = select.options[select.selectedIndex];
      var src = option ? option.getAttribute('data-apercu') : '';
      var genre = option ? option.getAttribute('data-genre') : '';
      apercu.replaceChildren();
      if (!src) {
        apercu.classList.add('adm__apercu--vide');
        return;
      }
      apercu.classList.remove('adm__apercu--vide');
      var el;
      if (genre === 'video') {
        el = document.createElement('video');
        el.muted = true;
        el.loop = true;
        el.playsInline = true;
        el.preload = 'metadata';
        el.setAttribute('aria-hidden', 'true');
      } else {
        el = document.createElement('img');
        el.alt = '';
        el.loading = 'lazy';
      }
      el.src = src;
      apercu.appendChild(el);
    };
    select.addEventListener('change', montrer);
    montrer();
  });

  /* -----------------------------------------------------------------
     11. Le fichier qu'on vient de choisir

     Avant l'envoi : son nom, son poids, et l'image elle-même. Un fichier
     trop lourd se voit avant de passer deux minutes à le téléverser pour
     rien.
     ----------------------------------------------------------------- */
  $$('.adm input[type="file"]').forEach(function (champ) {
    var parent = champ.closest('.adm__champ');
    if (!parent) return;

    var info = document.createElement('p');
    info.className = 'adm__note';
    parent.appendChild(info);

    var apercu = document.createElement('figure');
    apercu.className = 'adm__apercu adm__apercu--vide';
    apercu.style.maxWidth = '9rem';
    apercu.hidden = true;
    parent.appendChild(apercu);

    var adresse = '';
    champ.addEventListener('change', function () {
      if (adresse) {
        URL.revokeObjectURL(adresse);
        adresse = '';
      }
      apercu.replaceChildren();
      apercu.hidden = true;

      var fichier = champ.files && champ.files[0];
      if (!fichier) {
        info.textContent = '';
        var bouton = champ.form && champ.form.querySelector('button[type="submit"], button:not([type])');
        if (bouton) bouton.disabled = false;
        return;
      }

      var mo = fichier.size / 1048576;
      info.textContent =
        fichier.name + ' — ' + (mo >= 1 ? mo.toFixed(1) + ' Mo' : Math.round(fichier.size / 1024) + ' Ko');

      // Les limites viennent du serveur (src/lib/media.ts), posées sur le
      // champ par le gabarit : deux valeurs écrites en double finissent
      // toujours par diverger.
      // Une limite par type : les champs qui acceptent image ET vidéo
      // n'ont pas la même. Avec une valeur unique de 60, une image de
      // 30 Mo passait le contrôle, partait entièrement, et n'était
      // refusée qu'au bout des deux minutes de téléversement.
      var estVideo = /^video\//.test(fichier.type);
      var limite = Number(estVideo ? champ.dataset.limiteVideoMo : champ.dataset.limiteImageMo) ||
        (estVideo ? 60 : 15);
      var envoi = champ.form && champ.form.querySelector('button[type="submit"], button:not([type])');
      if (mo > limite) {
        info.textContent += ' — trop lourd, la limite est de ' + limite + ' Mo.';
        info.classList.add('adm__compteur--limite');
        // Et l'envoi est bloqué. Il ne l'était pas : le message
        // s'affichait, le fichier partait quand même, et les deux minutes
        // de téléversement étaient perdues pour rien.
        if (envoi) envoi.disabled = true;
        return;
      }
      info.classList.remove('adm__compteur--limite');
      if (envoi) envoi.disabled = false;

      if (/^image\//.test(fichier.type)) {
        adresse = URL.createObjectURL(fichier);
        var img = document.createElement('img');
        img.src = adresse;
        img.alt = '';
        apercu.replaceChildren(img);
        apercu.classList.remove('adm__apercu--vide');
        apercu.hidden = false;
      }
    });

    window.addEventListener('pagehide', function () {
      if (adresse) URL.revokeObjectURL(adresse);
    });
  });
})();
