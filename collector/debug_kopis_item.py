import aiohttp
import asyncio
import xml.etree.ElementTree as ET
from kopis_scraper import KopisScraper, API_KEY, BASE_URL_DETAIL
from database import Database

async def debug_kopis_detail(mt20id):
    print(f"🔎 Debugging KOPIS Item: {mt20id}")
    
    url = f"{BASE_URL_DETAIL}/{mt20id}"
    params = {"service": API_KEY}
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params) as response:
            text = await response.text()
            print(f"📥 Raw XML:\n{text[:500]}...") # Print first 500 chars
            
            root = ET.fromstring(text)
            db = root.find("db")
            
            if db:
                print("\n📊 Parsed Fields:")
                print(f"  - prfnm (Title): {db.findtext('prfnm')}")
                print(f"  - prfpdfrom: '{db.findtext('prfpdfrom')}'")
                print(f"  - prfpdto: '{db.findtext('prfpdto')}'")
                print(f"  - sty (Description): '{db.findtext('sty')}'")
                
                styurls = root.findall(".//styurl")
                print(f"  - styurls (Images): Found {len(styurls)}")
                for img in styurls:
                    print(f"    - {img.text}")
                
                # Check formatting
                d_start = db.findtext('prfpdfrom')
                d_end = db.findtext('prfpdto')
                
                # Simulate formatting fix
                if d_start:
                    d_start = d_start.replace(".", "-")
                if d_end:
                    d_end = d_end.replace(".", "-")
                    
                print(f"  => Formatted Dates: {d_start} ~ {d_end}")
            else:
                print("❌ No 'db' element found in XML")

if __name__ == "__main__":
    # Test with a known ID or the one from recent logs
    # Using PF280115 (example from logs) or replace with a real one
    asyncio.run(debug_kopis_detail("PF280115"))
