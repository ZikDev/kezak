/**
 * Ce que l'admin a le droit d'écrire.
 *
 * Aucune colonne n'est modifiable si elle ne figure pas ici. C'est la
 * différence entre un formulaire générique pratique et une porte ouverte :
 * même si quelqu'un forge une requête à la main, il ne peut toucher qu'aux
 * colonnes de cette liste.
 */

export const CHAMPS: Record<string, string[]> = {
  accueil_ecrans: [
    'genre',
    'surtitre',
    'titre',
    'texte',
    'media_id',
    'video_id',
    'projet_id',
    'lien_libelle',
    'lien_url',
    'actif',
  ],
  projets: [
    'slug',
    'titre',
    'categorie',
    'categorie_txt',
    'annee',
    'resume',
    'chapeau',
    'hero_id',
    'video_fond_id',
    'youtube',
    'role',
    'realisation',
    'production',
    'diffusion',
    'citation',
    'citation_qui',
    'note',
    'statut',
    'en_avant',
  ],
  projet_sections: ['titre', 'corps'],
  projet_faits: ['etiquette', 'valeur'],
  projet_credits: ['poste', 'noms', 'cest_moi', 'url'],
  projet_liens: ['libelle', 'url', 'note'],
  projet_medias: ['legende', 'large', 'media_id'],
  // « youtube » n'est volontairement pas ici : sa valeur est validée par
  // la route dédiée, pas reprise telle quelle depuis un formulaire.
  prestations: ['titre', 'meta', 'corps'],
  methode: ['titre', 'corps'],
  faq: ['question', 'reponse'],
  parcours: ['periode', 'texte'],
  etapes_contact: ['texte'],
  medias: ['alt', 'legende'],
};

/**
 * Colonnes qui contiennent une adresse, et qui finiront donc dans un
 * attribut « href ».
 *
 * Elles sont traitées à part parce qu'un lien n'est pas du texte : une
 * valeur commençant par « javascript: » devient du code exécuté au clic,
 * sur le domaine du site, avec la session de qui clique. L'échappement
 * HTML n'y change rien — il protège la structure de la page, pas le
 * schéma d'une URL.
 */
const LIENS = new Set(['url', 'lien_url']);

/**
 * Les réglages qui sont des adresses. Même raison que ci-dessus, et le
 * même oubli : les trois liens de réseaux sociaux étaient enregistrés par
 * la fonction de nettoyage ordinaire, celle qui ne regarde pas le schéma.
 * Ils finissent pourtant dans un « href », en pied de page de TOUTES les
 * pages du site.
 */
export const REGLAGES_LIENS = new Set(['reseau_instagram', 'reseau_linkedin', 'reseau_behance']);

/** Colonnes numériques : converties, et vidées vers NULL si le champ est vide. */
const NUMERIQUES = new Set([
  'media_id',
  'video_id',
  'projet_id',
  'hero_id',
  'video_fond_id',
  'actif',
  'en_avant',
  'cest_moi',
  'large',
]);

/** Les réglages modifiables depuis /admin/general et les pages de contenu. */
export const REGLAGES_AUTORISES = new Set([
  'site_nom',
  'lieu',
  'email',
  'telephone',
  'pied_phrase',
  'seo_description',
  'reseau_instagram',
  'reseau_linkedin',
  'reseau_behance',
  'annuaire_intro',
  'annuaire_relance_titre',
  'annuaire_relance_texte',
  'annuaire_description',
  'studio_titre',
  'studio_intro',
  'studio_description',
  'prestations_note',
  'disponibilite',
  'langues',
  'outils',
  'faq_note',
  'appel_titre',
  'appel_texte',
  'contact_intro',
  'contact_description',
  'contact_lieu',
  'contact_agences',
  // Anciennement « generique_note » : la section s'appelle « Crédits »,
  // parce qu'un projet web ou photo n'a pas de générique. La migration 2
  // déplace la valeur enregistrée sous l'ancien nom.
  'credits_note',
  'portrait_id',
]);

/** Filtre un corps de formulaire et ne garde que ce qui est autorisé. */
export function champsAutorises(table: string, data: FormData): Record<string, any> {
  const permis = CHAMPS[table];
  if (!permis) throw new Error('Table non autorisée');
  const sortie: Record<string, any> = {};
  for (const col of permis) {
    if (!data.has(`c_${col}`)) continue;
    const brut = data.get(`c_${col}`);
    if (NUMERIQUES.has(col)) {
      const s = String(brut ?? '').trim();
      sortie[col] = s === '' ? null : Number(s) || 0;
    } else if (LIENS.has(col)) {
      sortie[col] = lienSur(brut);
    } else {
      sortie[col] = nettoyer(brut, col === 'corps' || col === 'reponse' || col === 'texte' ? 8000 : 2000);
    }
  }
  // Les cases à cocher n'envoient rien quand elles sont décochées.
  for (const col of permis) {
    if (NUMERIQUES.has(col) && data.has(`b_${col}`)) {
      sortie[col] = data.get(`c_${col}`) ? 1 : 0;
    }
  }
  return sortie;
}

export function nettoyer(v: unknown, max = 2000): string {
  return String(v ?? '')
    .replace(/\r\n/g, '\n')
    // Caractères de contrôle : ils ne servent qu'à casser un affichage ou
    // un journal. On garde \n et \t, on retire le reste.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

/**
 * Valeur destinée à une seule ligne : aucun retour à la ligne, aucune
 * tabulation. À utiliser partout où la chaîne finit dans un en-tête —
 * l'objet d'un courriel, un nom d'expéditeur — parce que c'est là qu'un
 * retour chariot permet d'ajouter un en-tête qu'on n'a pas demandé.
 */
export function nettoyerLigne(v: unknown, max = 200): string {
  return nettoyer(v, max).replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
}

/**
 * Une adresse destinée à un attribut « href », ou rien.
 *
 * Trois schémas sont acceptés — http, https, mailto — et un chemin interne
 * commençant par une seule barre oblique. Tout le reste renvoie une chaîne
 * vide : « javascript: », « data: », « vbscript: », et les variantes
 * qu'on obtient en glissant une tabulation ou un caractère de contrôle au
 * milieu du mot (« java\tscript: »), que le navigateur ignore et que le
 * schéma retrouve intact. C'est pourquoi le nettoyage a lieu AVANT
 * l'analyse, et que le verdict est rendu par `new URL()` plutôt que par
 * une expression régulière écrite à la main.
 *
 * Une adresse sans schéma (« kezak.ch ») reçoit « https:// » : c'est ce
 * qu'on colle naturellement, et le refuser sans un mot serait obscur.
 */
const SCHEMAS_SURS = new Set(['http:', 'https:', 'mailto:']);

export function lienSur(valeur: unknown, max = 600): string {
  const v = nettoyerLigne(valeur, max);
  if (!v) return '';
  // Chemin interne : une seule barre, et rien qui ressemble à un protocole.
  if (v.startsWith('/')) return cheminInterne(v, '');
  const candidat = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(candidat);
    if (!SCHEMAS_SURS.has(u.protocol)) return '';
    // Un hôte vide (« http:///chemin ») ne mène nulle part.
    if (u.protocol !== 'mailto:' && !u.hostname) return '';
    return u.href.slice(0, max);
  } catch {
    return '';
  }
}

/**
 * L'identifiant d'une vidéo YouTube, à partir de ce qu'on a collé.
 *
 * Écrit ici, et non dans une route, parce qu'il y a deux endroits où l'on
 * colle une adresse YouTube — la vidéo d'en-tête d'un projet et une vue de
 * galerie — et qu'ils ne partageaient rien : le second contrôlait l'hôte,
 * le premier se contentait de chercher « v= » n'importe où. Une règle de
 * sécurité écrite deux fois est une règle appliquée une fois et demie.
 */
const MOTIF_YOUTUBE = /(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{6,20})/;

const HOTES_YOUTUBE = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
]);

export function identifiantYoutube(brut: unknown): string {
  const v = nettoyerLigne(brut, 600);
  if (!v) return '';
  if (/^[A-Za-z0-9_-]{6,20}$/.test(v)) return v;
  try {
    const u = new URL(/^[A-Za-z][A-Za-z0-9+.-]*:/.test(v) ? v : `https://${v}`);
    if (!HOTES_YOUTUBE.has(u.hostname.toLowerCase())) return '';
    const m = MOTIF_YOUTUBE.exec(u.href);
    if (m) return m[1];
    // « youtu.be/ID » : l'identifiant est le chemin.
    const chemin = u.pathname.replace(/^\//, '');
    return /^[A-Za-z0-9_-]{6,20}$/.test(chemin) ? chemin : '';
  } catch {
    return '';
  }
}

/**
 * N'autorise qu'une redirection vers une page interne.
 * Sans ce filtre, le champ caché « retour » d'un formulaire permettrait de
 * renvoyer l'administrateur vers un site tiers après une action réussie.
 */
export function cheminInterne(valeur: unknown, defaut = '/admin'): string {
  const v = String(valeur ?? '');
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return defaut;
  if (/[\u0000-\u001F]/.test(v)) return defaut;
  // Un en-tête HTTP ne transporte que du latin-1 : un caractère au-delà
  // fait échouer la construction de la réponse, et l'administrateur reçoit
  // une erreur 500 au lieu d'une redirection. On encode plutôt que de
  // refuser — un chemin peut légitimement contenir des accents.
  return encodeURI(v.slice(0, 300));
}

/**
 * Le fragment de retour : l'identifiant de la section d'où venait le
 * formulaire, pour rouvrir la page à la bonne hauteur.
 *
 * Il est filtré aussi strictement que le chemin. Un fragment est certes
 * moins dangereux qu'une redirection — il ne quitte jamais le site — mais
 * il finit dans un en-tête « Location », et rien n'a à y entrer qui ne
 * soit une suite de lettres, de chiffres et de tirets.
 */
export function ancreSure(valeur: unknown): string {
  const v = String(valeur ?? '');
  if (!v) return '';
  return /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v) ? `#${v}` : '';
}

/**
 * Construit l'adresse de retour : chemin, puis paramètre, puis fragment.
 * L'ordre compte — un fragment placé avant la requête avalerait tout ce
 * qui le suit, et le message de confirmation ne s'afficherait jamais.
 */
export function retourVers(chemin: string, message: string, ancre = ''): string {
  return `${chemin}${chemin.includes('?') ? '&' : '?'}${message}${ancre}`;
}

/** Fabrique un identifiant d'URL propre à partir d'un titre. */
export function slugifier(texte: string): string {
  return nettoyer(texte, 120)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diacritiques combinants
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Les messages d'erreur de l'administration, par code.
 *
 * Rien de ce qui s'affiche dans l'admin ne vient de l'URL : seul un code
 * connu y transite, et c'est cette table qui donne la phrase. Deux raisons.
 *
 * La première est une fuite : le message brut d'une exception SQLite
 * (« UNIQUE constraint failed: projets.slug ») décrivait le schéma dans la
 * barre d'adresse.
 *
 * La seconde est plus sérieuse. Un paramètre repris tel quel permettait
 * d'afficher n'importe quelle phrase dans le vrai bandeau d'erreur, sur le
 * vrai domaine : il suffisait de faire ouvrir
 * « /admin?err=Session+expirée,+reconnectez-vous+sur… ». Le texte était
 * échappé — donc pas de script — mais il servait un hameçonnage très
 * crédible. Un code inconnu affiche désormais un message neutre.
 */
export const MESSAGES: Record<string, string> = {
  rien: "Il n'y avait rien à enregistrer.",
  table: "Cette rubrique n'est pas modifiable.",
  action: 'Action inconnue.',
  introuvable: 'Cette ligne a déjà été supprimée.',
  titre: 'Il faut un titre pour créer un projet.',
  fichier: 'Aucun fichier sélectionné.',
  format: 'Format refusé. Formats acceptés : JPEG, PNG, WebP, AVIF, MP4, WebM.',
  lourd: 'Fichier trop lourd. Limite : 15 Mo pour une image, 60 Mo pour une vidéo.',
  media: "Le fichier n'a pas pu être traité. Essayez un autre format.",
  youtube: "Ce lien YouTube n'est pas reconnu. Collez l'adresse complète de la vidéo.",
  lien: "Cette adresse n'a pas été acceptée : rien n'a été enregistré. Une adresse commence par « https:// », « mailto: » ou une barre oblique pour une page du site.",
  echec: "L'enregistrement a échoué. Le détail est dans le journal du serveur.",
};

export function messageErreur(code: unknown): string {
  const c = String(code ?? '');
  return MESSAGES[c] || "Quelque chose n'a pas fonctionné. Réessayez.";
}

/**
 * Les catégories de projet — une seule liste, pour la création comme pour
 * la fiche. Elles étaient écrites deux fois : on choisissait « Motion & 3D »
 * à la création et on relisait « motion » dans la fiche.
 */
export const CATEGORIES: { valeur: string; libelle: string }[] = [
  { valeur: 'web', libelle: 'Web' },
  { valeur: 'video', libelle: 'Vidéo' },
  { valeur: 'motion', libelle: 'Motion & 3D' },
  { valeur: 'photo', libelle: 'Photo' },
  { valeur: 'son', libelle: 'Son' },
  { valeur: 'autre', libelle: 'Autre' },
];

/** Le plan de l'admin — dans l'ordre exact du site. */
export const MENU = [
  { href: '/admin', libelle: 'Tableau de bord', groupe: '' },
  { href: '/admin/accueil', libelle: "Page d'accueil", groupe: 'Les pages' },
  { href: '/admin/projets', libelle: 'Projets', groupe: 'Les pages' },
  { href: '/admin/studio', libelle: 'Studio', groupe: 'Les pages' },
  { href: '/admin/contact', libelle: 'Contact', groupe: 'Les pages' },
  { href: '/admin/general', libelle: 'Général', groupe: 'Le reste' },
  { href: '/admin/medias', libelle: 'Médias', groupe: 'Le reste' },
  { href: '/admin/messages', libelle: 'Messages', groupe: 'Le reste' },
];
