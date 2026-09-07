import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "冷蔵庫の中身",
    short_name: "冷蔵庫",
    description: "レシートを撮るだけの冷蔵庫管理アプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#edf1e6",
    theme_color: "#22271d",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}