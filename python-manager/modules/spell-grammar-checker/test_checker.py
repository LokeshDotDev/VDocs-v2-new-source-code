"""
Test script for spell and grammar checker
"""

import sys
sys.path.insert(0, 'python-manager/modules/spell-grammar-checker')
import spell_grammar_checker

# Test spell checking
print("=== SPELL CHECKING TESTS ===\n")

test_texts = [
    "This is a tset of the speling checker.",
    "The progarm is workng correclty.",
    "I recieved the documnt yestarday.",
    "They have sucessfully completed there work."
]

for text in test_texts:
    fixed = spell_grammar_checker.fix_spelling(text)
    print(f"Original: {text}")
    print(f"Fixed:    {fixed}")
    print()

# Test grammar checking
print("\n=== GRAMMAR CHECKING TESTS ===\n")

grammar_tests = [
    "She don't like pizza.",
    "The book are on the table.",
    "Him went to the store.",
    "I has a question."
]

for text in grammar_tests:
    fixed = spell_grammar_checker.fix_grammar(text)
    print(f"Original: {text}")
    print(f"Fixed:    {fixed}")
    print()

print("\n✅ Spell and grammar checker is working!")
