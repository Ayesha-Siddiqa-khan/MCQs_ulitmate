import json

data = json.loads(open(r'F:\Mobile apps projects\MCQs_ulitmate\.tmp\parsed_mcqs.json', encoding='utf-8').read())
print(f"Total parsed: {len(data)}")
# Show first 3 of Chapter 1 and last 2 of Chapter 17
print("\n=== First 3 of Chapter 1 ===")
ch1 = [q for q in data if q['chapter'] == 1][:3]
for q in ch1:
    print(f"Ch{q['chapter']} Q{q['position']}  ans={q['correct_answer']}")
    print(f"  Q: {q['question_text'][:200]}")
    for o in q['options']:
        print(f"    {o['key']}. {o['text'][:120]}")
    print()

print("=== Last 2 of Chapter 17 ===")
ch17 = [q for q in data if q['chapter'] == 17][-2:]
for q in ch17:
    print(f"Ch{q['chapter']} Q{q['position']}  ans={q['correct_answer']}")
    print(f"  Q: {q['question_text'][:200]}")
    for o in q['options']:
        print(f"    {o['key']}. {o['text'][:120]}")
    print()

# Spot check: the screenshot's question ("displaying age") — should be Ch2 Q-something
print("=== Searching for 'displaying age' or 'cout' ===")
for q in data:
    if 'displaying' in q['question_text'].lower() or 'cout' in q['question_text'].lower():
        print(f"Ch{q['chapter']} Q{q['position']}  ans={q['correct_answer']}")
        print(f"  Q: {q['question_text'][:200]}")
        for o in q['options']:
            print(f"    {o['key']}. {o['text'][:120]}")
        print()
