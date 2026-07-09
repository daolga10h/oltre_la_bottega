import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    // Il badge di sviluppo di Next.js di default sta in basso a sinistra,
    // sovrapponendosi al bottone della Calcolatrice (stesso angolo per scelta
    // di design). Spostato in basso a destra, solo in dev — sparisce comunque
    // in produzione.
    position: "bottom-right",
  },
};

export default nextConfig;
