# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Site e CRM da **Dicoon Invest Imóveis** (correspondente bancário, consórcio, seguros e imóveis — Canoas/RS). Todo o código, comentários, textos e commits são em português do Brasil.

## Comandos

```bash
npm run dev       # astro dev (porta 4321 pelo .claude/launch.json: preview "site")
npm run build     # astro build -> dist/
npm run preview   # serve dist/ (porta 4322: preview "site-build")
npm run check     # tsc --noEmit (checagem de tipos)
```

Não há suíte de testes nem linter configurados. A verificação hoje é `npm run check` + `npm run build` + conferir no navegador (preview).

## Publicação

- Vercel ligada ao GitHub: **todo push em `main` vai para o ar** (www.dicooninvest.com.br) em ~30 s. Push = publicação externa.
- `astro.config.mjs` usa `build.format: 'file'` (gera `dist/credito.html`, não `dist/credito/index.html`) e `inlineStylesheets: 'always'` (CSS embutido em cada página, para páginas antigas em cache nunca ficarem sem estilo). `vercel.json` tem `cleanUrls` e reescreve `/app/*` para `/app`.
- O README.md está desatualizado (descreve a versão antiga em Vite com `Site.tsx`); a estrutura real é a descrita aqui.

## Arquitetura

Duas aplicações no mesmo projeto Astro:

### 1. Site público (Astro estático + ilhas React)

- `src/layouts/Base.astro` é a casca de toda página do site: cabeçalho, rodapé, botão flutuante do WhatsApp, dados estruturados (JSON-LD `Organization`) e `Rastreamento.astro`.
- Páginas de serviço são **geradas a partir de dados**: `src/data/servicos.ts` (lista `servicos`, com textos, passos, perguntas, público `voce`/`empresa`) alimenta `layouts/PaginaServico.astro`; `pages/credito/[slug].astro` gera as páginas de crédito via `getStaticPaths`. Páginas-índice (`/credito`, `/para-voce`, `/empresas`) usam `layouts/PaginaHub.astro`; institucionais usam `PaginaTexto.astro`.
- `PaginaServico.astro` decide qual simulador mostrar pelo `slug` (financiamento imobiliário/veicular → `SimuladorFinanciamento`, home-equity → `SimuladorHomeEquity`, consorcios → `SimuladorConsorcio`). Simuladores e formulários são ilhas React (`client:visible`) que **não gravam nada**: montam uma mensagem e abrem o WhatsApp (`linkWhatsApp` em `src/config.ts`).
- `src/config.ts` é a fonte única de contato (telefone/WhatsApp, e-mail, endereço, CNPJ), redes sociais e ID do Google Tag Manager.
- Parceiros e logos: `src/data/parceiros.ts` (`parceiros` com tipo banco/seguradora; `consorcios` com administradoras) alimenta o carrossel da home (`components/site/InstituicoesParceiras.astro`, carrossel próprio sem biblioteca) e as grades de `/parceiros`. Logos em `public/img/parceiros/*.webp`.

### 2. CRM / Área do Cliente (`/app`, SPA React)

- `pages/app.astro` monta `src/crm/CrmApp.tsx` com `client:only="react"` (sem renderização no servidor), usando React Router e TanStack Query.
- Autenticação e dados vêm do **Supabase** (`src/lib/supabase.ts`, chave anon pública via `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — por isso `envPrefix` inclui `VITE_`). Sem essas variáveis o CRM mostra a tela de manutenção.
- Papéis (`src/crm/tipos.ts`): `admin`, `corretor`, `atendente`, `cliente`. `CrmApp` encaminha: sem sessão → `Entrada`; não aprovado/inativo → `Aguardando`; `cliente` → `PortalCliente`; demais → painel com Clientes, Negociações e Equipe (só admin).
- **A segurança dos dados é feita pelas regras RLS do banco**, não pelo front-end. Os scripts SQL em `supabase/` são rodados à mão no SQL Editor do Supabase, na ordem `03-papel-cliente.sql` → `04-acessos-por-papel.sql` (o `01-seguranca.sql` foi substituído; o `02` apaga dados de teste e é irreversível).

## Estilos

- Tailwind 4 configurado por CSS (`@theme`), sem `tailwind.config`. O site usa `src/styles/site.css` (navy `#10243a`, dourado `#c8a45d`, fontes Manrope/Inter, utilitários `container-site` e `cartao-ouro`); o CRM usa `src/styles/crm.css`, com outros tokens (`ink`, `coal`, `gold-deep`…). Não misturar as classes de um no outro.

## Medição e privacidade

- `components/site/Rastreamento.astro`: aviso de cookies (LGPD); **nada de GTM/Analytics/Pixel carrega antes do "Aceitar"** (escolha guardada em `localStorage` `dicoon-consentimento`).
- Os componentes só emitem eventos com `registrarEvento` / `useEventoSimulacao` (`src/lib/eventos.ts`), que chegam ao `dataLayer`; o mapeamento para GA4 e Pixel da Meta fica no contêiner do GTM, versionado em `gtm/container-dicoon-invest.json`. Nunca enviar dados pessoais nem valores digitados nos eventos.
- Testar formulários em produção com o consentimento aceito gera leads falsos no GA/Meta: marcar `dicoon-consentimento` como `recusado` no navegador de teste e interceptar `window.open`.

## Regras de conteúdo do negócio

- Não prometer aprovação, "menores taxas" ou valores: aprovação é da instituição; simulações são ilustrativas. Consórcio: "sem juros, com taxa de administração".
- Mudanças visuais são aprovadas pelo Ricardo por imagem antes de publicar; capturas de prévia ficam em `.previa/` e `previas/` (ignorados pelo git).
