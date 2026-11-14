# Deploy Pikajobs backend on Hostinger VPS

Frontend stays on **Vercel**. Backend runs on **Hostinger KVM VPS** at `api.yourdomain.com`.

Replace:

- `YOUR_DOMAIN` → e.g. `pikajobs.com`
- `YOUR_VPS_IP` → public IP from Hostinger VPS panel
- `YOUR_USER` → usually `root` (or the SSH user Hostinger gives you)

---

## 1. Buy / open the VPS

1. Hostinger → **VPS** → KVM 1 (4 GB) is enough.
2. Choose **Ubuntu 22.04 or 24.04**.
3. Save the **IP**, **root password** / SSH key.

---

## 2. Point the API subdomain (DNS)

In Hostinger DNS for `YOUR_DOMAIN`:

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| A | `api` | `YOUR_VPS_IP` | 300 or Auto |

Wait until `api.YOUR_DOMAIN` resolves (can take a few minutes to hours).

Check from your laptop:

```bash
ping api.YOUR_DOMAIN
# or
dig +short api.YOUR_DOMAIN
```

---

## 3. SSH into the server

```bash
ssh root@YOUR_VPS_IP
```

---

## 4. Install Node.js, Nginx, Git, Certbot

```bash
apt update && apt upgrade -y
apt install -y nginx git curl ufw

# Node 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

node -v   # should show v20.x
npm -v

# Process manager
npm install -g pm2

# SSL
apt install -y certbot python3-certbot-nginx
```

Firewall:

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

---

## 5. Clone the repo and install

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/nikhilnagar503/pika__jobs.git
cd pika__jobs

npm install
```

---

## 6. Create backend env

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Set at least:

```env
PORT=4000
APP_URL=https://YOUR_DOMAIN
API_URL=https://api.YOUR_DOMAIN
FRONTEND_ORIGINS=https://YOUR_DOMAIN,https://www.YOUR_DOMAIN

PIKAJOBS_ADMIN_EMAIL=nagarn603@gmail.com
PIKAJOBS_DATA_DIR=/var/www/pika__jobs/backend/.data

SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Create data folder:

```bash
mkdir -p /var/www/pika__jobs/backend/.data
```

---

## 7. Start the API with PM2

```bash
cd /var/www/pika__jobs
pm2 start npm --name pikajobs-api --workspace=@pikajobs/backend -- start
pm2 save
pm2 startup
# run the command PM2 prints so it restarts after reboot

pm2 status
pm2 logs pikajobs-api --lines 50
```

Local check on the server:

```bash
curl http://127.0.0.1:4000/health
```

You should see `{"ok":true,...}`.

---

## 8. Nginx reverse proxy for `api.YOUR_DOMAIN`

```bash
nano /etc/nginx/sites-available/pikajobs-api
```

Paste:

```nginx
server {
    listen 80;
    server_name api.YOUR_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
ln -s /etc/nginx/sites-available/pikajobs-api /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## 9. Free HTTPS (Let's Encrypt)

```bash
certbot --nginx -d api.YOUR_DOMAIN
```

Follow prompts (email, agree to terms). Certbot updates Nginx for HTTPS.

Test:

```bash
curl https://api.YOUR_DOMAIN/health
```

---

## 10. Connect the frontend (Vercel)

In Vercel project → **Settings → Environment Variables** (Production):

```text
VITE_API_URL=https://api.YOUR_DOMAIN
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_ADMIN_EMAIL=nagarn603@gmail.com
VITE_GOOGLE_CLIENT_ID=1234567890-xxxxx.apps.googleusercontent.com
```

Redeploy the frontend after saving env vars (Vite bakes `VITE_*` at build time).

In Supabase → **Authentication → URL configuration**, allow:

- `https://YOUR_DOMAIN`
- `https://www.YOUR_DOMAIN`
- `http://localhost:5173` (local)

---

## 11. Deploy updates later

```bash
ssh root@YOUR_VPS_IP
cd /var/www/pika__jobs
git pull origin main
npm install
pm2 restart pikajobs-api
pm2 logs pikajobs-api --lines 30
```

---

## Quick checklist

- [ ] VPS Ubuntu running, SSH works  
- [ ] DNS `api` A record → VPS IP  
- [ ] `backend/.env` filled (Supabase + CORS origins)  
- [ ] `pm2` shows `pikajobs-api` online  
- [ ] `curl https://api.YOUR_DOMAIN/health` works  
- [ ] Vercel `VITE_API_URL` set and frontend redeployed  

## Common issues

| Problem | Fix |
| --- | --- |
| 502 Bad Gateway | API not running — `pm2 status` / `pm2 logs` |
| CORS errors in browser | Add exact Vercel URL to `FRONTEND_ORIGINS` |
| SSL failed | DNS not pointing yet — wait, then rerun certbot |
| Feed empty / 401 | Missing or wrong Supabase keys / JWT |
