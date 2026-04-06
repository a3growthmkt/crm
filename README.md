# A3 FLOW CRM (Imobiliária)

## Rodar local (Vite + TypeScript)
1. Requisitos: Node 18+.
2. Instale dependências: `npm install`
3. Crie um `.env` a partir de `.env.example` e preencha `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_BUCKET`.
4. Dev server: `npm run dev` (abre em `http://localhost:3000`).
5. Build: `npm run build` e `npm run preview` para testar o build.

## Estrutura
- `index.html` / `index.css`: layout e estilos.
- `src/app.ts`: lógica principal (Kanban, modais, Supabase, uploads).
- `src/main.ts`: entry Vite.
- `src/config.ts`: lê variáveis de ambiente (Supabase).
- `server.js`: servidor estático legado (opcional; com Vite use `npm run dev`).
- `auto_demo.*`: script/página de automação demo.
- `webhook.php`: receptor de webhooks (Evolution API) opcional.

## Supabase (tabela sugerida)
```sql
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table if not exists public.imoveis (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  address text not null,
  price text not null,
  area numeric,
  rooms int,
  bathrooms int,
  parking int,
  owner text,
  owner_phone text,
  description text,
  col int not null default 0,
  color text,
  photos text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_imoveis_col on public.imoveis(col);
create index if not exists idx_imoveis_created_at on public.imoveis(created_at desc);
```

## Notas
- Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_STORAGE_BUCKET` em `config.js` (ou injete via env). Não use `service_role` no front.
- Fotos: bucket público recomendado; salve apenas URLs na coluna `photos`.
- `.gitignore` já ignora `.env`, `node_modules` e arquivos temporários.
