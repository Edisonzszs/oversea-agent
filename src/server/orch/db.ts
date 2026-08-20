/**
 * orch · Postgres 数据面（M1）
 * ============================================================
 * 部署形态：Docker postgres:16-alpine（仅本机 127.0.0.1:5432，卷 /opt/chuhai-pgdata），
 * 连接串 env DATABASE_URL（.env，600 权限）。pg 驱动纯 JS——本机零原生编译依赖
 * （曾试 SQLite/better-sqlite3：服务器 glibc 2.32 不满足预编译要求，源码编译后段错误，弃）。
 *
 * 迁移纪律：migrations/*.sql 按文件名版本号升序执行，登记 schema_migrations（幂等可重放）；
 * 编号只增、前向 only。schema 版本双保险：库级 schema_migrations + agent_events.schema_version。
 */
import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

export type Db = Pool;

function migrationsDir(): string {
  if (process.env.ORCH_MIGRATIONS_DIR) return process.env.ORCH_MIGRATIONS_DIR;
  if (typeof __dirname !== "undefined" && fs.existsSync(path.resolve(__dirname, "migrations"))) {
    return path.resolve(__dirname, "migrations");
  }
  return path.resolve(process.cwd(), "src/server/orch/migrations");
}

/** 连接池 + 确保迁移到位（幂等）。DATABASE_URL 未设置时抛错（服务启动即显性失败）。 */
export async function openDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 未设置（.env：postgres://chuhai:***@127.0.0.1:5432/chuhai）");
  const pool = new Pool({ connectionString: url, max: 5 });
  await pool.query("SELECT 1");

  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INT PRIMARY KEY, name TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const applied = new Set(
    (await pool.query<{ version: number }>("SELECT version FROM schema_migrations"))
      .rows.map((r) => r.version),
  );

  const dir = migrationsDir();
  const files = fs.readdirSync(dir).filter((f) => /^\d+_.*\.sql$/.test(f) && !f.endsWith(".sqlite.sql")).sort();
  for (const file of files) {
    const version = Number(file.split("_")[0]);
    const name = file.replace(/\.sql$/, "");
    if (!Number.isFinite(version) || applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf-8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING", [version, name]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      client.release();
      throw e;
    }
    client.release();
  }
  return pool;
}

/** 迁移状态查询（health 用） */
export async function migrationInfo(db: Db): Promise<Array<{ version: number; name: string; applied_at: string }>> {
  const r = await db.query<{ version: number; name: string; applied_at: string }>(
    "SELECT version, name, applied_at FROM schema_migrations ORDER BY version",
  );
  return r.rows;
}

export type { PoolClient, QueryResultRow };
