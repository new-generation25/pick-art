"""collector/sources/*.json 사이트 정의를 읽고 검증한다. 필수 키가 없으면 로딩 자체를 실패시킨다."""
import json
import os
from urllib.parse import urlparse

SOURCES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources")
REQUIRED = {
    "": ["slug", "name", "match", "region", "venue", "boards", "expect"],
    "expect": ["min_rows"],
}


class SourceDefinitionError(ValueError):
    pass


def _validate(d: dict, path: str):
    for section, keys in REQUIRED.items():
        node = d if section == "" else d.get(section, {})
        for k in keys:
            if k not in node:
                raise SourceDefinitionError(f"{os.path.basename(path)}: '{section + '.' if section else ''}{k}' 없음")
    for b in d["boards"]:
        if "url" not in b or "category" not in b:
            raise SourceDefinitionError(f"{os.path.basename(path)}: boards 항목에 url/category 없음")
        if b.get("api"):
            if "link_template" not in b:
                raise SourceDefinitionError(f"{os.path.basename(path)}: api 게시판에 link_template 없음")
            continue
        lst = b.get("list") or d.get("list")
        if not lst:
            raise SourceDefinitionError(f"{os.path.basename(path)}: list(목록 선택자) 없음")
        for k in ("rows", "title", "period"):
            if k not in lst:
                raise SourceDefinitionError(f"{os.path.basename(path)}: list.{k} 없음")
        if "link_template" not in b and "link" not in lst:
            raise SourceDefinitionError(f"{os.path.basename(path)}: 링크 규칙(link_template 또는 list.link) 없음")


def load_all() -> list:
    defs = []
    for name in sorted(os.listdir(SOURCES_DIR)):
        if name.endswith(".json"):
            path = os.path.join(SOURCES_DIR, name)
            with open(path, encoding="utf-8") as f:
                d = json.load(f)
            _validate(d, path)
            defs.append(d)
    return defs


def find_for_url(url: str):
    host = urlparse(url or "").netloc
    for d in load_all():
        if any(m in host or m in (url or "") for m in d["match"]):
            return d
    return None
