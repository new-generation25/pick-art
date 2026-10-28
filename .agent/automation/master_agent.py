import argparse
import sys
import os

# Ensure the script can locate the 'agents' package
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from agents.pm_agent import PMAgent

def main():
    parser = argparse.ArgumentParser(description="Pick Art Automation System")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Status
    subparsers.add_parser("status", help="Show project health status")

    # Collection
    subparsers.add_parser("collect", help="Run KOPIS collection")

    # Frontend
    subparsers.add_parser("frontend-check", help="Run frontend type checks")

    # Rename
    rename_parser = subparsers.add_parser("rename", help="Rename project terms")
    rename_parser.add_argument("--old", required=True, help="Old term to find")
    rename_parser.add_argument("--new", required=True, help="New term to replace with")

    args = parser.parse_args()
    
    # Determine project root (parent of .agent)
    project_root = os.path.abspath(os.path.join(current_dir, "..", ".."))
    
    pm = PMAgent(project_root)

    if args.command == "status":
        pm.report_status()
    elif args.command == "collect":
        pm.trigger_collection()
    elif args.command == "frontend-check":
        pm.check_frontend()
    elif args.command == "rename":
        pm.rename_project(args.old, args.new)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
