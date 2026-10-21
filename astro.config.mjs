import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://www.dicooninvest.com.br',
  trailingSlash: 'never',
  // Gera /credito.html e a Vercel serve como /credito (cleanUrls no vercel.json).
  // inlineStylesheets: o CSS vai dentro de cada página. Uma página guardada no
  // navegador (de antes de uma publicação) nunca fica sem estilo por pedir um CSS antigo.
  build: { format: 'file', inlineStylesheets: 'always' },
  integrations: [react(), sitemap({ filter: (pagina) => !pagina.includes('/app') && !pagina.includes('/404') })],
  // VITE_: as chaves públicas do Supabase usadas pelo CRM (o Astro só expõe PUBLIC_ por padrão).
  vite: { plugins: [tailwindcss()], envPrefix: ['PUBLIC_', 'VITE_'] },
})
