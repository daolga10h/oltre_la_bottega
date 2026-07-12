import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Oltre la Bottega",
    short_name: "Oltre la Bottega",
    description: "Dashboard operativa per la tua bottega",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f8f7f5",
    theme_color: "#3b2716",
    icons: [
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
    ],
  }
}
