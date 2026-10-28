# 🏗️ Agent Architecture - Pick Art Project

## Overview

Pick Art 프로젝트는 **멀티 에이전트 시스템**으로 구성되어 있으며, 각 에이전트는 명확한 책임과 역할을 가지고 유기적으로 협력합니다.

---

## 📊 Agent Responsibility Matrix

| Agent | Primary Domain | Key Responsibilities | Tools/Technologies | MD Location | Python Implementation |
|-------|----------------|---------------------|-------------------|-------------|----------------------|
| **PM Agent** | Project Orchestration | - Task breakdown & delegation<br>- Sub-agent coordination<br>- Quality gate enforcement<br>- Status reporting | Subprocess, Task delegation | `.agent/system/personas/pm_agent.md` | `.agent/automation/agents/pm_agent.py` |
| **QA Agent** | Quality Assurance | - Autopilot monitoring<br>- Self-healing & recovery<br>- Case study documentation<br>- Build/deployment verification | QA autopilot, Log analyzer, TestSprite | `.agent/system/personas/qa_agent.md` | `.agent/automation/agents/qa_agent.py` (TBD) |
| **Collection Agent** | Data Harvesting | - Multi-source crawling (KOPIS, web, SNS)<br>- AI-powered metadata extraction<br>- Duplicate detection<br>- Ghost data recovery<br>- Resource optimization | Insta/KOPIS/Public scrapers, AI Vision | `.agent/system/personas/collection_agent.md` | `.agent/automation/agents/collector_agent.py` |
| **Frontend Agent** | UI/UX Development | - Next.js development<br>- Component creation<br>- TypeScript type safety<br>- Build optimization | Next.js, React, TypeScript | `.agent/system/personas/frontend_agent.md` | `.agent/automation/agents/frontend_agent.py` |
| **Backend Agent** | API & Infrastructure | - Supabase integration<br>- Database schema management<br>- API endpoint development<br>- Server-side logic | Supabase, PostgreSQL, Python | `.agent/system/personas/backend_agent.md` | `.agent/automation/agents/backend_agent.py` (TBD) |
| **Automation Agent** | Mass Operations | - Bulk rename/replace operations<br>- Code refactoring automation<br>- Pattern-based transformations | Python AST, Regex, Replacer tool | `.agent/system/personas/automation_agent.md` | `.agent/automation/agents/replacer.py` |
| **Data Quality Agent** | Data Integrity | - Duplicate event detection<br>- Field validation (title, date, venue)<br>- AI extraction quality monitoring<br>- Anomaly detection<br>- Auto-fix common issues | Database queries, Pattern matching | `.agent/system/personas/data_quality_agent.md` (NEW) | `.agent/automation/agents/data_quality_agent.py` (NEW) |
| **Performance Monitor Agent** | System Performance | - Scraper execution time tracking<br>- API usage monitoring (Gemini, Supabase)<br>- Bottleneck identification<br>- Cost metrics (API calls, storage)<br>- Performance recommendations | Logging, Metrics collection | `.agent/system/personas/performance_monitor_agent.md` (NEW) | `.agent/automation/agents/performance_monitor_agent.py` (NEW) |
| **Deployment Agent** | Deployment Safety | - Pre-deployment validation<br>- Environment parity checks<br>- Health checks post-deployment<br>- Rollback capability<br>- Smoke tests | Bash scripts, Health checks | `.agent/system/personas/deployment_agent.md` (NEW) | `.agent/automation/agents/deployment_agent.py` (NEW) |
| **Documentation Agent** | Documentation Sync | - Code-doc synchronization<br>- Automated README updates<br>- API documentation generation<br>- Change log maintenance | File analysis, Template generation | `.agent/system/personas/documentation_agent.md` (NEW) | `.agent/automation/agents/documentation_agent.py` (NEW) |

---

## 🔗 Agent Interaction Patterns

### Pattern 1: Collection Workflow
```
PM Agent
  ├─> Collection Agent (crawl data)
  │     ├─> KOPIS Scraper
  │     ├─> Public Scraper
  │     └─> Instagram Scraper
  ├─> Data Quality Agent (validate)
  │     └─> Auto-fix or escalate
  └─> QA Agent (final verification)
        └─> Report to PM
```

### Pattern 2: Development Workflow
```
PM Agent
  ├─> Frontend Agent (build UI)
  │     └─> Type check, build, deploy
  ├─> Backend Agent (API development)
  │     └─> Schema update, endpoint creation
  └─> QA Agent (integration test)
        └─> Sign-off or reject
```

### Pattern 3: Deployment Workflow
```
PM Agent
  ├─> Deployment Agent (pre-deployment validation)
  │     ├─> Environment check
  │     ├─> Dependency verification
  │     └─> Health check preparation
  ├─> Frontend/Backend Agent (build & deploy)
  ├─> Deployment Agent (post-deployment validation)
  │     ├─> Health checks
  │     └─> Smoke tests
  └─> QA Agent (final sign-off)
        └─> Monitor for issues
```

### Pattern 4: Quality Assurance Workflow
```
Collection Agent (crawl completes)
  └─> Data Quality Agent (automated validation)
        ├─> Field completeness check
        ├─> Duplicate detection
        ├─> AI extraction quality assessment
        ├─> Auto-fix if possible
        └─> Report anomalies to QA Agent
              └─> QA Agent (manual review if needed)
                    └─> Document in QA_CASE_STUDIES.md
```

---

## 🚦 Agent Lifecycle States

### Active Agents (Fully Implemented)
- ✅ **PM Agent**: Core orchestration logic implemented
- ✅ **Collection Agent**: KOPIS, Public, Instagram scrapers operational
- ✅ **Frontend Agent**: Type checking and build automation
- ✅ **Automation Agent**: Replacer tool functional

### In Development
- 🚧 **QA Agent**: Partial implementation (log analyzer exists, autopilot TBD)
- 🚧 **Backend Agent**: MD persona exists, Python implementation pending

### Planned (High Priority)
- 📋 **Data Quality Agent**: Critical for data integrity
- 📋 **Performance Monitor Agent**: Essential for optimization
- 📋 **Deployment Agent**: Needed for safe deployments
- 📋 **Documentation Agent**: Improves maintainability

---

## 📡 Communication Protocols

### 1. Task Delegation Protocol
```python
# PM Agent delegates to specialized agent
pm_agent.delegate_task(
    agent_type="collection",
    task="crawl_kopis",
    params={"date_range": "2024-01"},
    callback=qa_agent.verify_collection
)
```

### 2. Status Reporting Protocol
```python
# Agent reports status to PM
agent.report_status(
    status="SUCCESS" | "PARTIAL" | "FAILED",
    metrics={"items_collected": 50, "errors": 2},
    details="..."
)
```

### 3. Quality Gate Protocol
```python
# QA Agent validates and signs off
qa_result = qa_agent.validate(
    task_id="collection_001",
    validation_rules=["field_completeness", "no_duplicates"]
)
if qa_result.passed:
    pm_agent.approve_and_proceed()
else:
    pm_agent.rollback_or_fix()
```

---

## 🎯 Agent Design Principles

### 1. Single Responsibility
Each agent has one clear primary purpose and domain expertise.

### 2. Loose Coupling
Agents interact through well-defined interfaces, not internal implementation details.

### 3. High Cohesion
Related functionality is grouped within the same agent.

### 4. Fail-Safe Design
Agents handle errors gracefully and report issues clearly to PM Agent.

### 5. Scalability
Agent architecture supports adding new agents without modifying existing ones.

### 6. Self-Documentation
Each agent maintains its own persona MD file describing its responsibilities.

---

## 🔧 Implementation Guidelines

### Creating a New Agent

**Step 1: Define Persona (MD File)**
```markdown
# {Agent Name} Agent

## Role & Objective
[Clear description of agent's purpose]

## Core Responsibilities
- [Responsibility 1]
- [Responsibility 2]

## Tools & Technologies
- [Tool 1]
- [Tool 2]

## Interaction Protocol
[How this agent communicates with PM and other agents]
```

**Step 2: Implement Python Class**
```python
from .base_agent import BaseAgent

class {AgentName}Agent(BaseAgent):
    def __init__(self, project_root):
        super().__init__("{AgentName}Agent", project_root)

    def health_check(self):
        # Verify agent is operational
        pass

    def execute_task(self, task_params):
        # Main task execution logic
        pass
```

**Step 3: Register with PM Agent**
```python
# In pm_agent.py
from .{agent_module} import {AgentName}Agent

class PMAgent(BaseAgent):
    def __init__(self, project_root):
        # ... existing code ...
        self.{agent_name} = {AgentName}Agent(project_root)
```

---

## 📈 Future Enhancements

### Phase 1 (Current Priority)
1. Implement Data Quality Agent
2. Implement Performance Monitor Agent
3. Expand PM Agent capabilities
4. Complete QA Agent implementation

### Phase 2 (Next Quarter)
1. Implement Deployment Agent
2. Implement Documentation Agent
3. Add ML-based prediction to Performance Monitor
4. Enhance Collection Agent with advanced AI vision

### Phase 3 (Long-term)
1. Multi-language support agent
2. User feedback analysis agent
3. A/B testing orchestration agent
4. Cost optimization agent

---

## 🔍 Troubleshooting

### Agent Not Responding
1. Check if MD persona file exists
2. Verify Python implementation in `.agent/automation/agents/`
3. Check PM Agent has registered the agent
4. Review logs for initialization errors

### Agent Coordination Issues
1. Review interaction pattern in this document
2. Check callback functions are properly defined
3. Verify task parameters match agent expectations
4. Enable debug logging in PM Agent

### Performance Degradation
1. Check Performance Monitor Agent metrics
2. Review agent execution times in logs
3. Identify bottlenecks in multi-agent workflows
4. Consider parallelizing independent agent tasks

---

## 📞 Contact & Maintenance

**Architecture Owner**: PM Agent
**Last Updated**: 2026-01-11
**Version**: 2.0 (Agent System Overhaul)

For questions about agent architecture or to propose new agents, document in:
- `QA_CASE_STUDIES.md` for operational issues
- GitHub Issues for feature requests
- This file (`AGENT_ARCHITECTURE.md`) for architectural changes
