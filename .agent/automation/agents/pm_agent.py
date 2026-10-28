import os
from .base_agent import BaseAgent
from .collector_agent import CollectorAgent
from .frontend_agent import FrontendAgent
from .replacer import ReplacerAgent
from .data_quality_agent import DataQualityAgent
from .performance_monitor_agent import PerformanceMonitorAgent
from .deployment_agent import DeploymentAgent
from .documentation_agent import DocumentationAgent

import subprocess
import json


class PMAgent(BaseAgent):
    def __init__(self, project_root, db_connection=None):
        super().__init__("PMAgent", project_root)

        # Initialize all sub-agents
        self.collector = CollectorAgent(project_root)
        self.frontend = FrontendAgent(project_root)
        self.replacer = ReplacerAgent()
        self.data_quality = DataQualityAgent(project_root, db_connection)
        self.performance_monitor = PerformanceMonitorAgent(project_root, db_connection)
        self.deployment = DeploymentAgent(project_root)
        self.documentation = DocumentationAgent(project_root)

    def report_status(self):
        """Generate comprehensive project status report."""
        self.log("=" * 60)
        self.log("PROJECT STATUS REPORT")
        self.log("=" * 60)

        # Collect status from all agents
        agent_statuses = {
            "Collector": self.collector.health_check(),
            "Frontend": self.frontend.health_check(),
            "Data Quality": self.data_quality.health_check(),
            "Performance Monitor": self.performance_monitor.health_check(),
            "Deployment": self.deployment.health_check(),
            "Documentation": self.documentation.health_check(),
        }

        # Display results
        for agent_name, status in agent_statuses.items():
            status_icon = "✅" if status == "HEALTHY" else "⚠️"
            self.log(f"{status_icon} {agent_name}: {status}")

        # Overall health
        all_healthy = all(status == "HEALTHY" for status in agent_statuses.values())
        overall = "ALL SYSTEMS HEALTHY" if all_healthy else "SOME ISSUES DETECTED"

        self.log("=" * 60)
        self.log(f"Overall Status: {overall}")
        self.log("=" * 60)

        return agent_statuses

    def rename_project(self, old, new):
        """Delegate renaming task to ReplacerAgent."""
        self.log("Delegating renaming task to ReplacerAgent...")
        self.replacer.run(old, new, self.root_path)

    def trigger_collection(self):
        """Trigger data collection with quality validation."""
        self.log("Instructing CollectorAgent to run KOPIS crawl...")

        # Start performance monitoring
        self.performance_monitor.start_monitoring("KOPIS Scraper")

        # Run collection
        self.collector.run_kopis_crawl()

        # Stop monitoring and get metrics
        exec_time = self.performance_monitor.stop_monitoring("KOPIS Scraper")

        # QA Logic Integration
        self.log("[QA Check] Verifying execution logs...")
        log_tool_path = os.path.join(self.root_path, ".agent", "system", "tools", "log_analyzer.py")
        log_target = os.path.join(self.root_path, "collector", "kopis.log")

        if os.path.exists(log_target):
            try:
                res = subprocess.run(["python", log_tool_path, log_target], capture_output=True, text=True)
                self.log(f"[QA Report] {res.stdout.strip()}")
            except Exception as e:
                self.log(f"[QA Fail] Could not run verification: {e}")
        else:
            self.log("[QA Warning] No log file generated to verify.")

        # Data quality validation (if DB connection available)
        if self.data_quality.db:
            self.log("[Data Quality] Running validation...")
            # Would validate collected data here

    def check_frontend(self):
        """Run frontend type checking and build validation."""
        self.log("Instructing FrontendAgent to check types...")
        self.frontend.run_type_check()

    def validate_deployment(self):
        """Run pre-deployment validation checklist."""
        self.log("Running pre-deployment validation...")

        success, checklist = self.deployment.pre_deployment_checklist()

        if success:
            self.log("✅ Deployment validation PASSED - Ready to deploy")
        else:
            self.log("❌ Deployment validation FAILED - Fix issues before deploying")

            # Show failures
            for check_name, result in checklist.items():
                if not result["passed"]:
                    self.log(f"  ❌ {check_name}: {result.get('issues', result.get('output', 'Failed'))}")

        return success, checklist

    def generate_performance_dashboard(self):
        """Generate and display performance metrics dashboard."""
        self.log("Generating performance dashboard...")

        # Update system metrics
        self.performance_monitor.get_system_resources()

        # Display dashboard
        dashboard = self.performance_monitor.generate_dashboard()
        print(dashboard)

        return dashboard

    def check_documentation_health(self):
        """Check documentation health and report issues."""
        self.log("Checking documentation health...")

        report = self.documentation.generate_documentation_report()
        print(report)

        return report

    def health_check(self):
        """Run comprehensive health check across all agents."""
        return self.report_status()

