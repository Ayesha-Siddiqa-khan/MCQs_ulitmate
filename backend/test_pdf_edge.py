"""Test what Supabase client returns for various column types."""
import json
from app.services.pdf.report_generator import generate_quiz_report

# The actual question data structure after model_dump()
# Let's test with edge cases that Supabase might produce

# Case: options_json is a string instead of list
result = {
    "attempt_id": "test",
    "question_set_id": "qs",
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
                "question_set_id": "qs",
                "position": "1",  # string from DB
                "question_text": "What is 2+2?",
                "options": "A. 3|B. 4|C. 5",  # string instead of list
                "correct_answer": "B",
                "explanation": None,
                "subject": None,
                "chapter": None,
                "topic": None,
                "difficulty": None,
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

print("Test: options as string")
try:
    pdf_bytes = generate_quiz_report(result, None, None, "test@example.com")
    print(f"  OK - {len(pdf_bytes)} bytes")
except Exception as e:
    print(f"  FAILED: {type(e).__name__}: {e}")

# Case: position is a string like "1"
result2 = {
    "attempt_id": "test",
    "question_set_id": "qs",
    "score": 0,
    "total_questions": 1,
    "correct": 0,
    "incorrect": 0,
    "unanswered": 1,
    "percentage": 0.0,
    "time_spent_seconds": 0,
    "submitted_at": "2025-01-15T10:30:00Z",
    "mode": "practice",
    "questions": [
        {
            "question": {
                "id": "q1",
                "question_set_id": "qs",
                "position": "1",
                "question_text": "Test?",
                "options": [{"key": "A", "text": "Yes"}, {"key": "B", "text": "No"}],
                "correct_answer": None,
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
            "time_spent_seconds": 0,
        },
    ],
    "topic_breakdown": [],
    "difficulty_breakdown": [],
}

print("\nTest: position as string")
try:
    pdf_bytes = generate_quiz_report(result2, None, None, "test@example.com")
    print(f"  OK - {len(pdf_bytes)} bytes")
except Exception as e:
    print(f"  FAILED: {type(e).__name__}: {e}")

# Case: options_json is a JSON string (not parsed by Supabase)
result3 = dict(result)
result3["questions"] = [
    {
        "question": {
            "id": "q1",
            "question_set_id": "qs",
            "position": 1,
            "question_text": "Test?",
            "options": '[{"key": "A", "text": "Yes"}]',  # JSON string not parsed
            "correct_answer": None,
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
        "time_spent_seconds": 0,
    },
]

print("\nTest: options as JSON string")
try:
    pdf_bytes = generate_quiz_report(result3, None, None, "test@example.com")
    print(f"  OK - {len(pdf_bytes)} bytes")
except Exception as e:
    print(f"  FAILED: {type(e).__name__}: {e}")

print("\nDone.")
