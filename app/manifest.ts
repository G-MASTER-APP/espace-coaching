import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "G-MASTER — Espace Coaching",
    short_name: "G-MASTER",
    description:
      "Suivi coaching G-MASTER : planning, programme, diète, bilans et accompagnement.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f1ea",
    theme_color: "#2b2415",
    orientation: "portrait",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
