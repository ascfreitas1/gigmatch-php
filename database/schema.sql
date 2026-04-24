-- GigMatch MySQL Schema
-- Run once: mysql -u root -p gigmatch < schema.sql

CREATE DATABASE IF NOT EXISTS gigmatch CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gigmatch;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id           VARCHAR(36)  PRIMARY KEY,
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL DEFAULT '',
  role         ENUM('performer','host','admin') NOT NULL,
  name         VARCHAR(255) NOT NULL,
  phone        VARCHAR(50),
  avatar_url   TEXT,
  bio          TEXT,
  city         VARCHAR(100),
  state        VARCHAR(100),
  country      VARCHAR(100),
  latitude     DOUBLE,
  longitude    DOUBLE,
  is_verified  TINYINT(1)   DEFAULT 0,
  is_active    TINYINT(1)   DEFAULT 1,
  social_score INT          DEFAULT 0,
  oauth_provider VARCHAR(50),
  oauth_id     VARCHAR(255),
  stripe_customer_id VARCHAR(100),
  stripe_account_id  VARCHAR(100),
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Performers
CREATE TABLE IF NOT EXISTS performers (
  id                  VARCHAR(36)  PRIMARY KEY,
  user_id             VARCHAR(36)  NOT NULL UNIQUE,
  act_type            VARCHAR(100) NOT NULL DEFAULT '',
  act_name            VARCHAR(255) NOT NULL DEFAULT '',
  genres              JSON         NOT NULL,
  experience_years    INT          DEFAULT 0,
  experience_description TEXT,
  hourly_rate         DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_hours           INT          DEFAULT 1,
  max_travel_km       INT          DEFAULT 50,
  equipment           TEXT,
  youtube_links       JSON,
  audio_links         JSON,
  profile_headline    VARCHAR(255),
  website_url         VARCHAR(255),
  whatsapp            VARCHAR(50),
  spotify_url         VARCHAR(255),
  soundcloud_url      VARCHAR(255),
  bandcamp_url        VARCHAR(255),
  apple_music_url     VARCHAR(255),
  setlist             JSON,
  languages           JSON,
  performance_types   JSON,
  awards              TEXT,
  press_quotes        TEXT,
  rider_requirements  TEXT,
  cancellation_policy TEXT,
  instagram_handle    VARCHAR(100),
  facebook_handle     VARCHAR(100),
  tiktok_handle       VARCHAR(100),
  twitter_handle      VARCHAR(100),
  youtube_channel     VARCHAR(255),
  platform_score      INT          DEFAULT 0,
  total_gigs          INT          DEFAULT 0,
  avg_rating          DECIMAL(3,2) DEFAULT 0.00,
  is_available        TINYINT(1)   DEFAULT 1,
  created_at          DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Hosts
CREATE TABLE IF NOT EXISTS hosts (
  id           VARCHAR(36)  PRIMARY KEY,
  user_id      VARCHAR(36)  NOT NULL UNIQUE,
  company_name VARCHAR(255),
  host_type    VARCHAR(100),
  total_events INT          DEFAULT 0,
  avg_rating   DECIMAL(3,2) DEFAULT 0.00,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Events
CREATE TABLE IF NOT EXISTS events (
  id               VARCHAR(36)   PRIMARY KEY,
  host_id          VARCHAR(36)   NOT NULL,
  title            VARCHAR(255)  NOT NULL,
  event_type       VARCHAR(100)  NOT NULL,
  description      TEXT,
  venue_name       VARCHAR(255),
  address          VARCHAR(255)  NOT NULL,
  city             VARCHAR(100)  NOT NULL,
  state            VARCHAR(100),
  country          VARCHAR(100)  NOT NULL,
  latitude         DOUBLE        NOT NULL DEFAULT 0,
  longitude        DOUBLE        NOT NULL DEFAULT 0,
  event_date       DATE          NOT NULL,
  start_time       TIME          NOT NULL,
  end_time         TIME          NOT NULL,
  duration_hours   DECIMAL(4,1)  NOT NULL,
  expected_audience INT,
  infrastructure   JSON,
  musical_taste    TEXT,
  act_types_needed JSON          NOT NULL,
  genres_preferred JSON,
  budget_min       DECIMAL(10,2),
  budget_max       DECIMAL(10,2),
  objective        TEXT,
  dress_code       VARCHAR(100),
  status           ENUM('open','filled','completed','cancelled','disputed') DEFAULT 'open',
  created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id                     VARCHAR(36)   PRIMARY KEY,
  event_id               VARCHAR(36)   NOT NULL,
  performer_id           VARCHAR(36)   NOT NULL,
  host_id                VARCHAR(36)   NOT NULL,
  hours_booked           DECIMAL(4,1)  NOT NULL,
  hourly_rate            DECIMAL(10,2) NOT NULL,
  subtotal               DECIMAL(10,2) NOT NULL,
  commission             DECIMAL(10,2) NOT NULL,
  total_amount           DECIMAL(10,2) NOT NULL,
  performer_payout       DECIMAL(10,2) NOT NULL,
  status                 ENUM('pending','accepted','rejected','paid','escrow','completed','disputed','refunded','cancelled') DEFAULT 'pending',
  stripe_payment_intent_id VARCHAR(100),
  escrow_released        TINYINT(1)    DEFAULT 0,
  performer_rated        TINYINT(1)    DEFAULT 0,
  host_rated             TINYINT(1)    DEFAULT 0,
  notes                  TEXT,
  created_at             DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id)     REFERENCES events(id),
  FOREIGN KEY (performer_id) REFERENCES performers(id),
  FOREIGN KEY (host_id)      REFERENCES hosts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ratings
CREATE TABLE IF NOT EXISTS ratings (
  id             VARCHAR(36) PRIMARY KEY,
  booking_id     VARCHAR(36) NOT NULL,
  rater_user_id  VARCHAR(36) NOT NULL,
  rated_user_id  VARCHAR(36) NOT NULL,
  rater_role     ENUM('performer','host') NOT NULL,
  score          TINYINT     NOT NULL CHECK(score BETWEEN 1 AND 5),
  comment        TEXT,
  created_at     DATETIME    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id)    REFERENCES bookings(id),
  FOREIGN KEY (rater_user_id) REFERENCES users(id),
  FOREIGN KEY (rated_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id         VARCHAR(36)  PRIMARY KEY,
  user_id    VARCHAR(36)  NOT NULL,
  type       VARCHAR(100) NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT         NOT NULL,
  data       JSON,
  is_read    TINYINT(1)   DEFAULT 0,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Social Shares
CREATE TABLE IF NOT EXISTS social_shares (
  id              VARCHAR(36)  PRIMARY KEY,
  performer_id    VARCHAR(36)  NOT NULL,
  platform        VARCHAR(50)  NOT NULL,
  post_url        VARCHAR(500),
  points_awarded  INT          DEFAULT 10,
  verified        TINYINT(1)   DEFAULT 0,
  created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (performer_id) REFERENCES performers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Disputes
CREATE TABLE IF NOT EXISTS disputes (
  id                VARCHAR(36)  PRIMARY KEY,
  booking_id        VARCHAR(36)  NOT NULL,
  raised_by_user_id VARCHAR(36)  NOT NULL,
  reason            VARCHAR(255) NOT NULL,
  description       TEXT         NOT NULL,
  evidence_urls     JSON,
  status            ENUM('open','investigating','resolved_performer','resolved_host','refunded') DEFAULT 'open',
  resolution_notes  TEXT,
  resolved_by       VARCHAR(36),
  created_at        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id)        REFERENCES bookings(id),
  FOREIGN KEY (raised_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id          VARCHAR(36) PRIMARY KEY,
  booking_id  VARCHAR(36),
  sender_id   VARCHAR(36) NOT NULL,
  receiver_id VARCHAR(36) NOT NULL,
  message     TEXT        NOT NULL,
  is_read     TINYINT(1)  DEFAULT 0,
  created_at  DATETIME    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id)   REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_status   ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date     ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_location ON events(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_bookings_event  ON bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_perf   ON bookings(performer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_notif_user      ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_recv   ON messages(receiver_id, is_read);
