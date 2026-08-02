import os
import re
import json

FRONTEND_DIR = r"c:\Users\Jeyadev\Documents\ASPCV CRM\aspcv-crm\frontend\src"

issues = {
    "missing_alt": [],
    "inline_styles": [],
    "console_logs": [],
    "hardcoded_colors": [],
    "missing_type_button": [],
    "potential_non_responsive": []
}

def analyze_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.split('\n')
        
    rel_path = os.path.relpath(filepath, FRONTEND_DIR)
    
    # 1. Missing alt in img
    for i, line in enumerate(lines):
        if '<img' in line and 'alt=' not in line and 'alt {' not in line:
            issues["missing_alt"].append(f"{rel_path}:{i+1}")
            
        if 'style={{' in line:
            issues["inline_styles"].append(f"{rel_path}:{i+1}")
            
        if 'console.log(' in line:
            issues["console_logs"].append(f"{rel_path}:{i+1}")
            
        if re.search(r'#(?:[0-9a-fA-F]{3}){1,2}\b', line) or 'rgb(' in line:
            # Check if it's in a tailwind class or inline style
            issues["hardcoded_colors"].append(f"{rel_path}:{i+1}")
            
        if '<button' in line and 'type=' not in line:
            issues["missing_type_button"].append(f"{rel_path}:{i+1}")
            
    # basic check for responsive tailwind classes if it's a page component
    if 'pages' in rel_path and ('md:' not in content and 'lg:' not in content and 'sm:' not in content):
        if 'className=' in content:
            issues["potential_non_responsive"].append(rel_path)

for root, _, files in os.walk(FRONTEND_DIR):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.jsx'):
            analyze_file(os.path.join(root, file))

with open(r"c:\Users\Jeyadev\Documents\ASPCV CRM\aspcv-crm\frontend\ui_audit.json", "w") as f:
    json.dump(issues, f, indent=2)

print("Audit complete.")
