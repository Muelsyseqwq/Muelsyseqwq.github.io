import type { APIRoute } from "astro";
import sharp from "sharp";
import config from "@/config";

export const GET: APIRoute = async () => {
  const svg = `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="background" x1="80" y1="40" x2="1120" y2="590" gradientUnits="userSpaceOnUse">
          <stop stop-color="#111827" />
          <stop offset="0.55" stop-color="#312e81" />
          <stop offset="1" stop-color="#1d4ed8" />
        </linearGradient>
        <linearGradient id="mark" x1="80" y1="80" x2="260" y2="260" gradientUnits="userSpaceOnUse">
          <stop stop-color="#a78bfa" />
          <stop offset="1" stop-color="#60a5fa" />
        </linearGradient>
      </defs>
      <rect width="1200" height="630" rx="40" fill="url(#background)" />
      <circle cx="1060" cy="90" r="230" fill="#ffffff" opacity="0.04" />
      <circle cx="1090" cy="600" r="330" fill="#ffffff" opacity="0.035" />
      <rect x="80" y="80" width="180" height="180" rx="42" fill="url(#mark)" />
      <path d="M119 214v-88h20l31 42 31-42h20v88h-24v-50l-27 37-27-37v50h-24Z" fill="#fff" />
      <text x="80" y="386" fill="#fff" font-family="Arial, sans-serif" font-size="92" font-weight="700" letter-spacing="-2">${config.site.title}</text>
      <text x="84" y="458" fill="#dbeafe" font-family="Arial, sans-serif" font-size="30" font-weight="500" letter-spacing="4">NOTES · PROJECTS · PAPER READING</text>
      <rect x="84" y="516" width="190" height="5" rx="2.5" fill="#a78bfa" />
    </svg>
  `;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
