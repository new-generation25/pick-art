"""KOPIS 상세 XML의 주최·주관·기획·제작 뽑기 (specs/012). 실행: collector 폴더에서 python -m pytest tests/test_kopis_orgs.py"""
import os
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from kopis_scraper import org_fields  # noqa: E402

XML = """<dbs><db><mt20id>PF000001</mt20id>
<entrpsnmP>피비컴퍼니</entrpsnmP><entrpsnmA> </entrpsnmA>
<entrpsnmH>(재)밀양문화관광재단</entrpsnmH><entrpsnmS>(재)밀양문화관광재단, 밀양시</entrpsnmS>
</db></dbs>"""


def test_org_fields_keeps_filled_tags_only():
    d = ET.fromstring(XML).find("db")
    assert org_fields(d) == {
        "host": "(재)밀양문화관광재단",
        "organizer": "(재)밀양문화관광재단, 밀양시",
        "producer": "피비컴퍼니",
    }


def test_org_fields_missing_db():
    assert org_fields(None) == {}
    assert org_fields(ET.fromstring("<db><mt20id>x</mt20id></db>")) == {}
