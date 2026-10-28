"""
Test whitelist matching logic
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from urllib.parse import urlparse

# Test data
wl_value = "https://wgcc.ghct.or.kr/board/show01_01"
source_url = "https://wgcc.ghct.or.kr/board/detail/show01_01/514"
source_id = "514"

print(f"Whitelist value: {wl_value}")
print(f"Source URL: {source_url}")
print(f"Source ID: {source_id}")
print()

# Test matching logic - NEW STRATEGY
is_match = False

# Strategy 1: Exact match
if wl_value in [source_id, source_url]:
    is_match = True
    print("✅ Strategy 1 - Exact match: SUCCESS")
else:
    print("❌ Strategy 1 - Exact match: FAIL")

# Strategy 2: Domain-based matching
if source_url and wl_value:
    try:
        wl_domain = urlparse(wl_value).netloc if 'http' in wl_value else wl_value
        source_domain = urlparse(source_url).netloc if 'http' in source_url else source_url

        print(f"\nDomain extraction:")
        print(f"  WL domain: {wl_domain}")
        print(f"  Source domain: {source_domain}")

        # Domain match
        if wl_domain and source_domain and (wl_domain == source_domain or wl_domain in source_domain or source_domain in wl_domain):
            is_match = True
            print("✅ Strategy 2a - Domain match: SUCCESS")
        else:
            print("❌ Strategy 2a - Domain match: FAIL")

        # Path component match
        path_parts = [part for part in wl_value.split('/') if part and part not in ['http:', 'https:', '']]
        print(f"\nPath components from WL: {path_parts}")

        path_match = any(part in source_url for part in path_parts)
        print(f"Path match check: {path_match}")

        if path_match:
            is_match = True
            print("✅ Strategy 2b - Path component match: SUCCESS")
        else:
            print("❌ Strategy 2b - Path component match: FAIL")

    except Exception as e:
        print(f"⚠️ Strategy 2 error: {e}")

print("\n" + "="*60)
if is_match:
    print("✅ OVERALL RESULT: MATCH - Item should be whitelisted")
else:
    print("❌ OVERALL RESULT: NO MATCH - Item would be rejected")
