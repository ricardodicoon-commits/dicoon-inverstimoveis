import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://www.dicooninvest.com.br',
  trailingSlash: 'never',
  // Gera /credito.html e a Vercel serve como /credito (cleanUrls no vercel.json).
  build: { format: 'file' },
  integrations: [react(), sitemap({ filter: (pagina) => !pagina.includes('/app') && !pagina.includes('/404') })],
  vite: { plugins: [tailwindcss()] },
})
