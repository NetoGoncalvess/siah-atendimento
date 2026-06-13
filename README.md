# SIAH Atendimento

Sistema próprio de atendimento via WhatsApp (chat + tickets), substituindo o
Dropdesk. Construído com Next.js (App Router) + Prisma + PostgreSQL, pensado
para rodar no Vercel.

## Status do projeto (Fase 1 — estrutura base)

- [x] Projeto Next.js criado (TypeScript + Tailwind v4 + App Router)
- [x] Paleta de cores e tema visual iguais ao dashboard de atendimentos atual
- [x] Modelo de dados (Prisma): `Setor`, `Atendente`, `Contato`, `Ticket`, `Mensagem`
- [x] Estrutura de telas: `/login`, `/inbox` (chat), `/dashboard` (placeholder)
- [x] Rota de webhook do WhatsApp (`/api/webhook/whatsapp`) com verificação
      (GET) e recebimento de mensagens (POST), já criando contato e ticket
      automaticamente
- [ ] Autenticação real dos atendentes (próxima fase)
- [ ] Envio de mensagens pelo painel (próxima fase)
- [ ] Atualização em tempo real do chat (próxima fase)
- [ ] Dashboard de métricas lendo do banco (próxima fase)

## Como rodar localmente

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

- `DATABASE_URL`: crie um banco gratuito no [Neon](https://neon.tech) ou
  [Supabase](https://supabase.com) e cole a connection string.
- `WHATSAPP_*`: preencha quando formos configurar a conta no Meta for
  Developers (fase de integração com o WhatsApp).

### 3. Criar as tabelas no banco

```bash
npx prisma generate
npx prisma db push
```

> Obs: o `prisma generate`/`db push` precisa de acesso à internet para baixar
> os binários do Prisma — funciona normalmente na sua máquina/Vercel, mas não
> roda no ambiente sandbox usado para gerar este projeto.

### 4. Rodar o servidor de desenvolvimento

```bash
npm run dev
```

Acesse http://localhost:3000 — você será redirecionado para `/inbox`.

## Estrutura de pastas

```
src/
  app/
    (app)/
      layout.tsx        Layout com a barra lateral (Sidebar)
      inbox/page.tsx     Tela de chat/atendimento (placeholder visual)
      dashboard/page.tsx Tela de métricas (placeholder)
    api/
      webhook/whatsapp/route.ts  Webhook da WhatsApp Cloud API
    login/page.tsx       Tela de login (placeholder visual)
  components/
    Sidebar.tsx
  lib/
    prisma.ts            Cliente do Prisma (singleton)
    whatsapp.ts          Helpers para enviar/receber mensagens via Cloud API
prisma/
  schema.prisma          Modelo de dados (Setor, Atendente, Contato, Ticket, Mensagem)
```

## Deploy no Vercel

1. Suba este projeto para um repositório no GitHub.
2. No Vercel, crie um novo projeto importando esse repositório.
3. Configure as mesmas variáveis de ambiente do `.env` nas configurações do
   projeto (Settings → Environment Variables).
4. Após o deploy, a URL do webhook do WhatsApp será:
   `https://SEU-PROJETO.vercel.app/api/webhook/whatsapp`

## Próximos passos

1. Configurar a conta no Meta for Developers (WhatsApp Business Cloud API) e
   testar o recebimento de mensagens pelo webhook.
2. Implementar o envio de mensagens pelo painel (`/inbox`) chamando
   `sendWhatsAppText` e salvando no banco.
3. Adicionar atualização em tempo real (Supabase Realtime ou Pusher).
4. Migrar o dashboard de métricas para ler os dados do banco em vez do Excel
   exportado do Dropdesk.
