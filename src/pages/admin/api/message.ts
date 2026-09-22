import type { APIRoute } from 'astro';
import { cheminInterne, ancreSure, retourVers } from '../../../lib/admin';
import { db } from '../../../lib/db';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.utilisateur) return new Response('Non authentifié', { status: 401 });

  const f = await request.formData();
  const retour = cheminInterne(f.get('retour'), '/admin/messages');
  const id = Number(f.get('id') ?? 0);
  const action = String(f.get('action') ?? '');

  if (id) {
    if (action === 'lu') db.prepare('UPDATE messages SET lu = 1 WHERE id = ?').run(id);
    else if (action === 'non-lu') db.prepare('UPDATE messages SET lu = 0 WHERE id = ?').run(id);
    else if (action === 'supprimer') db.prepare('DELETE FROM messages WHERE id = ?').run(id);
  }

  return redirect(retourVers(retour, 'ok=1', ancreSure(f.get('ancre'))), 303);
};
