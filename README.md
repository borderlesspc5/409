# Electric car charger

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/gmrostirolla-7142s-projects/v0-electric-car-charger)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/rpoAQO2EeN8)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://vercel.com/gmrostirolla-7142s-projects/v0-electric-car-charger](https://vercel.com/gmrostirolla-7142s-projects/v0-electric-car-charger)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/rpoAQO2EeN8](https://v0.app/chat/rpoAQO2EeN8)**

## Configuração (Firebase + primeiro admin e cliente)

1. **Firebase:** Crie um projeto no [Firebase Console](https://console.firebase.google.com), ative **Authentication** (método E-mail/senha) e **Firestore**. Copie `.env.example` para `.env.local` e preencha as variáveis `NEXT_PUBLIC_FIREBASE_*` (em Project settings > General > Your apps).

2. **Primeiro admin e primeiro cliente:**
   - Na aplicação, acesse a tela de **Registro** e crie dois usuários, por exemplo:
     - `admin@evcharge.com` (senha de sua escolha) — será o administrador.
     - `cliente@email.com` (senha de sua escolha) — será o cliente.
   - No **Firebase Console** > **Firestore** > coleção `users`, localize o documento do usuário que será admin (o ID do documento é o UID do Auth; você pode conferir em Authentication > Users).
   - Edite esse documento e altere o campo **`role`** de `"user"` para **`"admin"`**.
   - O outro usuário permanece com `role: "user"` (cliente). Faça login com cada um para testar: o admin verá o menu Admin; o cliente verá apenas o app e as reservas.

3. **Estações e carregadores:** Faça login como admin, vá em **Estações** > **Nova estação** para criar uma estação. Depois, selecione a estação na lista e use a aba **Carregadores** para adicionar carregadores. Sem carregadores, as reservas não podem ser concluídas.

4. **Seed opcional (script):** Para criar admin e cliente (e opcionalmente estações e carregadores de exemplo) via linha de comando, use o script em `scripts/seed.js`. Gere uma chave de conta de serviço no Firebase Console (Project settings > Service accounts), salve o JSON e defina `GOOGLE_APPLICATION_CREDENTIALS` com o caminho do arquivo. Depois execute:
   - `node scripts/seed.js` — cria apenas os usuários admin e cliente.
   - `SEED_STATIONS=true node scripts/seed.js` — cria os usuários e também estações e carregadores de exemplo.
   Variáveis opcionais: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CLIENT_EMAIL`, `CLIENT_PASSWORD`, etc. (valores padrão em comentários no script).

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository