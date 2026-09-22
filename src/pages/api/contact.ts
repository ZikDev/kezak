import type { APIRoute } from 'astro';
import { db, tousReglages } from '../../lib/db';
import { tropDeTentatives, noterTentative } from '../../lib/auth';
/**
 * Les mêmes fonctions de nettoyage que l'administration, et non une copie.
 *
 * `nettoyer` laisse passer le retour chariot et le saut de ligne — ce qui
 * est voulu dans le corps d'un message, et dangereux ailleurs : ce sont
 * eux qui permettent d'ajouter un en-tête à un courriel. Un nom valant
 * « Victor⏎Bcc: quelquun@ailleurs.tld » aurait tenté d'envoyer une copie
 * cachée depuis notre domaine. Nodemailer replie normalement les
 * en-têtes, mais une protection qui dépend du comportement interne d'une
 * dépendance n'en est pas une — d'où `nettoyerLigne` sur tout ce qui
 * finit dans un en-tête : le nom, l'organisation, l'adresse.
 *
 * Il y avait ici une copie locale de `nettoyer`, et elle divergeait déjà :
 * elle ne normalisait pas les fins de ligne Windows.
 */
import { nettoyer, nettoyerLigne } from '../../lib/admin';

export const prerender = false;

const emailPlausible = (v: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v);

export const POST: APIRoute = async ({ request, clientAddress, redirect }) => {
  const f = await request.formData();

  const ip = clientAddress || 'inconnue';
  if (tropDeTentatives(`contact:${ip}`, 5, 3600)) {
    return redirect('/contact?erreur=trop', 303);
  }
  noterTentative(`contact:${ip}`);

  // Pot de miel : un robot remplit tous les champs, un humain ne voit pas celui-ci.
  if (nettoyer(f.get('site'), 10)) return redirect('/contact?envoye=1', 303);

  // Un formulaire honnête n'est jamais soumis en moins de trois secondes.
  const depart = Number(f.get('depart') || 0);
  if (depart && Date.now() - depart < 3000) {
    return redirect('/contact?envoye=1', 303);
  }

  const nom = nettoyerLigne(f.get('nom'), 120);
  const email = nettoyerLigne(f.get('email'), 160);
  const corps = nettoyer(f.get('corps'), 4000);

  if (!nom || !email || !corps || !f.get('accord')) {
    return redirect('/contact?erreur=champs', 303);
  }
  if (!emailPlausible(email)) return redirect('/contact?erreur=email', 303);

  const donnees = {
    nom,
    email,
    orga: nettoyerLigne(f.get('orga'), 120),
    tel: nettoyer(f.get('tel'), 40),
    // Le nombre de cases cochées est borné, pas seulement leur longueur :
    // un formulaire forgé pouvait en envoyer cent mille et faire grossir
    // la base à volonté.
    besoins: f
      .getAll('besoins')
      .slice(0, 10)
      .map((b) => nettoyer(b, 60))
      .filter(Boolean)
      .join(', '),
    echeance: nettoyer(f.get('echeance'), 60),
    budget: nettoyer(f.get('budget'), 80),
    corps,
  };

  // La base d'abord : même si l'envoi du courriel échoue, rien n'est perdu.
  db.prepare(
    `INSERT INTO messages (nom, orga, email, tel, besoins, echeance, budget, corps)
     VALUES (@nom, @orga, @email, @tel, @besoins, @echeance, @budget, @corps)`
  ).run(donnees);

  try {
    const r = tousReglages();
    if (process.env.SMTP_HOST && process.env.SMTP_PASS) {
      // « default ?? module » plutôt que la seule déstructuration : selon la
      // façon dont la version installée est publiée — CommonJS ou ESM pur —
      // l'export par défaut existe ou non. Les deux formes fonctionnent.
      const mod: any = await import('nodemailer');
      const nodemailer = mod.default ?? mod;
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transport.sendMail({
        from: process.env.MAIL_FROM || 'Site Kezak <contact@kezak.ch>',
        to: process.env.MAIL_TO || r.email || 'contact@kezak.ch',
        // Objet plutôt que chaîne : nodemailer se charge alors d'échapper le
        // nom d'affichage. Assemblée à la main, la chaîne
        // « Kezak <compta@ailleurs.tld>, Victor <lui@exemple.ch> » aurait
        // donné deux destinataires de réponse — et la réponse de Victor
        // serait partie chez les deux.
        replyTo: { name: donnees.nom, address: donnees.email },
        subject: `Site Kezak — ${donnees.nom}${donnees.orga ? ` (${donnees.orga})` : ''}`,
        text: [
          `Nom        : ${donnees.nom}`,
          `Organisation: ${donnees.orga || '—'}`,
          `E-mail     : ${donnees.email}`,
          `Téléphone  : ${donnees.tel || '—'}`,
          `Besoins    : ${donnees.besoins || '—'}`,
          `Échéance   : ${donnees.echeance || '—'}`,
          `Budget     : ${donnees.budget || '—'}`,
          '',
          donnees.corps,
        ].join('\n'),
      });
    }
  } catch (e) {
    // L'internaute n'a pas à connaître nos ennuis de SMTP : le message est
    // en base et visible dans l'admin.
    console.error('[contact] envoi du courriel impossible :', e);
  }

  return redirect('/contact?envoye=1', 303);
};
