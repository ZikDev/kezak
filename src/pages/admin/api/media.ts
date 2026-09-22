import type { APIRoute } from 'astro';
import { cheminInterne, ancreSure, retourVers } from '../../../lib/admin';
import { db } from '../../../lib/db';
import { supprimerFichiers } from '../../../lib/media';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.utilisateur) return new Response('Non authentifié', { status: 401 });

  const f = await request.formData();
  const retour = cheminInterne(f.get('retour'), '/admin/medias');
  const id = Number(f.get('id') ?? 0);

  if (String(f.get('action')) === 'supprimer' && id) {
    const m = db.prepare('SELECT * FROM medias WHERE id = ?').get(id) as any;
    if (m) {
      // Les clés étrangères sont en ON DELETE SET NULL : les pages qui
      // utilisaient ce média l'oublient proprement, rien ne casse.
      db.prepare('DELETE FROM medias WHERE id = ?').run(id);
      let fichiers: string[] = [m.fichier];
      try {
        fichiers = fichiers.concat(Object.values(JSON.parse(m.variantes || '{}')) as string[]);
      } catch {
        /* pas de variantes */
      }
      supprimerFichiers([...new Set(fichiers)]);
    }
  }

  return redirect(retourVers(retour, 'ok=1', ancreSure(f.get('ancre'))), 303);
};
