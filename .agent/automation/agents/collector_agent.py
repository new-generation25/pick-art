import os
import subprocess
from .base_agent import BaseAgent

class CollectorAgent(BaseAgent):
    def __init__(self, project_root):
        super().__init__("CollectorAgent", os.path.join(project_root, "collector"))

    def health_check(self):
        self.log("Starting Health Check...")
        
        # 1. Critical Files
        files = ["requirements.txt", "main.py", "kopis_scraper.py", ".env"]
        all_files_exist = all(self.check_file_exists(f) for f in files)
        
        # 2. Virtual Env Check
        venv_exists = os.path.isdir(os.path.join(self.root_path, "env")) or \
                      os.path.isdir(os.path.join(self.root_path, "venv"))
        
        status = "HEALTHY" if all_files_exist else "ISSUES_FOUND"
        self.log(f"Health Status: {status}")
        return status

    def run_kopis_crawl(self):
        self.log("Triggering KOPIS Scraper...")
        try:
            # Assumes python is available and requirements installed
            # In a real agent, we might use a docker command or specific venv python
            script_path = os.path.join(self.root_path, "kopis_scraper.py")
            result = subprocess.run(
                ["python", script_path], 
                cwd=self.root_path,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace'
            )
            if result.returncode == 0:
                self.log("KOPIS Scraper finished successfully.")
                self.log(result.stdout[-200:]) # Show last 200 chars
            else:
                self.log("KOPIS Scraper FAILED.")
                self.log(result.stderr)
        except Exception as e:
            self.log(f"Error running scraper: {e}")

    def analyze_logs(self):
        log_file = os.path.join(self.root_path, "kopis.log")
        if os.path.exists(log_file):
            with open(log_file, "r", encoding="utf-8") as f:
                lines = f.readlines()
                errors = [l for l in lines if "ERROR" in l]
                self.log(f"Found {len(errors)} errors in kopis.log")
                for err in errors[-5:]: # Show last 5 errors
                    print(err.strip())
        else:
            self.log("No kopis.log found.")
