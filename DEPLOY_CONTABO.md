# Deploying Happy Skin Salon on Contabo

This deployment runs the React frontend, FastAPI backend, and PostgreSQL in Docker Compose. PostgreSQL and the API are private to the Docker network; only the web service is published. Database files and uploaded files use persistent Docker volumes.

The VPS IP is `5.104.86.204`. The recommended public setup below uses a short-lived Let's Encrypt certificate for the IP address, so automated renewal must remain enabled. IP certificates are valid for about six days and require Certbot 5.4 or newer.

## 1. Package the project on Windows

From Windows PowerShell:

```powershell
Set-Location 'C:\xampp\htdocs\Happy_Skin_Salon_Management'
tar.exe -czf "$env:USERPROFILE\Desktop\happy-skin-deploy.tar.gz" --exclude=./.git --exclude=./frontend/node_modules --exclude=./frontend/dist --exclude=./frontend/ios --exclude=./frontend/android --exclude=./backend/.venv --exclude=./backend/__pycache__ --exclude=./backend/.pytest_cache --exclude=./backend/uploads '--exclude=./.env*' '--exclude=./backend/.env*' '--exclude=./frontend/.env*' -C . .
scp "$env:USERPROFILE\Desktop\happy-skin-deploy.tar.gz" root@5.104.86.204:/root/
```

The archive excludes local dependency folders, environment files, local uploads, and mobile platform build folders. Local database contents are not included; transfer existing salon data separately before using the hosted app if you need to preserve it.

## 2. Install Docker on the VPS

In the SSH session, use Docker's official Ubuntu instructions to add its package repository and install Docker Engine with the Compose plugin: <https://docs.docker.com/engine/install/ubuntu/>. Do not install Docker from an unverified script.

Before enabling a firewall, allow SSH (port 22). Allow HTTP (80) and HTTPS (443) in both the VPS firewall in Contabo and the Ubuntu firewall. Keep PostgreSQL port 5432 closed to the public internet.

## 3. Unpack the app and create production secrets

```bash
mkdir -p /opt/happy-skin
tar -xzf /root/happy-skin-deploy.tar.gz -C /opt/happy-skin
cd /opt/happy-skin
mkdir -p certbot/www
DB_PASSWORD=$(openssl rand -hex 32)
APP_SECRET=$(openssl rand -hex 32)
cat > .env.production <<EOF
POSTGRES_DB=happy_skin
POSTGRES_USER=salonapp
POSTGRES_PASSWORD=${DB_PASSWORD}
SECRET_KEY=${APP_SECRET}
ENVIRONMENT=production
CORS_ORIGINS=https://5.104.86.204
EOF
unset DB_PASSWORD APP_SECRET
chmod 600 .env.production
```

Do not send `.env.production` or its values in chat. Its database password uses hexadecimal characters so it is safe in the database URL assembled by Compose.

## 4. Start the app on HTTP for certificate validation

```bash
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
```

The first backend start applies Alembic migrations. Confirm the site loads at `http://5.104.86.204` before continuing.

## 5. Issue an HTTPS certificate for the IP

Install Certbot 5.4 or newer using the official Snap instructions. On Ubuntu 24.04:

```bash
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/local/bin/certbot
certbot --version
```

Then request the short-lived IP certificate, replacing the email address with yours:

```bash
sudo certbot certonly --webroot --webroot-path /opt/happy-skin/certbot/www --ip-address 5.104.86.204 --preferred-profile shortlived --email YOUR_EMAIL --agree-tos --non-interactive
```

Once the certificate exists, switch Nginx to the HTTPS configuration and rebuild the web container:

```bash
cp /opt/happy-skin/frontend/nginx-https.conf /opt/happy-skin/frontend/nginx.conf
cd /opt/happy-skin
docker compose --env-file .env.production up -d --build web
```

Create a deploy hook so Nginx reloads the renewed certificate:

```bash
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-happy-skin.sh >/dev/null <<'EOF'
#!/bin/sh
/usr/bin/docker compose --project-directory /opt/happy-skin --env-file /opt/happy-skin/.env.production exec -T web nginx -s reload
EOF
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-happy-skin.sh
sudo certbot renew --dry-run
systemctl list-timers
```

Confirm Certbot's automatic renewal timer appears in `systemctl list-timers`. The certificate expires in about six days; the automatic timer and reload hook are required to keep HTTPS working. See [Let's Encrypt's IP certificate and Certbot instructions](https://letsencrypt.org/2026/03/11/shorter-certs-certbot) and [Certbot's install guidance](https://certbot.eff.org/instructions?os=snap&ws=nginx).

## Notes

- The IP address is in Japan, matching the VPS region shown in Contabo.
- The app starts with a fresh database. This guide does not import any Windows-hosted PostgreSQL data or local uploads.
- A domain remains useful for a simpler certificate renewal setup and OAuth configuration. Update `CORS_ORIGINS` and the Nginx server name when you add one.
