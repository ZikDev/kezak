/**
 * Remplit la base avec les contenus des maquettes.
 * À lancer une seule fois après l'installation :  npm run seed
 * Ne touche à rien si du contenu existe déjà.
 *
 * Les valeurs entre crochets sont des trous à combler depuis /admin.
 */
import { ouvrir } from './outils.mjs';

const { db } = await ouvrir();

const dejaLa = db.prepare('SELECT COUNT(*) AS n FROM projets').get().n;
if (dejaLa > 0) {
  console.log('Du contenu existe déjà — rien n’a été modifié.');
  process.exit(0);
}

const REGLAGES = {
  site_nom: 'Kezak',
  lieu: 'Romont',
  email: 'contact@kezak.ch',
  telephone: '',
  pied_phrase: 'Kezak est le studio de Victor Bertschy',
  seo_description:
    "Studio de design web et d'image à Romont. Des sites rapides et accessibles, et l'image qui va dedans.",
  reseau_instagram: 'https://www.instagram.com/kezak.ch/',
  reseau_linkedin: '',
  reseau_behance: '',
  annuaire_intro:
    "Web, vidéo, motion, 3D, photographie, son. Les trois premiers sont ceux que je montrerais en premier ; le reste dit d'où je viens.",
  annuaire_relance_titre: 'Vous ne trouvez pas un cas proche du vôtre ?',
  annuaire_relance_texte: 'Décrivez-le en trois lignes, je réponds sous une semaine.',
  studio_titre: 'Kezak est le studio\nde Victor Bertschy.',
  studio_intro:
    "Je fais des sites, et je viens de l'image. Les deux métiers se tiennent : un site se juge sur ce qu'on y voit autant que sur ce qu'on y lit.",
  studio_description:
    'Le studio, les prestations, la méthode de travail et les questions fréquentes.',
  prestations_note: 'Trois prestations · périmètre fermé',
  disponibilite: 'Réponse sous 1 semaine',
  langues: 'Français · Anglais · Allemand (notions)',
  outils: 'Astro · CSS · Figma · Premiere · After Effects',
  faq_note: 'Les réponses que je donnerais de toute façon au téléphone. Autant les écrire.',
  appel_titre: 'Dites-moi ce que vous avez en tête.',
  appel_texte:
    "Trois lignes suffisent pour savoir si je suis la bonne personne. Réponse sous une semaine.",
  contact_intro:
    "Décrivez votre projet en quelques lignes — même s'il est encore flou. Vous avez une réponse sous une semaine au maximum, et un devis détaillé si le projet nous va à tous les deux.",
  contact_description: 'Décrivez votre projet, réponse sous une semaine au maximum.',
  contact_lieu: 'Romont, canton de Fribourg. Je me déplace en Suisse romande.',
  contact_agences:
    "Agences : je travaille aussi en sous-traitance — intégration front-end, motion design, cadrage. Dites-le dans le message, je réponds avec mon tarif journalier.",
  generique_note:
    "Extrait du générique du film, tel qu'il y figure. Les postes que je n'ai pas tenus sont nommés aussi : c'est ce qui rend le mien crédible.",
};

const PROJETS = [
  {
    slug: 'we-are-all-young-gods',
    titre: 'We Are All Young Gods',
    categorie: 'video',
    categorie_txt: 'Vidéo · Motion',
    annee: '2026',
    resume:
      'Cadreur en mandat indépendant · identité graphique et affiche avec [NOM], via eikonLAB',
    chapeau:
      'Documentaire de concert, 90 minutes. Première mondiale au FIFF 2026, diffusion RTS 2.',
    role: 'Cadreur · graphisme et motion design',
    realisation: 'Julien Minguely & Ludovic Matthey',
    production: 'Two Gentlemen · Les Productions Romandes · Mille-huitante',
    diffusion: 'FIFF 2026 · RTS 2 · Play RTS',
    note: "Identité graphique co-conçue avec [NOM], dans le cadre d'eikonLAB.",
    citation: '[CITATION À DEMANDER À LA RÉALISATION — deux lignes suffisent.]',
    citation_qui: '[NOM], RÉALISATION',
    youtube: '',
    statut: 'publie',
    en_avant: 1,
    sections: [
      [
        'Le contexte',
        "Premier documentaire consacré aux Young Gods depuis quinze ans, construit autour de leur concert à Fri-Son en décembre 2025. Un groupe fribourgeois de quarante ans de carrière, une salle historique, et une production qui visait d'emblée le festival et la télévision.",
      ],
      [
        'Le problème',
        "Traduire une identité sonore — brutale, électronique, saturée — en système visuel, sans tomber dans le pastiche des années 80. Il fallait quelque chose qui tienne aussi bien sur une affiche F4 que sur une vignette Instagram.",
      ],
      [
        "Ce que j'ai fait",
        "Sur le tournage, j'étais au cadre, en mandat indépendant. En amont, avec [NOM] et dans le cadre d'eikonLAB, nous avons construit l'univers typographique, chromatique et texturé du film : recherche d'archives, travail sur matières physiques, et un parti pris qui fait de l'éclairage du concert la source de toute la palette.\n\nJ'ai réalisé l'affiche et le teaser destiné aux réseaux. Je suis crédité au générique en graphisme et motion design.",
      ],
      [
        'Le résultat',
        'Première mondiale au FIFF le 27 mars 2026 en Séances de minuit, salle pleine, le groupe présent. Diffusion sur RTS 2 le 21 juillet 2026, puis sur Play RTS.',
      ],
    ],
    faits: [
      ['Durée', '90 min'],
      ['Langues', 'FR / DE / EN'],
      ['Section', 'Séances de minuit'],
      ['Première', '27.03.2026'],
      ['TV', '21.07.2026, RTS 2'],
    ],
    credits: [
      ['Réalisation', 'Julien Minguely, Ludovic Matthey', 0],
      ['Production', 'Two Gentlemen, Les Productions Romandes, Mille-huitante', 0],
      ['Image', '[ÉQUIPE IMAGE], Victor Bertschy', 1],
      ['Graphisme, motion design', 'Victor Bertschy, [NOM]', 1],
      ['Montage', '[À COMPLÉTER]', 0],
      ['Son', '[À COMPLÉTER]', 0],
      ['Avec', 'The Young Gods', 0],
      ['Lieu, date', 'Fri-Son, Fribourg — décembre 2025', 0],
      ['Images', '© la production — reproduites avec autorisation', 0],
    ],
  },
  {
    slug: 'mediation-culturelle-fribourg',
    titre: 'Médiation Culturelle Fribourg',
    categorie: 'web',
    categorie_txt: 'Web · UX',
    annee: '2025',
    resume: "Architecture d'information et parcours de recherche d'un annuaire de professionnels",
    chapeau: "Maquette et direction artistique d'un annuaire de la médiation culturelle.",
    role: 'UX · direction artistique',
    realisation: '',
    production: 'eikonLAB',
    diffusion: '',
    note: "Maquette co-conçue avec un camarade, dans le cadre d'eikonLAB. Le site a ensuite été développé par le responsable du projet.",
    statut: 'publie',
    en_avant: 1,
    sections: [
      [
        'Le contexte',
        "Un annuaire qui référence les professionnels de la médiation culturelle du canton de Fribourg, commandé dans le cadre de notre premier stage à eikonLAB au printemps 2025.",
      ],
      [
        'Le problème',
        "Rendre lisible un annuaire de personnes aux métiers très divers, pour un public qui ne connaît pas le vocabulaire du domaine. Nous avions carte blanche sur la direction artistique.",
      ],
      [
        "Ce que j'ai fait",
        "J'ai conçu l'architecture d'information et les parcours de recherche : comment on entre dans l'annuaire, comment on filtre, comment on ressort avec le bon contact. Mon camarade s'est davantage concentré sur l'interface. Nous avons aussi retravaillé le logo qui nous était proposé.",
      ],
      ['Le résultat', 'Maquette validée, puis développée par notre responsable de projet.'],
    ],
    faits: [
      ['Année', '2025'],
      ['Cadre', 'eikonLAB'],
      ['Rôle', 'UX'],
    ],
    credits: [],
  },
  {
    slug: 'conservatoire-de-fribourg',
    titre: 'Conservatoire de Fribourg',
    categorie: 'video',
    categorie_txt: 'Vidéo',
    annee: '2025',
    resume: 'Court documentaire de promotion sur les jeunes talents du conservatoire',
    chapeau: 'Promotion du programme Jeunes Talents Musique.',
    role: 'Image · montage',
    production: 'eikonLAB',
    statut: 'publie',
    en_avant: 1,
    sections: [
      ['Le contexte', '[À COMPLÉTER — le cadre de la commande.]'],
      ['Le problème', '[À COMPLÉTER — ce qu’il fallait résoudre.]'],
      ["Ce que j'ai fait", '[À COMPLÉTER — votre rôle exact, en une phrase précise.]'],
      ['Le résultat', '[À COMPLÉTER — diffusion, retours, chiffres.]'],
    ],
    faits: [],
    credits: [],
  },
  { slug: 'declic', titre: 'Déclic', categorie: 'autre', categorie_txt: 'Installation — Morat Lumières', annee: '2025', statut: 'publie' },
  { slug: 'transitions-rts', titre: 'Transitions RTS', categorie: 'motion', categorie_txt: 'Motion design', annee: '2024', statut: 'publie' },
  { slug: 'ceres-corp', titre: 'Ceres Corp.', categorie: 'video', categorie_txt: 'Courts-métrages', annee: '2024', statut: 'publie' },
  { slug: 'grenouche', titre: 'Grenouche', categorie: 'autre', categorie_txt: 'Jeu vidéo', annee: '2024', statut: 'publie' },
  { slug: 'aeroport', titre: 'Aéroport', categorie: 'motion', categorie_txt: '3D', annee: '2023', statut: 'publie' },
  { slug: 'stereoscopie', titre: 'Stéréoscopie', categorie: 'photo', categorie_txt: 'Photographie', annee: '2023', statut: 'publie' },
  { slug: 'glitch', titre: 'Glitch', categorie: 'motion', categorie_txt: '3D', annee: '2023', statut: 'publie' },
  { slug: 'compositions', titre: 'Compositions', categorie: 'son', categorie_txt: 'Musique', annee: '2022', statut: 'publie' },
  { slug: 'curiosites', titre: 'Curiosités', categorie: 'autre', categorie_txt: 'Apprentissage', annee: '2022', statut: 'publie' },
];

const PRESTATIONS = [
  [
    'Site vitrine',
    'Sur devis · environ 4 semaines',
    "Cinq pages, contenu fourni, statique. Conforme WCAG 2.1 AA et hébergement inclus la première année.",
  ],
  [
    'Page + vidéo',
    'Sur devis · environ 3 semaines',
    "Une page de conversion et la vidéo de présentation qui va dedans. Tournage, montage, intégration — un seul interlocuteur.",
  ],
  [
    'Maintenance',
    'Forfait mensuel · sur devis',
    'Mises à jour, sauvegardes, petites modifications, surveillance. Sans engagement de durée.',
  ],
];

const METHODE = [
  [
    'Vous avez une réponse sous une semaine.',
    "Toujours. Et je ne prends que des projets dont le périmètre est écrit à l'avance — c'est ce qui permet de tenir une date au lieu de la promettre.",
  ],
  [
    'Un devis détaillé avant de commencer.',
    "Postes, montants, dates, et ce qui n'est pas compris. Vous le validez, il ne bouge plus.",
  ],
  [
    'Vous voyez le travail chaque semaine.',
    'Une adresse de préversion dès la première semaine, mise à jour au fur et à mesure. Une série de retours est comprise, les suivantes sont chiffrées avant d’être faites.',
  ],
  [
    'Le site vous appartient.',
    "Code, contenus, nom de domaine, comptes d'hébergement : tout est à votre nom. Vous pouvez partir sans rien redemander.",
  ],
];

const FAQ = [
  [
    'Combien coûte un site ?',
    "Le prix dépend du nombre de pages, de qui écrit les textes, et de la présence ou non de photo et de vidéo. Décrivez-moi votre projet en trois lignes et vous recevez un devis détaillé et gratuit, poste par poste, avant tout engagement.",
  ],
  [
    "Pourquoi parlez-vous autant d'accessibilité ?",
    "Parce qu'elle est obligatoire pour les entités publiques et para-publiques suisses, et depuis juin 2025 pour les entreprises qui vendent dans l'Union européenne. Et parce qu'un site accessible est un site plus rapide, mieux référencé et plus simple à maintenir.",
  ],
  [
    'Quels sont vos délais ?',
    "Vous avez une réponse à votre premier message sous une semaine au maximum. Comptez ensuite environ quatre semaines pour un site vitrine, trois pour une page avec vidéo. Si votre échéance est plus courte, dites-le dès le premier message : je vous dirai franchement si c'est tenable.",
  ],
  [
    'Que dois-je fournir ?',
    "Les textes, votre logo en vectoriel, et les images dont vous détenez les droits. Si vous partez de zéro, je peux m'en charger — c'est un poste séparé du devis.",
  ],
  [
    'Travaillez-vous pour des agences ?',
    'Oui, en sous-traitance : intégration front-end, motion design, cadrage. Tarif journalier sur demande, et je signe ce que vous voulez côté confidentialité.',
  ],
];

const PARCOURS = [
  ['2026', "Crédité au générique d'un documentaire — FIFF, RTS 2"],
  ['2022–2026', 'CFC Interactive Media Designer + maturité — eikon, Fribourg'],
  ['2025', 'Interactive Media Designer — Donuts Communication, Fribourg'],
  ['2025 →', 'Photographe — Globull, Bulle'],
  ['2023 →', 'Photo-reporter — AG Culturel, Romandie'],
  ['2023–2025', 'Photographe — Le Nouveau Monde, Fribourg'],
  ['Références', 'Sur demande'],
];

const ETAPES = [
  "Je réponds sous une semaine, même si c'est pour dire non.",
  'Un appel de vingt minutes pour cadrer le besoin.',
  'Un devis détaillé et gratuit, poste par poste, avec les dates.',
];

/* ------------------------------------------------------------------ */

const inserer = db.transaction(() => {
  const reg = db.prepare(
    'INSERT INTO reglages (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur'
  );
  for (const [k, v] of Object.entries(REGLAGES)) reg.run(k, v);

  const insProjet = db.prepare(`
    INSERT INTO projets (slug, titre, categorie, categorie_txt, annee, resume, chapeau, role,
                         realisation, production, diffusion, citation, citation_qui, note,
                         youtube, statut, position, en_avant)
    VALUES (@slug, @titre, @categorie, @categorie_txt, @annee, @resume, @chapeau, @role,
            @realisation, @production, @diffusion, @citation, @citation_qui, @note,
            @youtube, @statut, @position, @en_avant)
  `);
  const insSection = db.prepare(
    'INSERT INTO projet_sections (projet_id, position, titre, corps) VALUES (?, ?, ?, ?)'
  );
  const insFait = db.prepare(
    'INSERT INTO projet_faits (projet_id, position, etiquette, valeur) VALUES (?, ?, ?, ?)'
  );
  const insCredit = db.prepare(
    'INSERT INTO projet_credits (projet_id, position, poste, noms, cest_moi) VALUES (?, ?, ?, ?, ?)'
  );

  const ids = {};
  PROJETS.forEach((p, i) => {
    const res = insProjet.run({
      slug: p.slug,
      titre: p.titre,
      categorie: p.categorie ?? 'autre',
      categorie_txt: p.categorie_txt ?? '',
      annee: p.annee ?? '',
      resume: p.resume ?? '',
      chapeau: p.chapeau ?? '',
      role: p.role ?? '',
      realisation: p.realisation ?? '',
      production: p.production ?? '',
      diffusion: p.diffusion ?? '',
      citation: p.citation ?? '',
      citation_qui: p.citation_qui ?? '',
      note: p.note ?? '',
      youtube: p.youtube ?? '',
      statut: p.statut ?? 'brouillon',
      position: i,
      en_avant: p.en_avant ?? 0,
    });
    const id = Number(res.lastInsertRowid);
    ids[p.slug] = id;
    (p.sections ?? []).forEach((s, j) => insSection.run(id, j, s[0], s[1]));
    (p.faits ?? []).forEach((f, j) => insFait.run(id, j, f[0], f[1]));
    (p.credits ?? []).forEach((c, j) => insCredit.run(id, j, c[0], c[1], c[2]));
  });

  const insEcran = db.prepare(`
    INSERT INTO accueil_ecrans (position, genre, surtitre, titre, texte, projet_id, lien_libelle)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insEcran.run(0, 'immersion', 'Romont · Suisse', 'Kezak', '', null, '');
  insEcran.run(
    1,
    'phrase',
    "Studio de design web et d'image",
    'Des sites tenus au millimètre.\nEt l’image qui va dedans.',
    "Je conçois des sites pour les institutions culturelles et les PME romandes. Conformes WCAG 2.1 AA et livrés en quatre semaines. Et je viens de l'image, donc je produis aussi ce qu'on met dedans.",
    null,
    ''
  );
  insEcran.run(2, 'projet', 'FIFF 2026 · RTS 2', '', '', ids['we-are-all-young-gods'], 'Voir le projet');
  insEcran.run(3, 'projet', 'Site web · UX', '', '', ids['mediation-culturelle-fribourg'], 'Voir le projet');
  insEcran.run(4, 'projet', 'Vidéo institutionnelle', '', '', ids['conservatoire-de-fribourg'], 'Voir le projet');
  insEcran.run(
    5,
    'action',
    'Un projet, une question, un devis',
    'Dites-moi ce que\nvous avez en tête.',
    'Trois lignes suffisent pour savoir si je suis la bonne personne. Réponse sous une semaine.',
    null,
    ''
  );

  const p1 = db.prepare('INSERT INTO prestations (position, titre, meta, corps) VALUES (?, ?, ?, ?)');
  PRESTATIONS.forEach((x, i) => p1.run(i, x[0], x[1], x[2]));

  const p2 = db.prepare('INSERT INTO methode (position, titre, corps) VALUES (?, ?, ?)');
  METHODE.forEach((x, i) => p2.run(i, x[0], x[1]));

  const p3 = db.prepare('INSERT INTO faq (position, question, reponse) VALUES (?, ?, ?)');
  FAQ.forEach((x, i) => p3.run(i, x[0], x[1]));

  const p4 = db.prepare('INSERT INTO parcours (position, periode, texte) VALUES (?, ?, ?)');
  PARCOURS.forEach((x, i) => p4.run(i, x[0], x[1]));

  const p5 = db.prepare('INSERT INTO etapes_contact (position, texte) VALUES (?, ?)');
  ETAPES.forEach((x, i) => p5.run(i, x));
});

inserer();

console.log(`${PROJETS.length} projets, 6 écrans d'accueil, ${FAQ.length} questions et les réglages ont été créés.`);
console.log('Les mentions entre crochets sont des trous à combler depuis /admin.');
db.close();
