import os
import re
from typing import List, Dict, Tuple
from .base_agent import BaseAgent


class DocumentationAgent(BaseAgent):
    """
    Documentation Agent: Maintains documentation synchronization with code.
    """

    def __init__(self, project_root):
        super().__init__("DocumentationAgent", project_root)
        self.doc_files = []
        self.broken_links = []

    def scan_documentation_files(self) -> List[str]:
        """Find all documentation files in the project."""
        self.log("Scanning for documentation files...")

        doc_patterns = ["*.md", "*.MD"]
        doc_files = []

        for root, dirs, files in os.walk(self.root_path):
            # Skip node_modules and other build directories
            dirs[:] = [d for d in dirs if d not in ['node_modules', '.next', 'dist', 'build', '.git']]

            for file in files:
                if file.endswith(('.md', '.MD')):
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, self.root_path)
                    doc_files.append(rel_path)

        self.doc_files = doc_files
        self.log(f"Found {len(doc_files)} documentation files")

        return doc_files

    def check_broken_links(self, doc_file: str) -> List[Dict]:
        """Check for broken links in a documentation file."""
        broken_links = []

        file_path = os.path.join(self.root_path, doc_file)

        if not os.path.exists(file_path):
            return broken_links

        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        # Find markdown links [text](url)
        link_pattern = r'\[([^\]]+)\]\(([^)]+)\)'
        matches = re.findall(link_pattern, content)

        for link_text, link_url in matches:
            # Check if it's a relative file link
            if not link_url.startswith(('http://', 'https://', '#', 'mailto:')):
                # Resolve relative path
                doc_dir = os.path.dirname(file_path)
                linked_file = os.path.join(doc_dir, link_url)

                if not os.path.exists(linked_file):
                    broken_links.append({
                        "file": doc_file,
                        "link_text": link_text,
                        "link_url": link_url,
                        "type": "missing_file"
                    })

        return broken_links

    def validate_all_links(self) -> Tuple[int, List[Dict]]:
        """Validate links in all documentation files."""
        self.log("Validating documentation links...")

        if not self.doc_files:
            self.scan_documentation_files()

        all_broken_links = []

        for doc_file in self.doc_files:
            broken_links = self.check_broken_links(doc_file)
            all_broken_links.extend(broken_links)

        self.broken_links = all_broken_links

        if all_broken_links:
            self.log(f"❌ Found {len(all_broken_links)} broken links")
            for link in all_broken_links[:5]:  # Show first 5
                self.log(f"  - {link['file']}: '{link['link_text']}' -> {link['link_url']}")
        else:
            self.log("✅ No broken links found")

        return len(all_broken_links), all_broken_links

    def find_outdated_documentation(self) -> List[Dict]:
        """Identify documentation that might be outdated."""
        self.log("Checking for outdated documentation...")

        outdated_docs = []

        # Check for references to deleted features
        deprecated_keywords = [
            "admin/",  # Old admin directory
            "Streamlit",  # Old admin framework
            "PRD_Gyeongnam",  # Deleted PRD
        ]

        for doc_file in self.doc_files:
            file_path = os.path.join(self.root_path, doc_file)

            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()

                for keyword in deprecated_keywords:
                    if keyword in content:
                        outdated_docs.append({
                            "file": doc_file,
                            "issue": f"References deprecated '{keyword}'",
                            "severity": "medium"
                        })
            except Exception as e:
                self.log(f"Error reading {doc_file}: {e}")

        if outdated_docs:
            self.log(f"⚠️  Found {len(outdated_docs)} potentially outdated docs")
        else:
            self.log("✅ No obviously outdated documentation found")

        return outdated_docs

    def generate_documentation_report(self) -> str:
        """Generate documentation health report."""
        # Run checks
        broken_link_count, broken_links = self.validate_all_links()
        outdated_docs = self.find_outdated_documentation()

        report = f"""
# Documentation Health Report

## Summary
- Total Documentation Files: {len(self.doc_files)}
- Broken Links: {broken_link_count}
- Potentially Outdated Docs: {len(outdated_docs)}

## Documentation Inventory
"""

        # Group docs by type
        root_docs = [d for d in self.doc_files if '/' not in d and '\\' not in d]
        agent_docs = [d for d in self.doc_files if '.agent' in d]
        other_docs = [d for d in self.doc_files if d not in root_docs and d not in agent_docs]

        report += f"\n### Root Documentation ({len(root_docs)} files)\n"
        for doc in root_docs:
            report += f"- {doc}\n"

        report += f"\n### Agent Documentation ({len(agent_docs)} files)\n"
        for doc in agent_docs[:10]:  # Show first 10
            report += f"- {doc}\n"

        if broken_links:
            report += "\n## Broken Links\n"
            for link in broken_links[:10]:  # Show first 10
                report += f"- {link['file']}: `{link['link_url']}` (type: {link['type']})\n"

        if outdated_docs:
            report += "\n## Potentially Outdated Documentation\n"
            for doc in outdated_docs:
                report += f"- {doc['file']}: {doc['issue']}\n"

        return report

    def health_check(self) -> str:
        """Perform health check."""
        self.log("Starting Documentation Agent Health Check...")

        # Scan for docs
        self.scan_documentation_files()

        checks = {
            "Documentation Files Found": len(self.doc_files) > 0,
            "README.md Exists": any('README.md' in f for f in self.doc_files),
            "Agent Architecture Documented": any('AGENT_ARCHITECTURE.md' in f for f in self.doc_files),
        }

        all_healthy = all(checks.values())
        status = "HEALTHY" if all_healthy else "ISSUES_FOUND"

        for check_name, result in checks.items():
            status_icon = "✅" if result else "❌"
            self.log(f"{status_icon} {check_name}")

        self.log(f"Health Status: {status}")
        return status
