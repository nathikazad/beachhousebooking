This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Custom GPT OAuth

The read-only GPT Action supports per-user OAuth without changing the website's
existing Supabase access paths. Configure these server-side Vercel variables:

```text
GPT_AUTHORIZED_USER_IDS=<comma-separated Supabase auth user UUIDs>
GPT_ACTION_OAUTH_CLIENT_ID=<OAuth client ID configured in the GPT>
GPT_ACTION_OAUTH_CLIENT_SECRET=<random OAuth client secret>
GPT_ACTION_OAUTH_SIGNING_SECRET=<separate random token-signing secret>
GPT_ACTION_OAUTH_REDIRECT_URIS=<exact callback URL shown by the GPT editor>
```

Configure the GPT Action with:

```text
Authorization URL: https://<deployment>/oauth/authorize
Token URL: https://<deployment>/api/gpt/oauth/token
Scope: gpt.read
Token exchange method: POST
```

`GPT_ACTION_API_KEY` remains an optional migration fallback. Remove it from
Vercel after the OAuth connection is verified so all GPT data requests require
an approved user token.
