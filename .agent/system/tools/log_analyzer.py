import sys
import os

class LogAnalyzer:
    def __init__(self, log_path):
        self.log_path = log_path

    def scan(self, lines_to_read=200):
        """Scans the last N lines for errors."""
        if not os.path.exists(self.log_path):
            return {"status": "MISSING_FILE", "errors": []}

        errors = []
        keywords = ["ERROR", "CRITICAL", "Exception", "Traceback", "Failed"]
        
        try:
            with open(self.log_path, 'r', encoding='utf-8', errors='ignore') as f:
                # Efficiently read last lines (simple approach for now)
                all_lines = f.readlines()
                target_lines = all_lines[-lines_to_read:] if len(all_lines) > lines_to_read else all_lines
                
                for i, line in enumerate(target_lines):
                    if any(k in line for k in keywords):
                        # Capture context (line number in snippet)
                        errors.append(f"Line {len(all_lines) - len(target_lines) + i + 1}: {line.strip()}")
        except Exception as e:
            return {"status": "READ_ERROR", "error": str(e)}

        return {
            "status": "issues_found" if errors else "clean",
            "file": self.log_path,
            "error_count": len(errors),
            "errors": errors
        }

if __name__ == "__main__":
    # CLI usage: python log_analyzer.py path/to/file.log
    if len(sys.argv) < 2:
        print("Usage: python log_analyzer.py <logfile>")
        sys.exit(1)
        
    analyzer = LogAnalyzer(sys.argv[1])
    result = analyzer.scan()
    print(result)
