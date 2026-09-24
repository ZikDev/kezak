/**
 * Les textes par défaut — ceux qui s'affichent tant que personne n'a écrit
 * les siens.
 *
 * Ils sont ici, et nulle part ailleurs, parce qu'ils servent à trois
 * endroits qui n'ont rien à voir entre eux : le script qui remplit une base
 * neuve, la migration qui remplace l'ancienne formulation, et la page qui
 * affiche le texte quand le réglage est vide. Recopié trois fois, un texte
 * finit par différer de lui-même.
 *
 * Fichier en « .mjs » sans dépendance : il est chargé aussi bien par le
 * site que par un script Node lancé à la main.
 */

/** La mention affichée en marge des crédits d'un projet. */
export const NOTE_CREDITS =
  "Qui a fait quoi, tel que cela figure au générique, au colophon ou dans les mentions du projet. Les rôles que je n'ai pas tenus sont nommés aussi : c'est ce qui rend le mien crédible.";

/**
 * Sa formulation d'avant la version 6.2, gardée pour une seule raison :
 * reconnaître un texte que personne n'a retouché, et ne remplacer que
 * celui-là. Ne pas réutiliser ailleurs.
 */
export const ANCIENNE_NOTE_GENERIQUE =
  "Extrait du générique du film, tel qu'il y figure. Les postes que je n'ai pas tenus sont nommés aussi : c'est ce qui rend le mien crédible.";
