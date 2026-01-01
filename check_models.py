import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv('.env.local')
api_key = os.getenv('NEXT_PUBLIC_GEMINI_API_KEY')

if not api_key:
    print("API Key not found!")
else:
    genai.configure(api_key=api_key)
    print(f"Checking models with key: {api_key[:5]}...")
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"- {m.name}")
    except Exception as e:
        print(f"Error listing models: {e}")
