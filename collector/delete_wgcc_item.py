"""
Delete one WGCC item to test fresh crawl
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from dotenv import load_dotenv
from database import Database

load_dotenv(".env.local")

db = Database()

# Delete the most recent WGCC item
url_to_delete = "https://wgcc.ghct.or.kr/board/detail/show01_01/514"

try:
    result = db.supabase.table("raw_posts").delete().eq("source_url", url_to_delete).execute()
    if result.data:
        print(f"✅ Deleted item: {url_to_delete}")
        print(f"   Deleted {len(result.data)} record(s)")
    else:
        print(f"⚠️ No item found to delete: {url_to_delete}")
except Exception as e:
    print(f"❌ Error deleting item: {e}")
