import os
import subprocess
from .base_agent import BaseAgent

class FrontendAgent(BaseAgent):
    def __init__(self, project_root):
        super().__init__("FrontendAgent", os.path.join(project_root, "frontend"))

    def health_check(self):
        self.log("Starting Health Check...")
        
        # 1. Critical Files
        files = ["package.json", "tsconfig.json", "next.config.ts"]
        all_files_exist = all(self.check_file_exists(f) for f in files)
        
        # 2. Node Modules
        node_modules = os.path.isdir(os.path.join(self.root_path, "node_modules"))
        if not node_modules:
            self.log("WARNING: node_modules not found. Run 'npm install'.")

        status = "HEALTHY" if all_files_exist and node_modules else "ISSUES_FOUND"
        self.log(f"Health Status: {status}")
        return status

    def run_type_check(self):
        self.log("Running TypeScript Type Check...")
        try:
            # Requires npm to be in path
            result = subprocess.run(
                ["npm", "run", "type-check"], # Assuming this script exists or use tsc
                cwd=self.root_path,
                capture_output=True,
                text=True,
                shell=True # Needed for npm on windows sometimes
            )
            # Fallback to tsc directly if script missing
            if "missing script" in result.stderr:
                 result = subprocess.run(
                    ["npx", "tsc", "--noEmit"],
                    cwd=self.root_path,
                    capture_output=True,
                    text=True,
                    shell=True
                )
            
            if result.returncode == 0:
                self.log("Type Check PASSED.")
            else:
                self.log("Type Check FAILED.")
                self.log(result.stdout[:500]) # Show first 500 chars 
        except Exception as e:
            self.log(f"Error running type check: {e}")
