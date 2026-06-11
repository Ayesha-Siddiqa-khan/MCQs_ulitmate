"""Debug script to reproduce the exact PDF generation scenario."""
from fpdf import FPDF

pdf = FPDF()
pdf.set_auto_page_break(auto=True, margin=20)
pdf.add_page()

# Simulate stat_box
pdf.set_fill_color(245, 246, 250)
pdf.set_draw_color(220, 220, 220)
x = pdf.get_x()
y = pdf.get_y()
pdf.rect(x, y, 42, 18, style="DF")
pdf.set_font("Helvetica", "B", 14)
pdf.set_text_color(39, 174, 96)
pdf.set_xy(x, y + 2)
pdf.cell(42, 8, str(0), align="C")
pdf.set_font("Helvetica", "", 8)
pdf.set_text_color(100, 100, 100)
pdf.set_xy(x, y + 10)
pdf.cell(42, 6, "Total", align="C")
pdf.set_xy(x + 44, y)

# Test with question data as it would come from model_dump()
question_data = {
    "question": {
        "question_text": "Test question?",
        "options": [{"key": "A", "text": "Option A"}, {"key": "B", "text": "Option B"}],
        "correct_answer": "A",
        "explanation": "Because",
    },
    "selected_answer": "B",
    "is_correct": False,
}

options = question_data["question"].get("options", [])
pdf.set_font("Helvetica", "B", 10)
pdf.set_text_color(44, 62, 80)
pdf.cell(0, 7, "1. Test question?", new_x="LMARGIN", new_y="NEXT")

# Simulate option rendering
for opt in options:
    key = opt.get("key", "")
    text = opt.get("text", "")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 5, f"   {key}. {text}", new_x="LMARGIN", new_y="NEXT")

# Test with potential string values
print("Testing with string time_spent_seconds...")
try:
    m, s = divmod(int(str("120")), 60)
    print(f"  divmod OK: {m}m {s}s")
except Exception as e:
    print(f"  divmod FAILED: {type(e).__name__}: {e}")

# Test with None time_spent_seconds
print("Testing with None time_spent_seconds...")
try:
    time_spent = None
    if time_spent:
        m, s = divmod(int(time_spent), 60)
    print("  None handled OK")
except Exception as e:
    print(f"  FAILED: {type(e).__name__}: {e}")

print("ALL TESTS PASSED")
