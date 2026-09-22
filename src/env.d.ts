/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    utilisateur: { id: number; email: string } | null;
    csrf: string;
  }
}
