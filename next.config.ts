import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    // Il badge di sviluppo di Next.js di default sta in basso a sinistra,
    // sovrapponendosi al bottone della Calcolatrice (stesso angolo per scelta
    // di design). Spostato in basso a destra, solo in dev — sparisce comunque
    // in produzione.
    position: "bottom-right",
  },
  experimental: {
    // Il caricamento di un documento del fornitore (PDF o foto ridotta) passa da una
    // server action: il limite predefinito di 1 MB è troppo basso. 4 MB resta sotto
    // il tetto di 4,5 MB delle richieste Vercel.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
