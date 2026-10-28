import os

class BaseAgent:
    def __init__(self, name, root_path):
        self.name = name
        self.root_path = root_path

    def log(self, message):
        print(f"[{self.name}] {message}")

    def check_file_exists(self, relative_path):
        full_path = os.path.join(self.root_path, relative_path)
        exists = os.path.exists(full_path)
        if not exists:
            self.log(f"WARNING: Required file missing -> {relative_path}")
        return exists
