import psycopg2
import os

def create_tables():
    # 로컬 Supabase DB 접속 정보 (기본값)
    conn_params = {
        "host": "localhost",
        "port": "54322",
        "database": "postgres",
        "user": "postgres",
        "password": "postgres"
    }

    sql_statements = [
        """
        CREATE TABLE IF NOT EXISTS crawl_logs (
            id BIGSERIAL PRIMARY KEY,
            target_name TEXT NOT NULL,
            started_at TIMESTAMPTZ DEFAULT NOW(),
            finished_at TIMESTAMPTZ,
            status TEXT DEFAULT 'RUNNING',
            result_summary TEXT,
            error_msg TEXT,
            log_detail JSONB
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS configs (
            id BIGSERIAL PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,
            value TEXT,
            description TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS crawler_configs (
            id BIGSERIAL PRIMARY KEY,
            source_name TEXT UNIQUE NOT NULL,
            config JSONB,
            is_active BOOLEAN DEFAULT TRUE,
            last_run TIMESTAMPTZ
        );
        """,
        "ALTER TABLE crawl_logs ENABLE ROW LEVEL SECURITY;",
        "DROP POLICY IF EXISTS \"Allow public access\" ON crawl_logs;",
        "CREATE POLICY \"Allow public access\" ON crawl_logs FOR ALL USING (true) WITH CHECK (true);",
        "ALTER TABLE configs ENABLE ROW LEVEL SECURITY;",
        "DROP POLICY IF EXISTS \"Allow public access\" ON configs;",
        "CREATE POLICY \"Allow public access\" ON configs FOR ALL USING (true) WITH CHECK (true);"
    ]

    try:
        conn = psycopg2.connect(**conn_params)
        cur = conn.cursor()
        
        for sql in sql_statements:
            try:
                cur.execute(sql)
                print(f"✅ Executed: {sql.strip().splitlines()[0]}")
            except Exception as e:
                print(f"⚠️ Error executing statement: {e}")
                conn.rollback()
                continue
        
        conn.commit()
        cur.close()
        conn.close()
        print("\n🚀 All tables checked/created successfully!")
        
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        print("\n💡 만약 접속이 안 된다면, Supabase 대시보드(SQL Editor)에서 위 쿼리를 직접 실행해 주세요.")

if __name__ == "__main__":
    create_tables()
