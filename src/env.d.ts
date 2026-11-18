/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    utilisateur: { id: number; email: string } | null;
    csrf: string;
    /** Posé par le middleware sur /api/app/* une fois la signature vérifiée. */
    appVerifiee?: boolean;
    /** Le corps de la requête signée, déjà lu et borné par le middleware. */
    corpsApp?: string;
  }
}
