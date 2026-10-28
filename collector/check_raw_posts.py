import os
import sys
from dotenv import load_dotenv

# Fix encoding for Windows
sys.stdout.reconfigure(encoding='utf-8')

# Load environment variables
load_dotenv('../frontend/.env.local')

from database import Database

db = Database()

# Query raw_posts for wgcc.ghct.or.kr records
print("\n" + "="*60)
print("Checking raw_posts for wgcc.ghct.or.kr records")
print("="*60 + "\n")

try:
    response = db.supabase.table("raw_posts").select("id, source, source_url, status").ilike("source_url", "%wgcc.ghct.or.kr%").execute()

    if response.data:
        print(f"Found {len(response.data)} records:\n")
        for idx, record in enumerate(response.data, 1):
            print(f"[{idx}] ID: {record['id']}")
            print(f"    Source: {record['source']}")
            print(f"    URL: {record['source_url']}")
            print(f"    Status: {record['status']}")
            print()
    else:
        print("No records found in raw_posts")

except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    print(traceback.format_exc())

# Also check events table
print("\n" + "="*60)
print("Checking events for wgcc.ghct.or.kr records")
print("="*60 + "\n")

try:
    response = db.supabase.table("events").select("id, title, original_url, status").ilike("original_url", "%wgcc.ghct.or.kr%").execute()

    if response.data:
        print(f"Found {len(response.data)} records:\n")
        for idx, record in enumerate(response.data, 1):
            print(f"[{idx}] ID: {record['id']}")
            print(f"    Title: {record['title']}")
            print(f"    URL: {record['original_url']}")
            print(f"    Status: {record['status']}")
            print()
    else:
        print("No records found in events")

except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    print(traceback.format_exc())
