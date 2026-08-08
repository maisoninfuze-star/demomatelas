/* ============================================================
   LITERIE D'AMITIÉ — zone de livraison
   Territoire desservi : Montréal et les environs, jusqu'à
   Saint-Jérôme (nord) et Joliette (nord-est). Au-delà, le prix
   de livraison est établi au téléphone.

   Ce fichier est lu par le navigateur ET relu par api/checkout.js
   (même source, pas de dérive possible entre les deux).

   Règles de lecture : on compare TOUJOURS le préfixe le plus long
   d'abord (3 caractères), puis 2, puis 1. Tout ce qui n'est pas
   reconnu tombe hors zone — jamais l'inverse.
   ============================================================ */
window.LDA_ZONES = {
  // Frais fixe, en dollars, pour tout le territoire desservi.
  fee: 50,

  // Préfixes desservis. « H1 »…« H9 » couvrent l'île et Laval (H7).
  // Attention : « H » seul engloberait H0M (Akwesasne, ~110 km).
  // De même, « J6 » attraperait Valleyfield et « J7 » Les Coteaux.
  in: [
    "H1", "H2", "H3", "H4", "H5", "H7", "H8", "H9",
    "J4",
    "J0L", "J0N", "J0P",
    "J2W", "J2X", "J2Y",
    "J3A", "J3B", "J3E", "J3G", "J3H", "J3L", "J3M", "J3N", "J3V", "J3X", "J3Y", "J3Z",
    "J5A", "J5B", "J5C", "J5J", "J5K", "J5L", "J5M", "J5N", "J5R", "J5T", "J5W", "J5X", "J5Y", "J5Z",
    "J6A", "J6E", "J6J", "J6K", "J6N", "J6R", "J6V", "J6W", "J6X", "J6Y", "J6Z",
    "J7A", "J7B", "J7C", "J7E", "J7G", "J7H", "J7J", "J7K", "J7L", "J7M", "J7N",
    "J7P", "J7R", "J7T", "J7V", "J7W", "J7Y", "J7Z",
  ],

  // Quelques repères, pour les messages à l'écran.
  landmarks: {
    J7Y: "Saint-Jérôme", J7Z: "Saint-Jérôme", J5L: "Saint-Jérôme",
    J6E: "Joliette", H7: "Laval", J4: "Longueuil et la Rive-Sud",
  },

  /** Normalise « h1p2b3 » ou « H1P 2B3 » en « H1P 2B3 ». Retourne "" si invalide. */
  normalize(raw) {
    const c = String(raw || "").normalize("NFKD").replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 6);
    if (!/^[ABCEGHJKLMNPRSTVXY][0-9][ABCEGHJKLMNPRSTVWXYZ][0-9][ABCEGHJKLMNPRSTVWXYZ][0-9]$/.test(c)) return "";
    return c.slice(0, 3) + " " + c.slice(3);
  },

  /** true si le code postal est dans le territoire desservi. */
  covers(postal) {
    const c = this.normalize(postal);
    if (!c) return false;
    const fsa = c.slice(0, 3);
    return this.in.includes(fsa) || this.in.includes(fsa.slice(0, 2)) || this.in.includes(fsa.slice(0, 1));
  },
};
