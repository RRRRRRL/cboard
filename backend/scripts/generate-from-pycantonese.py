#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate Jyutping dictionary from pycantonese library
This uses pycantonese's built-in data which is open source

Usage:
    python backend/scripts/generate-from-pycantonese.py [output_csv]
"""

import sys
import csv
from pathlib import Path

try:
    import pycantonese as pc
except ImportError:
    print("ERROR: pycantonese is not installed.")
    print("Please install it: pip install pycantonese")
    sys.exit(1)

# Common Cantonese words to generate Jyutping for
COMMON_WORDS = [
    # Greetings
    '你', '好', '唔', '該', '唔該', '你好', '早晨', '晚安',
    # Pronouns
    '我', '佢', '你哋', '我哋', '佢哋',
    # Verbs
    '食', '飲', '去', '來', '聽', '睇', '玩', '做', '買', '賣', '想', '知', '話',
    # Nouns
    '人', '水', '飯', '麵', '茶', '食物',
    # Numbers
    '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
    # Body parts
    '手', '腳', '頭', '目', '鼻', '口', '耳', '髮', '身', '心',
    # Colors
    '紅', '藍', '黃', '綠', '白', '黑', '紫', '粉', '啡', '金',
    # Animals
    '狗', '貓', '牛', '馬', '魚', '豬', '羊', '雞',
    # Family
    '媽媽', '爸爸', '哥哥', '姐姐', '弟弟', '妹妹',
    # Common phrases
    '唔知', '唔使', '唔好', '好喇', '點解', '點',
    # School
    '學', '學校', '說', '談',
]

def main():
    if len(sys.argv) > 1:
        output_file = sys.argv[1]
    else:
        output_file = str(Path(__file__).parent.parent / 'database' / 'jyutping_pycantonese_input.csv')
    
    print("Generating Jyutping dictionary from pycantonese...")
    print(f"Output: {output_file}\n")
    
    rows = []
    
    for word in COMMON_WORDS:
        try:
            # Convert to Jyutping
            jyutping_list = pc.characters_to_jyutping(word)
            
            # Flatten the list
            jyutping_flat = []
            for item in jyutping_list:
                if isinstance(item, (list, tuple)):
                    jyutping_flat.extend(str(x) for x in item if x)
                elif item:
                    jyutping_flat.append(str(item))
            
            jyutping = ' '.join(jyutping_flat).strip()
            
            if not jyutping:
                continue
            
            # Skip if too long
            if len(jyutping) > 50:
                continue
            
            # Determine if single character or word
            if len(word) == 1:
                hanzi = word
                word_field = word
            else:
                hanzi = word[0]  # First character
                word_field = word
            
            rows.append({
                'jyutping_code': jyutping,
                'hanzi': hanzi,
                'word': word_field,
                'frequency': 200,
                'tags': 'daily'
            })
            
        except Exception as e:
            print(f"Warning: Failed to convert '{word}': {e}")
            continue
    
    # Write CSV
    output_dir = Path(output_file).parent
    output_dir.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['jyutping_code', 'hanzi', 'word', 'frequency', 'tags'])
        
        for row in rows:
            writer.writerow([
                row['jyutping_code'],
                row['hanzi'],
                row['word'],
                row['frequency'],
                row['tags']
            ])
    
    print(f"✓ Generated {len(rows)} entries")
    print(f"✓ Output file: {output_file}")
    print("\nNext step: Import the CSV file using:")
    print("  php backend/scripts/seed-jyutping-from-csv.php")

if __name__ == '__main__':
    main()

