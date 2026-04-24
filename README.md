# GigMatch PHP

GigMatch is a live music booking platform — **PHP 8.1+ / MySQL** port of the original Node.js/TypeScript version.

## Tech Stack
- **Backend**: Pure PHP 8.1 (no framework) + PDO MySQL
- **Auth**: JWT (pure PHP, no external lib)
- **Frontend**: Vanilla JS + Tailwind CSS (same as original)
- **Database**: MySQL 8.0+

## Requirements
- PHP 8.1+
- MySQL 8.0+
- Apache with `mod_rewrite` (or Nginx — see config below)

---

## ⚡ Quick Start

### 1. Clone & configure
```bash
git clone https://github.com/ascfreitas1/GIGMATCH-PHP.git
cd GIGMATCH-PHP
cp .env.example .env
nano .env   # Set DB_* and JWT_SECRET
```

### 2. Create the database
```bash
mysql -u root -p -e "CREATE DATABASE gigmatch CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p gigmatch < database/schema.sql
mysql -u root -p gigmatch < database/seed.sql   # Creates demo accounts
```

### 3. Set up the web server

**Apache** — enable `mod_rewrite`, point DocumentRoot to project root. `.htaccess` handles routing.

**Nginx** — add this location block:
```nginx
location / {
    try_files $uri $uri/ /index.php?$query_string;
}
location ~ \.php$ {
    fastcgi_pass unix:/run/php/php8.1-fpm.sock;
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
}
```

### 4. Set environment variables
Either edit `core/config.php` directly, or export them in your server config:
```bash
export DB_HOST=localhost DB_NAME=gigmatch DB_USER=root DB_PASS=secret JWT_SECRET=your-secret
```

---

## 📁 Project Structure
```
gigmatch-php/
├── index.php              ← Front controller (all requests)
├── .htaccess              ← Apache rewrite rules
├── .env.example           ← Environment template
├── core/
│   ├── config.php         ← All constants / env vars
│   ├── Database.php       ← PDO singleton + helpers
│   └── helpers.php        ← JWT, auth, uuid, pagination, geo, CORS
├── api/
│   ├── auth/index.php     ← POST /api/auth/{register,login,google,facebook}
│   ├── performers/        ← GET/PUT /api/performers/*
│   ├── events/            ← GET/POST/PUT/DELETE /api/events/*
│   ├── bookings/          ← GET/POST /api/bookings/*
│   ├── messages/          ← GET/POST /api/messages/*
│   ├── notifications/     ← GET/PUT /api/notifications/*
│   └── admin/             ← GET/PUT /api/admin/*
├── database/
│   ├── schema.sql         ← MySQL table definitions
│   └── seed.sql           ← Demo users (admin, performer, host)
└── public/
    ├── index.html         ← Frontend SPA
    └── static/
        └── app.js         ← Frontend JavaScript
```

---

## 🔑 Default Accounts
| Role | Email | Password |
|---|---|---|
| Admin | admin@gigmatch.com | Admin@123! |
| Performer | performer@demo.com | Demo@1234 |
| Host | host@demo.com | Demo@1234 |

---

## 🛠️ API Endpoints
| Method | Endpoint | Auth |
|---|---|---|
| POST | /api/auth/register | — |
| POST | /api/auth/login | — |
| POST | /api/auth/google | — |
| POST | /api/auth/facebook | — |
| GET | /api/performers | — |
| GET | /api/performers/{id} | — |
| PUT | /api/performers/profile | performer |
| GET | /api/events | — |
| POST | /api/events/create | host |
| GET | /api/bookings/my | auth |
| POST | /api/bookings/request | performer |
| PUT | /api/bookings/{id}/status | host |
| POST | /api/bookings/{id}/pay | auth |
| POST | /api/bookings/{id}/complete | auth |
| POST | /api/bookings/{id}/rate | auth |
| GET | /api/messages/conversations | auth |
| POST | /api/messages/send | auth |
| GET | /api/notifications | auth |
| GET | /api/admin/stats | admin |

---

## 🚀 Deploy to VPS
```bash
# Install PHP + MySQL + Apache
apt install php8.1 php8.1-mysql mysql-server apache2 -y
a2enmod rewrite

# Deploy
git clone https://github.com/ascfreitas1/GIGMATCH-PHP.git /var/www/gigmatch
cd /var/www/gigmatch && cp .env.example .env && nano .env

# Import DB
mysql -u root -p gigmatch < database/schema.sql
mysql -u root -p gigmatch < database/seed.sql

# Set permissions
chown -R www-data:www-data /var/www/gigmatch
```
