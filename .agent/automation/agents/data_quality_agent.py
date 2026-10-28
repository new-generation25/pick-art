import os
import re
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from .base_agent import BaseAgent


class DataQualityAgent(BaseAgent):
    """
    Data Quality Agent: Ensures data integrity across Pick Art events.

    Responsibilities:
    - Duplicate detection
    - Required field validation
    - AI extraction quality monitoring
    - Anomaly detection
    - Auto-fix common issues
    """

    def __init__(self, project_root, db_connection=None):
        super().__init__("DataQualityAgent", project_root)
        self.db = db_connection
        self.quality_metrics = {
            "total_validated": 0,
            "passed": 0,
            "auto_fixed": 0,
            "manual_review": 0,
            "issues": []
        }

    def validate_event(self, event_data: Dict) -> Tuple[bool, List[str]]:
        """
        Validate a single event entry.

        Returns:
            (is_valid, issues_list)
        """
        issues = []

        # 1. Title validation
        if not self._validate_title(event_data.get("title")):
            issues.append("Invalid or missing title")

        # 2. Date validation
        if not self._validate_date(event_data.get("event_date")):
            issues.append("Invalid or missing date")

        # 3. Venue validation
        if not self._validate_venue(event_data.get("venue")):
            issues.append("Invalid or missing venue")

        # 4. Image validation
        if not self._validate_image(event_data.get("image_url")):
            issues.append("Invalid or missing image")

        # 5. Description quality
        if not self._validate_description(event_data.get("description")):
            issues.append("Description too short or missing")

        return len(issues) == 0, issues

    def _validate_title(self, title: Optional[str]) -> bool:
        """Validate event title."""
        if not title or len(title.strip()) < 3:
            return False

        # Check for placeholder values
        invalid_titles = ["공연", "행사", "전시", "event", "show"]
        if title.strip().lower() in invalid_titles:
            return False

        return True

    def _validate_date(self, event_date: Optional[str]) -> bool:
        """Validate event date."""
        if not event_date:
            return False

        try:
            # Parse date (supports multiple formats)
            parsed_date = self._parse_date(event_date)
            if not parsed_date:
                return False

            # Check date range (not >1 year past, not >2 years future)
            today = datetime.now()
            one_year_ago = today - timedelta(days=365)
            two_years_future = today + timedelta(days=730)

            if parsed_date < one_year_ago or parsed_date > two_years_future:
                return False

            return True
        except Exception:
            return False

    def _validate_venue(self, venue: Optional[str]) -> bool:
        """Validate venue name."""
        if not venue or len(venue.strip()) < 2:
            return False

        # Check for placeholder values
        invalid_venues = ["미정", "TBD", "추후공지", "미공개"]
        if venue.strip() in invalid_venues:
            return False

        return True

    def _validate_image(self, image_url: Optional[str]) -> bool:
        """Validate image URL."""
        if not image_url:
            return False

        # Basic URL validation
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain
            r'localhost|'  # localhost
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # IP
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)

        return bool(url_pattern.match(image_url))

    def _validate_description(self, description: Optional[str]) -> bool:
        """Validate description quality."""
        if not description or len(description.strip()) < 50:
            return False

        # Check if it's just ticket information (common issue)
        ticket_keywords = ["예매", "티켓", "좌석", "가격", "문의"]
        word_count = len(description.split())
        ticket_word_count = sum(1 for word in description.split() if any(kw in word for kw in ticket_keywords))

        # If >50% of words are ticket-related, description is low quality
        if word_count > 0 and (ticket_word_count / word_count) > 0.5:
            return False

        return True

    def auto_fix_encoding(self, text: str) -> Optional[str]:
        """Auto-fix encoding issues."""
        if not text:
            return text

        try:
            # Try to detect and fix mojibake (garbled text)
            # Common issue: UTF-8 text incorrectly decoded as EUC-KR
            if '�' in text or any(ord(char) > 0xFFFF for char in text):
                # Try re-encoding
                fixed_text = text.encode('latin1').decode('utf-8', errors='ignore')
                if fixed_text and len(fixed_text) > len(text) * 0.5:  # Sanity check
                    self.log(f"Fixed encoding: '{text[:30]}...' -> '{fixed_text[:30]}...'")
                    return fixed_text
        except Exception as e:
            self.log(f"Encoding fix failed: {e}")

        return text

    def auto_fix_whitespace(self, text: str) -> str:
        """Normalize whitespace in text."""
        if not text:
            return text

        # Remove extra spaces, normalize line breaks
        fixed_text = re.sub(r'\s+', ' ', text).strip()
        return fixed_text

    def normalize_date(self, date_str: str) -> Optional[str]:
        """Normalize date to ISO 8601 format."""
        parsed_date = self._parse_date(date_str)
        if parsed_date:
            return parsed_date.strftime('%Y-%m-%d')
        return None

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse date from various formats."""
        if not date_str:
            return None

        # Try common formats
        date_formats = [
            '%Y-%m-%d',
            '%Y/%m/%d',
            '%Y.%m.%d',
            '%Y년 %m월 %d일',
            '%Y-%m-%d %H:%M:%S',
        ]

        for fmt in date_formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        return None

    def detect_duplicates(self, events: List[Dict]) -> List[Tuple[Dict, Dict]]:
        """
        Detect duplicate events using fuzzy matching.

        Returns:
            List of (event1, event2) tuples that are likely duplicates
        """
        duplicates = []

        for i, event1 in enumerate(events):
            for event2 in events[i+1:]:
                if self._is_duplicate(event1, event2):
                    duplicates.append((event1, event2))

        return duplicates

    def _is_duplicate(self, event1: Dict, event2: Dict) -> bool:
        """Check if two events are duplicates."""
        # Exact URL match
        if event1.get("source_url") == event2.get("source_url"):
            return True

        # Fuzzy title + date + venue match
        title_similarity = self._string_similarity(
            event1.get("title", ""),
            event2.get("title", "")
        )

        date_match = event1.get("event_date") == event2.get("event_date")
        venue_match = event1.get("venue") == event2.get("venue")

        # Consider duplicate if title similarity >90% and date+venue match
        if title_similarity > 0.9 and date_match and venue_match:
            return True

        return False

    def _string_similarity(self, str1: str, str2: str) -> float:
        """Calculate string similarity (simple Levenshtein-like)."""
        if not str1 or not str2:
            return 0.0

        # Simple implementation - for production use rapidfuzz or fuzzywuzzy
        str1, str2 = str1.lower(), str2.lower()
        if str1 == str2:
            return 1.0

        # Count matching characters
        matches = sum(c1 == c2 for c1, c2 in zip(str1, str2))
        max_len = max(len(str1), len(str2))

        return matches / max_len if max_len > 0 else 0.0

    def generate_quality_report(self) -> str:
        """Generate markdown quality report."""
        report = f"""## Data Quality Report - {datetime.now().strftime('%Y-%m-%d')}

### Summary
- Total Entries Validated: {self.quality_metrics['total_validated']}
- ✅ Passed All Checks: {self.quality_metrics['passed']} ({self._percentage(self.quality_metrics['passed'], self.quality_metrics['total_validated'])}%)
- ⚠️  Auto-Fixed Issues: {self.quality_metrics['auto_fixed']} ({self._percentage(self.quality_metrics['auto_fixed'], self.quality_metrics['total_validated'])}%)
- ❌ Manual Review Needed: {self.quality_metrics['manual_review']} ({self._percentage(self.quality_metrics['manual_review'], self.quality_metrics['total_validated'])}%)

### Issue Breakdown
"""

        # Group issues by type
        issue_counts = {}
        for issue in self.quality_metrics['issues']:
            issue_type = issue.get('type', 'Unknown')
            issue_counts[issue_type] = issue_counts.get(issue_type, 0) + 1

        for issue_type, count in issue_counts.items():
            percentage = self._percentage(count, self.quality_metrics['total_validated'])
            report += f"- {issue_type}: {count} ({percentage}%)\n"

        return report

    def _percentage(self, part: int, whole: int) -> float:
        """Calculate percentage."""
        if whole == 0:
            return 0.0
        return round((part / whole) * 100, 1)

    def health_check(self) -> str:
        """Perform health check."""
        self.log("Starting Data Quality Agent Health Check...")

        checks = {
            "Database Connection": self.db is not None,
            "Quality Metrics Initialized": isinstance(self.quality_metrics, dict),
        }

        all_healthy = all(checks.values())
        status = "HEALTHY" if all_healthy else "ISSUES_FOUND"

        for check_name, result in checks.items():
            status_icon = "✅" if result else "❌"
            self.log(f"{status_icon} {check_name}")

        self.log(f"Health Status: {status}")
        return status
