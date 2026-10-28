"""
Check AI extraction results for COLLECTED posts
"""
import sys
import json
sys.stdout.reconfigure(encoding='utf-8')

from dotenv import load_dotenv
from database import Database

load_dotenv("../frontend/.env.local")

db = Database()

print("\n" + "="*80)
print("Checking AI extraction results for COLLECTED wgcc.ghct.or.kr posts")
print("="*80 + "\n")

try:
    # Get COLLECTED posts
    response = db.supabase.table("raw_posts").select("*").eq("status", "COLLECTED").ilike("source_url", "%wgcc.ghct.or.kr%").execute()

    if response.data:
        print(f"Found {len(response.data)} COLLECTED records:\n")
        for idx, record in enumerate(response.data, 1):
            print(f"{'='*80}")
            print(f"[{idx}] ID: {record['id']}")
            print(f"Source: {record['source']}")
            print(f"URL: {record['source_url']}")
            print(f"Title: {record.get('metadata', {}).get('title', 'N/A')}")
            print(f"\n--- AI Suggestion ---")

            ai_suggestion = record.get('metadata', {}).get('ai_suggestion')
            if ai_suggestion:
                print(json.dumps(ai_suggestion, indent=2, ensure_ascii=False))
            else:
                print("No AI suggestion found")

            print(f"\n--- Raw Text (first 500 chars) ---")
            raw_text = record.get('raw_text', '')
            print(raw_text[:500] if raw_text else "No raw text")
            print("\n")
    else:
        print("No COLLECTED records found")

except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    print(traceback.format_exc())
