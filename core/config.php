<?php
// ─── GigMatch PHP — Configuration ───────────────────────────────────────────
// Copy this file or set real values via environment variables in production.

define('DB_HOST',     getenv('DB_HOST')     ?: 'localhost');
define('DB_PORT',     getenv('DB_PORT')     ?: '3306');
define('DB_NAME',     getenv('DB_NAME')     ?: 'gigmatch');
define('DB_USER',     getenv('DB_USER')     ?: 'root');
define('DB_PASS',     getenv('DB_PASS')     ?: '');
define('DB_CHARSET',  'utf8mb4');

define('JWT_SECRET',  getenv('JWT_SECRET')  ?: 'gigmatch-secret-key-change-in-production');
define('JWT_EXPIRE',  60 * 60 * 24 * 7);   // 7 days in seconds

define('APP_ENV',     getenv('APP_ENV')     ?: 'production');
define('APP_URL',     getenv('APP_URL')     ?: 'http://localhost');

// Platform fee (20 %)
define('PLATFORM_FEE', 0.20);

// CORS — comma-separated list of allowed origins, or '*'
define('CORS_ORIGIN', getenv('CORS_ORIGIN') ?: '*');
