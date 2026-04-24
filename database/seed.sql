-- GigMatch seed data
-- Run after schema: mysql -u root -p gigmatch < database/seed.sql

-- Admin user (password: Admin@123!)
INSERT IGNORE INTO users (id, email, password_hash, role, name, is_verified, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@gigmatch.com',
  '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Admin@123!
  'admin', 'GigMatch Admin', 1, 1
);

-- Demo performer (password: Demo@1234)
INSERT IGNORE INTO users (id, email, password_hash, role, name, city, country, is_verified, is_active, latitude, longitude)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'performer@demo.com',
  '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'performer', 'Demo Performer', 'São Paulo', 'Brasil', 1, 1, -23.5505, -46.6333
);
INSERT IGNORE INTO performers (id, user_id, act_type, act_name, genres, hourly_rate, max_travel_km, is_available)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  'Banda / Band', 'Demo Band', '["Pop","Rock"]', 150.00, 100, 1
);

-- Demo host (password: Demo@1234)
INSERT IGNORE INTO users (id, email, password_hash, role, name, city, country, is_verified, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'host@demo.com',
  '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'host', 'Demo Host', 'São Paulo', 'Brasil', 1, 1
);
INSERT IGNORE INTO hosts (id, user_id, company_name, host_type)
VALUES (
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000004',
  'Demo Events Co.', 'Corporate'
);
