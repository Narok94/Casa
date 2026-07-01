# Nosso Lar - Organizador de Tarefas Domésticas

Um organizador de tarefas simples, elegante e prático, pensado para casais. Construído com Vite, React, Express, Tailwind CSS e Neon (PostgreSQL).

## Passo a Passo para Deploy na Vercel

O aplicativo está estruturado com um frontend em React e um backend em Express que expõe rotas `/api`. Para rodar este projeto localmente ou em produção, você precisará configurar o banco de dados e as variáveis de ambiente.

### 1. Criar o Banco de Dados na Neon

1. Acesse [Neon](https://neon.tech/) e crie uma conta (é gratuito).
2. Crie um novo projeto/banco de dados (ex: `nosso-lar-db`).
3. Copie a String de Conexão (`DATABASE_URL`). O formato será parecido com:
   `postgresql://usuario:senha@ep-seu-endpoint.neon.tech/neondb?sslmode=require`

### 2. Configurar o Projeto

Você precisa das variáveis de ambiente para rodar o app.

Crie um arquivo `.env` na raiz do projeto e adicione:

```env
DATABASE_URL="sua_string_de_conexao_copiada_da_neon"
JWT_SECRET="uma-chave-secreta-para-os-cookies-de-login"
```

> **Nota:** O script `setupDatabase` no arquivo `src/db.ts` rodará automaticamente na primeira inicialização do servidor (se a `DATABASE_URL` estiver configurada) para criar as tabelas `users` e `tasks` e popular o banco com os usuários "Henrique" (PIN 4902) e "Jessica" (PIN 9860).

### 3. Executando Localmente

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

3. Acesse `http://localhost:3000`.

### 4. Publicando na Vercel

Por ser uma aplicação Vite com Express (Full-Stack), na Vercel você pode facilmente configurá-lo como um projeto Next.js (adaptando as rotas de API para a pasta `pages/api` ou `app/api`) OU manter essa mesma arquitetura deployando como um projeto Node.js via arquivo `api/index.js` (Serverless Functions) ou com `vercel.json`.

Como importar do Github:
1. No AI Studio, use o botão de menu e selecione **Push to GitHub** para exportar o projeto para seu repositório.
2. Na sua conta da [Vercel](https://vercel.com/new), crie um novo projeto importando o repositório que você acabou de criar.
3. Nas configurações do projeto na Vercel (em _Environment Variables_), adicione o `DATABASE_URL` e o `JWT_SECRET`.
4. Faça o Deploy.

_(Se estiver apenas testando, Vercel rodará perfeitamente o comando de build `npm run build` e servirá seu frontend estático a partir da pasta `dist` - se você configurar o Node server como Vercel serverless function, crie um `api/index.js` que importe seu app Express)._

## PINs de Acesso Padrão:
* **Henrique:** `4902`
* **Jessica:** `9860`

_(Eles não possuem "esqueci minha senha" por ser focado num uso intimo e restrito a duas pessoas)._

---

Desenvolvido para ajudar na rotina diária com um design acolhedor e focado na usabilidade móvel.
