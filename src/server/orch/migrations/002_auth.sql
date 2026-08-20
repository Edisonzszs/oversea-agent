-- ═══════════════════════════════════════════════════════════════════
-- M1 · 002_auth — 手机号+验证码登录（通路版）
-- 说明：真实环境验证码走短信通道且绝不回传响应（本 POC 由响应回传供前端
-- 自动预填，见 server.ts /auth/send-code 注释）；随申办/一网通办不做。
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  phone         TEXT PRIMARY KEY,             -- 11 位手机号（M1 即账号主体）
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auth_codes (
  phone      TEXT NOT NULL,
  code       TEXT NOT NULL,                   -- 6 位数字
  expires_at TIMESTAMPTZ NOT NULL,            -- 5 分钟有效
  used       BOOLEAN NOT NULL DEFAULT false,  -- 一次性
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_codes_phone ON auth_codes (phone, created_at);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token      TEXT PRIMARY KEY,                -- uuid，客户端 Bearer 持有
  phone      TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,            -- 30 天
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_phone ON auth_sessions (phone);

INSERT INTO schema_migrations (version, name)
VALUES (2, '002_auth')
ON CONFLICT (version) DO NOTHING;
