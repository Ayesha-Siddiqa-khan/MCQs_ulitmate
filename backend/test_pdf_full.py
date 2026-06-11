"""Full reproduction test of generate_quiz_report with mock data."""
import sys
sys.path.insert(0, ".")

from app.services.pdf.report_generator import generate_quiz_report

# Simulate a result dict exactly as it would come from model_dump()
# But with potential string values from Supabase
result_dict = {
    "attempt_id": "test-123",
    "question_set_id": "qs-456",
    "score": 2,
    "total_questions": 5,
    "correct": 2,
    "incorrect": 3,
    "unanswered": 0,
    "percentage": 40.0,
    "time_spent_seconds": 120,
    "submitted_at": "2025-01-15T10:30:00Z",
    "mode": "practice",
    "questions": [
        {
            "question": {
                "id": "q1",
                "question_set_id": "qs-456",
                "position": 1,
                "question_text": "What is 2+2?",
                "options": [{"key": "A", "text": "3"}, {"key": "B", "text": "4"}, {"key": "C", "text": "5"}],
                "correct_answer": "B",
                "explanation": "Basic math",
                "subject": "Math",
                "chapter": "Arithmetic",
                "topic": "Addition",
                "difficulty": "easy",
                "source_type": "ai_generated",
            },
            "selected_answer": "A",
            "is_correct": False,
            "is_marked": False,
            "time_spent_seconds": 30,
        },
    ],
    "topic_breakdown": [],
    "difficulty_breakdown": [],
}

question_set = {"id": "qs-456", "title": "Math Quiz", "material_id": "mat-789"}
material = {"id": "mat-789", "title": "Math Notes"}

print("Test 1: Normal data")
try:
    pdf_bytes = generate_quiz_report(result_dict, question_set, material, "test@example.com")
    print(f"  OK - {len(pdf_bytes)} bytes")
except Exception as e:
    print(f"  FAILED: {type(e).__name__}: {e}")

# Now test with string values (simulating Supabase returning strings)
print("\nTest 2: String numeric values")
result_str = result_dict.copy()
result_str["total_questions"] = "5"
result_str["correct"] = "2"
result_str["incorrect"] = "3"
result_str["unanswered"] = "0"
result_str["percentage"] = "40.0"
result_str["time_spent_seconds"] = "120"
try:
    pdf_bytes = generate_quiz_report(result_str, question_set, material, "test@example.com")
    print(f"  OK - {len(pdf_bytes)} bytes")
except Exception as e:
    print(f"  FAILED: {type(e).__name__}: {e}")

# Test with None values
print("\nTest 3: None numeric values")
result_none = result_dict.copy()
result_none["total_questions"] = None
result_none["correct"] = None
result_none["incorrect"] = None
result_none["unanswered"] = None
result_none["percentage"] = None
result_none["time_spent_seconds"] = None
try:
    pdf_bytes = generate_quiz_report(result_none, question_set, material, "test@example.com")
    print(f"  OK - {len(pdf_bytes)} bytes")
except Exception as e:
    print(f"  FAILED: {type(e).__name__}: {e}")

# Test with string time_spent in questions
print("\nTest 4: String time_spent_seconds in questions")
result_qstr = result_dict.copy()
result_qstr["questions"] = [
    {
        "question": {
            "id": "q1",
            "question_set_id": "qs-456",
            "position": "1",  # string position
            "question_text": "What is 2+2?",
            "options": [{"key": "A", "text": "3"}, {"key": "B", "text": "4"}],
            "correct_answer": "B",
            "explanation": None,
            "subject": None,
            "chapter": None,
            "topic": None,
            "difficulty": None,
            "source_type": "ai_generated",
        },
        "selected_answer": None,
        "is_correct": None,
        "is_marked": False,
        "time_spent_seconds": "30",
    },
]
try:
    pdf_bytes = generate_quiz_report(result_qstr, question_set, material, "test@example.com")
    print(f"  OK - {len(pdf_bytes)} bytes")
except Exception as e:
    print(f"  FAILED: {type(e).__name__}: {e}")

# Test with empty/missing data
print("\nTest 5: Minimal data (empty questions)")
result_min = {
    "attempt_id": "test",
    "question_set_id": "qs",
    "score": 0,
    "total_questions": 0,
    "correct": 0,
    "incorrect": 0,
    "unanswered": 0,
    "percentage": 0.0,
    "time_spent_seconds": 0,
    "submitted_at": None,
    "mode": "practice",
    "questions": [],
    "topic_breakdown": [],
    "difficulty_breakdown": [],
}
try:
    pdf_bytes = generate_quiz_report(result_min, None, None, None)
    print(f"  OK - {len(pdf_bytes)} bytes")
except Exception as e:
    print(f"  FAILED: {type(e).__name__}: {e}")

print("\nAll tests complete.")
