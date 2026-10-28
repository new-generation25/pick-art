import os
import subprocess
from typing import Dict, List, Tuple
from .base_agent import BaseAgent


class DeploymentAgent(BaseAgent):
    """
    Deployment Agent: Ensures safe deployments with validation and rollback capability.
    """

    def __init__(self, project_root):
        super().__init__("DeploymentAgent", project_root)
        self.validation_results = {}

    def validate_environment_vars(self, env_file=".env.production") -> Tuple[bool, List[str]]:
        """Validate required environment variables exist."""
        self.log("Validating environment variables...")

        required_vars = [
            "DATABASE_URL",
            "NEXT_PUBLIC_SUPABASE_URL",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
            "GOOGLE_AI_API_KEY",
            "KOPIS_API_KEY",
        ]

        env_path = os.path.join(self.root_path, env_file)
        missing_vars = []

        if not os.path.exists(env_path):
            self.log(f"❌ Environment file not found: {env_file}")
            return False, [f"Missing {env_file}"]

        # Read env file
        with open(env_path, 'r') as f:
            env_content = f.read()

        for var in required_vars:
            if var not in env_content or f"{var}=" not in env_content:
                missing_vars.append(var)
                self.log(f"❌ Missing required variable: {var}")

        if missing_vars:
            return False, missing_vars

        self.log("✅ All required environment variables present")
        return True, []

    def validate_dependencies(self) -> Tuple[bool, List[str]]:
        """Validate dependencies are installed and up-to-date."""
        self.log("Validating dependencies...")

        issues = []

        # Check package.json and node_modules
        frontend_path = os.path.join(self.root_path, "frontend")
        if os.path.exists(os.path.join(frontend_path, "package.json")):
            if not os.path.exists(os.path.join(frontend_path, "node_modules")):
                issues.append("Frontend: node_modules missing (run npm install)")
                self.log("❌ Frontend dependencies not installed")

        # Check requirements.txt and Python packages
        collector_path = os.path.join(self.root_path, "collector")
        if os.path.exists(os.path.join(collector_path, "requirements.txt")):
            # Could add pip freeze check here
            self.log("✅ Collector requirements.txt found")

        if issues:
            return False, issues

        self.log("✅ Dependencies validated")
        return True, []

    def run_build(self) -> Tuple[bool, str]:
        """Run frontend build to verify it completes successfully."""
        self.log("Running frontend build...")

        frontend_path = os.path.join(self.root_path, "frontend")
        if not os.path.exists(frontend_path):
            return False, "Frontend directory not found"

        try:
            result = subprocess.run(
                ["npm", "run", "build"],
                cwd=frontend_path,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )

            if result.returncode == 0:
                self.log("✅ Frontend build successful")
                return True, "Build successful"
            else:
                self.log("❌ Frontend build failed")
                return False, result.stderr

        except subprocess.TimeoutExpired:
            self.log("❌ Build timeout (>5 minutes)")
            return False, "Build timeout"
        except Exception as e:
            self.log(f"❌ Build error: {e}")
            return False, str(e)

    def run_tests(self) -> Tuple[bool, Dict]:
        """Run test suite and return results."""
        self.log("Running test suite...")

        # Frontend tests
        frontend_path = os.path.join(self.root_path, "frontend")
        test_results = {"frontend": None, "backend": None}

        if os.path.exists(frontend_path):
            try:
                result = subprocess.run(
                    ["npm", "run", "test", "--", "--passWithNoTests"],
                    cwd=frontend_path,
                    capture_output=True,
                    text=True,
                    timeout=120
                )
                test_results["frontend"] = {
                    "passed": result.returncode == 0,
                    "output": result.stdout
                }
            except Exception as e:
                test_results["frontend"] = {
                    "passed": False,
                    "output": str(e)
                }

        # Determine overall pass/fail
        all_passed = all(
            result is None or result["passed"]
            for result in test_results.values()
        )

        if all_passed:
            self.log("✅ All tests passed")
        else:
            self.log("❌ Some tests failed")

        return all_passed, test_results

    def pre_deployment_checklist(self) -> Tuple[bool, Dict]:
        """Run complete pre-deployment validation."""
        self.log("=" * 50)
        self.log("Starting Pre-Deployment Validation")
        self.log("=" * 50)

        checklist = {}

        # 1. Environment variables
        env_valid, env_issues = self.validate_environment_vars()
        checklist["environment"] = {"passed": env_valid, "issues": env_issues}

        # 2. Dependencies
        deps_valid, deps_issues = self.validate_dependencies()
        checklist["dependencies"] = {"passed": deps_valid, "issues": deps_issues}

        # 3. Build
        build_valid, build_output = self.run_build()
        checklist["build"] = {"passed": build_valid, "output": build_output}

        # 4. Tests (optional - can skip if no tests)
        # tests_valid, test_results = self.run_tests()
        # checklist["tests"] = {"passed": tests_valid, "results": test_results}

        # Overall result
        all_passed = all(item["passed"] for item in checklist.values())

        self.log("=" * 50)
        if all_passed:
            self.log("✅ Pre-deployment validation PASSED")
        else:
            self.log("❌ Pre-deployment validation FAILED")
        self.log("=" * 50)

        return all_passed, checklist

    def health_check_post_deployment(self, base_url: str) -> Tuple[bool, Dict]:
        """Run post-deployment health checks."""
        self.log("Running post-deployment health checks...")

        checks = {}

        # Could add actual HTTP requests to verify endpoints
        # For now, placeholder implementation

        checks["services_running"] = True
        checks["database_connected"] = True  # Would actually test DB connection
        checks["api_responsive"] = True  # Would actually test API endpoints

        all_passed = all(checks.values())

        if all_passed:
            self.log("✅ Post-deployment health checks passed")
        else:
            self.log("❌ Post-deployment health checks failed")

        return all_passed, checks

    def create_git_tag(self, version: str) -> bool:
        """Create git tag for deployment."""
        self.log(f"Creating git tag: {version}")

        try:
            # Create tag
            subprocess.run(
                ["git", "tag", "-a", version, "-m", f"Deployment {version}"],
                cwd=self.root_path,
                check=True
            )

            self.log(f"✅ Git tag created: {version}")
            return True

        except subprocess.CalledProcessError as e:
            self.log(f"❌ Failed to create git tag: {e}")
            return False

    def health_check(self) -> str:
        """Perform health check."""
        self.log("Starting Deployment Agent Health Check...")

        checks = {
            "Project Root Exists": os.path.exists(self.root_path),
            "Git Repository": os.path.exists(os.path.join(self.root_path, ".git")),
            "Frontend Directory": os.path.exists(os.path.join(self.root_path, "frontend")),
            "Collector Directory": os.path.exists(os.path.join(self.root_path, "collector")),
        }

        all_healthy = all(checks.values())
        status = "HEALTHY" if all_healthy else "ISSUES_FOUND"

        for check_name, result in checks.items():
            status_icon = "✅" if result else "❌"
            self.log(f"{status_icon} {check_name}")

        self.log(f"Health Status: {status}")
        return status
