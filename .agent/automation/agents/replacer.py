import os

class ReplacerAgent:
    def run(self, old_term, new_term, root_path):
        print(f"Starting replacement: '{old_term}' -> '{new_term}' in {root_path}")
        count = 0
        extensions = ('.md', '.tsx', '.ts', '.py', '.json', '.html', '.css', '.sql')
        
        for root, dirs, files in os.walk(root_path):
            # Exclude common ignore directories
            dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', '.next', '__pycache__', 'venv', 'env']]
            
            for file in files:
                if file.endswith(extensions):
                    file_path = os.path.join(root, file)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                        
                        if old_term in content:
                            new_content = content.replace(old_term, new_term)
                            with open(file_path, 'w', encoding='utf-8') as f:
                                f.write(new_content)
                            print(f"Updated: {file_path}")
                            count += 1
                    except UnicodeDecodeError:
                        print(f"Skipping binary or non-utf8 file: {file_path}")
                    except Exception as e:
                        print(f"Error processing {file_path}: {e}")
        print(f"Replacement complete. Updated {count} files.")
