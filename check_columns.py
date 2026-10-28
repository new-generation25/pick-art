import os
from dotenv import load_dotenv
from supabase import create_client, Client

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env.local")
load_dotenv(env_path)

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

# Try to get one row to see columns
res = supabase.table("events").select("*").limit(1).execute()
if res.data:
    print("Columns in 'events' table:")
    print(res.data[0].keys())
else:
    print("No data in events table to inspect columns, or error occurred.")
