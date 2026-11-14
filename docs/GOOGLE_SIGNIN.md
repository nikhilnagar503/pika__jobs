# Google sign-in without showing supabase.co

Do **not** replace Supabase Auth. Existing accounts, sessions, and admin login stay on Supabase.

Google was showing `rwjmkuzthumntgqoaywd.supabase.co` because the old flow sent users through Supabase’s OAuth callback. The app now uses **Google Identity Services on pikajobs.com**, then hands the ID token to Supabase in the background. Google shows **pikajobs.com**. This is free.

## 1. Copy the existing Web client ID

Google Cloud Console → APIs & Services → Credentials → the **Web application** OAuth client already used for Pikajobs.

Or Supabase Dashboard → Authentication → Providers → Google → **Client IDs**.

It looks like `1234567890-xxxxx.apps.googleusercontent.com`.

## 2. Allow Pikajobs as a JavaScript origin

Same Google client → **Authorized JavaScript origins**. Add:

```
https://pikajobs.com
https://www.pikajobs.com
http://localhost:5173
```

Keep the existing Authorized redirect URI (`https://rwjmkuzthumntgqoaywd.supabase.co/auth/v1/callback`) for email confirmation and as a fallback.

## 3. Put the client ID in Vercel

Vercel project → Settings → Environment Variables:

```
VITE_GOOGLE_CLIENT_ID=<the web client id>
```

Redeploy the frontend. Vite bakes this in at build time.

Locally, add the same line to `frontend/.env`.

Until this variable is set, the old Google redirect (with supabase.co) is still used so sign-in does not break.

## 4. Optional branding

Google Auth Platform → Branding → app name **Pikajobs**. That only changes the name/logo, not the domain. The new button flow is what hides supabase.co.

## Paid custom domain (not required)

A Supabase custom domain (`auth.pikajobs.com`) also hides supabase.co, but it needs Pro (~$25/mo) plus a $10/mo add-on. Skip that unless you want every Auth URL branded too.
