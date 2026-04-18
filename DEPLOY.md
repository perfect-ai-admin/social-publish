# Deploy Checklist — SocialPublish MVP

## Pre-requisites

### 1. Supabase Project
- [ ] Create new project at https://supabase.com/dashboard
- [ ] Note: Project URL, Anon Key, Service Role Key
- [ ] Run all migrations (0001-0007) in SQL Editor
- [ ] Create Storage bucket `media` (public access)
- [ ] Disable email confirmation: Auth > Settings > uncheck "Enable email confirmations"
- [ ] Set Site URL: Auth > URL Configuration > `https://your-domain.com`
- [ ] Add redirect URLs: `https://your-domain.com/callback`, `https://your-domain.com/api/oauth/*`

### 2. Meta Developer App (Facebook + Instagram)
- [ ] Go to https://developers.facebook.com
- [ ] Create App > Business type
- [ ] Add products: Facebook Login, Instagram Basic Display
- [ ] Settings > Basic: note App ID + App Secret
- [ ] Facebook Login > Settings > Valid OAuth Redirect URIs: `https://your-domain.com/api/oauth/meta`
- [ ] Request permissions: `pages_manage_posts`, `pages_read_engagement`, `instagram_content_publish`, `instagram_basic`
- [ ] Submit for App Review (basic permissions are instant)

### 3. Google Cloud Project (YouTube + GBP)
- [ ] Go to https://console.cloud.google.com
- [ ] Create project or use existing
- [ ] Enable APIs: YouTube Data API v3, My Business API
- [ ] Create OAuth 2.0 Client ID (Web application)
- [ ] Authorized redirect URIs: `https://your-domain.com/api/oauth/google`
- [ ] Note Client ID + Client Secret

### 4. Stripe (Billing)
- [ ] Go to https://dashboard.stripe.com
- [ ] Create 3 Products with monthly prices: Starter ($19), Pro ($49), Agency ($99)
- [ ] Note each Price ID (price_xxx)
- [ ] Update billing_plans table with stripe_price_id_monthly values
- [ ] Create webhook endpoint: `https://your-domain.com/api/webhooks/stripe`
- [ ] Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- [ ] Note Webhook Secret (whsec_xxx)

### 5. AI API Key
- [ ] OpenAI: https://platform.openai.com/api-keys → Create key
- [ ] OR Anthropic: https://console.anthropic.com → Create key

## Environment Variables

### Vercel (.env)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://your-domain.com

META_APP_ID=123456789
META_APP_SECRET=abc123...

GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

### Supabase Edge Function Secrets
```bash
supabase secrets set OPENAI_API_KEY=sk-xxx
supabase secrets set META_APP_ID=123456789
supabase secrets set META_APP_SECRET=abc123
supabase secrets set GOOGLE_CLIENT_ID=xxx
supabase secrets set GOOGLE_CLIENT_SECRET=xxx
```

## Deploy Steps

### 1. Database
```bash
# In Supabase SQL Editor, paste and run each migration file:
# supabase/migrations/0001_foundation.sql
# supabase/migrations/0002_channels.sql
# supabase/migrations/0003_posts.sql
# supabase/migrations/0004_publishing_engine.sql
# supabase/migrations/0005_analytics.sql
# supabase/migrations/0006_billing.sql
# supabase/migrations/0007_harden_rls_and_schema.sql
```

### 2. Storage
In Supabase dashboard:
- Storage > New bucket > Name: `media` > Public bucket: ON
- Add policy: Allow authenticated users to upload

### 3. Edge Functions
```bash
cd social-publish
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy publishPost
supabase functions deploy generateCaption
supabase functions deploy adaptContent
supabase functions deploy fetchAnalytics
supabase functions deploy refreshOAuthToken
supabase functions deploy metaOAuthExchange
```

### 4. Cron Jobs (in Supabase SQL Editor)
```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Publish engine: every minute
SELECT cron.schedule('publish_tick', '* * * * *', $$
  SELECT net.http_post(
    url := 'https://YOUR_REF.supabase.co/functions/v1/publishPost',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  )
$$);

-- Analytics: every 6 hours
SELECT cron.schedule('analytics_tick', '0 */6 * * *', $$
  SELECT net.http_post(
    url := 'https://YOUR_REF.supabase.co/functions/v1/fetchAnalytics',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  )
$$);

-- Token refresh: daily 3am
SELECT cron.schedule('token_refresh', '0 3 * * *', $$
  SELECT net.http_post(
    url := 'https://YOUR_REF.supabase.co/functions/v1/refreshOAuthToken',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  )
$$);
```

### 5. Vercel
```bash
cd social-publish
vercel deploy --prod
```

## Post-Deploy Verification

- [ ] Visit https://your-domain.com → redirects to /login
- [ ] Register new account → workspace created → dashboard loads
- [ ] Create brand → appears in list
- [ ] Create product under brand
- [ ] Go to Channels → Connect Facebook → OAuth flow completes
- [ ] Go to Composer → select platform → upload image → write caption → Publish
- [ ] Check Calendar → post appears
- [ ] Check Analytics → metrics loading
- [ ] Check Error Center → no errors
- [ ] Check Billing → plans load from DB

## Smoke Test Script
1. Register with test email
2. Login
3. Create brand "Test Brand"
4. Create product "Test Product"
5. Connect Facebook Page
6. Compose post: select FB → upload image → "Test post from SocialPublish!" → Publish Now
7. Verify post appears on Facebook page
8. Check Dashboard for updated stats
9. Check Error Center for any issues
