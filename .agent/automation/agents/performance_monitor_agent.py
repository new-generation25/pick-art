import os
import time
import psutil
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from .base_agent import BaseAgent


class PerformanceMonitorAgent(BaseAgent):
    """
    Performance Monitor Agent: Tracks system performance and identifies bottlenecks.

    Responsibilities:
    - Scraper performance tracking
    - API usage monitoring
    - Database performance analysis
    - System resource monitoring
    - Bottleneck identification
    """

    def __init__(self, project_root, db_connection=None):
        super().__init__("PerformanceMonitorAgent", project_root)
        self.db = db_connection
        self.metrics = {
            "scrapers": {},
            "api_usage": {},
            "database": {},
            "system": {}
        }
        self.start_time = None
        self.process = psutil.Process()

    def start_monitoring(self, component: str):
        """Start monitoring a component."""
        self.start_time = time.perf_counter()
        self.log(f"Started monitoring: {component}")

    def stop_monitoring(self, component: str) -> float:
        """
        Stop monitoring and calculate execution time.

        Returns:
            execution_time in seconds
        """
        if not self.start_time:
            self.log("Warning: Monitoring was not started")
            return 0.0

        execution_time = time.perf_counter() - self.start_time
        self.log(f"Stopped monitoring: {component} - Execution time: {execution_time:.2f}s")

        # Store metric
        if component not in self.metrics["scrapers"]:
            self.metrics["scrapers"][component] = []
        self.metrics["scrapers"][component].append({
            "timestamp": datetime.now().isoformat(),
            "execution_time": execution_time
        })

        self.start_time = None
        return execution_time

    def track_scraper_performance(self, scraper_name: str, items_collected: int,
                                   success_count: int, failure_count: int,
                                   execution_time: float):
        """Track scraper performance metrics."""
        success_rate = (success_count / (success_count + failure_count)) * 100 if (success_count + failure_count) > 0 else 0
        items_per_minute = (items_collected / execution_time) * 60 if execution_time > 0 else 0

        metrics = {
            "timestamp": datetime.now().isoformat(),
            "scraper": scraper_name,
            "items_collected": items_collected,
            "success_count": success_count,
            "failure_count": failure_count,
            "success_rate": success_rate,
            "execution_time": execution_time,
            "items_per_minute": items_per_minute
        }

        self.metrics["scrapers"][scraper_name] = metrics
        self.log(f"Scraper: {scraper_name} | Items: {items_collected} | "
                 f"Success Rate: {success_rate:.1f}% | Time: {execution_time:.2f}s")

        return metrics

    def track_api_usage(self, api_name: str, calls: int, tokens: Optional[int] = None,
                       cost: Optional[float] = None):
        """Track API usage metrics."""
        if api_name not in self.metrics["api_usage"]:
            self.metrics["api_usage"][api_name] = {
                "total_calls": 0,
                "total_tokens": 0,
                "total_cost": 0.0,
                "daily_calls": 0,
                "daily_tokens": 0,
                "daily_cost": 0.0,
                "last_reset": datetime.now().date().isoformat()
            }

        api_metrics = self.metrics["api_usage"][api_name]

        # Reset daily counters if new day
        if api_metrics["last_reset"] != datetime.now().date().isoformat():
            api_metrics["daily_calls"] = 0
            api_metrics["daily_tokens"] = 0
            api_metrics["daily_cost"] = 0.0
            api_metrics["last_reset"] = datetime.now().date().isoformat()

        # Update counters
        api_metrics["total_calls"] += calls
        api_metrics["daily_calls"] += calls

        if tokens:
            api_metrics["total_tokens"] += tokens
            api_metrics["daily_tokens"] += tokens

        if cost:
            api_metrics["total_cost"] += cost
            api_metrics["daily_cost"] += cost

        self.log(f"API: {api_name} | Calls: {calls} | Tokens: {tokens or 'N/A'} | Cost: ${cost or 0:.2f}")

    def get_system_resources(self) -> Dict:
        """Get current system resource usage."""
        try:
            memory_info = self.process.memory_info()
            memory_mb = memory_info.rss / (1024 * 1024)  # Convert to MB
            memory_percent = self.process.memory_percent()
            cpu_percent = self.process.cpu_percent(interval=0.1)

            # System-wide metrics
            system_memory = psutil.virtual_memory()
            system_cpu = psutil.cpu_percent(interval=0.1)

            resources = {
                "timestamp": datetime.now().isoformat(),
                "process_memory_mb": round(memory_mb, 2),
                "process_memory_percent": round(memory_percent, 2),
                "process_cpu_percent": round(cpu_percent, 2),
                "system_memory_percent": round(system_memory.percent, 2),
                "system_cpu_percent": round(system_cpu, 2),
                "system_memory_available_gb": round(system_memory.available / (1024**3), 2)
            }

            self.metrics["system"] = resources
            return resources

        except Exception as e:
            self.log(f"Error getting system resources: {e}")
            return {}

    def check_performance_alerts(self) -> List[Dict]:
        """Check for performance alerts based on thresholds."""
        alerts = []

        # Check API usage against budget
        for api_name, api_metrics in self.metrics["api_usage"].items():
            daily_cost = api_metrics.get("daily_cost", 0)
            daily_budget = 20.0  # $20/day budget

            if daily_cost > daily_budget:
                alerts.append({
                    "severity": "CRITICAL",
                    "component": f"API - {api_name}",
                    "message": f"Daily API cost (${daily_cost:.2f}) exceeded budget (${daily_budget:.2f})"
                })
            elif daily_cost > daily_budget * 0.8:
                alerts.append({
                    "severity": "WARNING",
                    "component": f"API - {api_name}",
                    "message": f"Daily API cost (${daily_cost:.2f}) at 80% of budget"
                })

        # Check system resources
        system_metrics = self.metrics.get("system", {})
        memory_percent = system_metrics.get("system_memory_percent", 0)
        cpu_percent = system_metrics.get("system_cpu_percent", 0)

        if memory_percent > 85:
            alerts.append({
                "severity": "CRITICAL",
                "component": "System Memory",
                "message": f"Memory usage critical: {memory_percent}%"
            })
        elif memory_percent > 70:
            alerts.append({
                "severity": "WARNING",
                "component": "System Memory",
                "message": f"Memory usage high: {memory_percent}%"
            })

        if cpu_percent > 90:
            alerts.append({
                "severity": "CRITICAL",
                "component": "System CPU",
                "message": f"CPU usage critical: {cpu_percent}%"
            })

        return alerts

    def generate_dashboard(self) -> str:
        """Generate real-time performance dashboard."""
        dashboard = f"""
Performance Monitor - Real-time Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🕐 Current Time: {datetime.now().strftime('%H:%M:%S KST')}

Scraper Performance:
"""

        # Scraper metrics
        for scraper_name, metrics in self.metrics["scrapers"].items():
            if isinstance(metrics, dict):
                items = metrics.get("items_collected", 0)
                success_rate = metrics.get("success_rate", 0)
                exec_time = metrics.get("execution_time", 0)
                dashboard += f"""├─ {scraper_name}
│  ├─ Items Collected: {items}
│  ├─ Success Rate: {success_rate:.1f}%
│  └─ Execution Time: {exec_time:.2f}s
│
"""

        # API usage
        dashboard += "\nAPI Usage (Today):\n"
        for api_name, metrics in self.metrics["api_usage"].items():
            calls = metrics.get("daily_calls", 0)
            tokens = metrics.get("daily_tokens", 0)
            cost = metrics.get("daily_cost", 0)
            dashboard += f"├─ {api_name}: {calls} calls | {tokens:,} tokens | ${cost:.2f}\n"

        # System resources
        system = self.metrics.get("system", {})
        if system:
            dashboard += f"""
System Resources:
├─ Memory: {system.get('process_memory_mb', 0):.1f}MB ({system.get('system_memory_percent', 0):.1f}%)
├─ CPU: {system.get('system_cpu_percent', 0):.1f}%
└─ Available Memory: {system.get('system_memory_available_gb', 0):.2f}GB
"""

        # Alerts
        alerts = self.check_performance_alerts()
        if alerts:
            dashboard += "\n⚠️  Active Alerts:\n"
            for alert in alerts:
                severity_icon = "🔴" if alert["severity"] == "CRITICAL" else "🟡"
                dashboard += f"{severity_icon} [{alert['severity']}] {alert['component']}: {alert['message']}\n"

        dashboard += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"

        return dashboard

    def generate_daily_summary(self) -> str:
        """Generate daily performance summary."""
        today = datetime.now().strftime('%Y-%m-%d')

        summary = f"""
Performance Summary - {today}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Scraper Execution Times:
"""

        # Scraper summary
        total_items = 0
        for scraper_name, metrics in self.metrics["scrapers"].items():
            if isinstance(metrics, dict):
                exec_time = metrics.get("execution_time", 0)
                items = metrics.get("items_collected", 0)
                total_items += items
                summary += f"- {scraper_name}: {exec_time/60:.1f}m ({items} items)\n"

        # API costs
        summary += "\nAPI Costs:\n"
        total_cost = 0
        for api_name, metrics in self.metrics["api_usage"].items():
            daily_cost = metrics.get("daily_cost", 0)
            daily_tokens = metrics.get("daily_tokens", 0)
            total_cost += daily_cost
            summary += f"- {api_name}: ${daily_cost:.2f} ({daily_tokens:,} tokens)\n"

        summary += f"- Total: ${total_cost:.2f}/day | ${total_cost * 30:.2f}/month (projected)\n"

        summary += f"""
Items Collected:
- Total: {total_items} events

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

        return summary

    def health_check(self) -> str:
        """Perform health check."""
        self.log("Starting Performance Monitor Agent Health Check...")

        # Update system resources
        self.get_system_resources()

        checks = {
            "Metrics Collection": len(self.metrics) > 0,
            "System Resource Access": bool(self.metrics.get("system")),
        }

        all_healthy = all(checks.values())
        status = "HEALTHY" if all_healthy else "ISSUES_FOUND"

        for check_name, result in checks.items():
            status_icon = "✅" if result else "❌"
            self.log(f"{status_icon} {check_name}")

        self.log(f"Health Status: {status}")
        return status
