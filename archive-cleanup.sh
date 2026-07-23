#!/usr/bin/env bash
# egyglass-erp context cleanup
# شغّله من جوه فولدر المشروع بتاعك (يوسف) — بيعمل git mv مش حذف نهائي.
# بعد ما تتأكد إن كل حاجة تمام، اعمل commit وادفع.

set -euo pipefail

if [ ! -f "BACKLOG.md" ]; then
  echo "شغّل السكريبت ده من جوه فولدر المشروع (Egyglass-ERP) - BACKLOG.md مش موجود هنا."
  exit 1
fi

mkdir -p archive
mkdir -p docs/reference

echo "== نقل الملفات القديمة/الملغاة لـ archive/ =="
for f in START-HERE.md EXECUTION-LOG.md MULTI-AGENT.md NON-COLLISION-PROTOCOL.md \
         PROMPT-STREAM-A.md PROMPT-STREAM-C.md SCHEMA-CHANGE-REQUESTS.md; do
  if [ -f "$f" ]; then
    git mv "$f" "archive/$f"
    echo "  moved: $f -> archive/$f"
  else
    echo "  skip (not found): $f"
  fi
done

echo
echo "== نقل بيانات الأسعار/المنتجات لـ docs/reference/ (مش تعليمات وكيل) =="
for f in Price.md Showers_Software_11-8.md; do
  if [ -f "$f" ]; then
    git mv "$f" "docs/reference/$f"
    echo "  moved: $f -> docs/reference/$f"
  else
    echo "  skip (not found): $f"
  fi
done

echo
echo "== جولة 2: مسودات SCR يتيمة (صفر ذكر في BACKLOG.md) =="
mkdir -p archive/change-requests
for f in change-requests/tec-scr.md change-requests/SCR-013-draft.md change-requests/SCR-014-draft.md; do
  if [ -f "$f" ]; then
    base=$(basename "$f")
    git mv "$f" "archive/change-requests/$base"
    echo "  moved: $f -> archive/change-requests/$base"
  else
    echo "  skip (not found): $f"
  fi
done
echo "  ملحوظة: change-requests/SCR-015-statements-invoices-approved.md اتسابت في مكانها — لسه نشطة (BL-26)."

echo
echo "== جولة 3: docs/*.md — أرشفة تقارير/مسودات تاريخية =="
for f in docs/BUILD-ROADMAP.md docs/MVP-SPEC.md docs/AGENT-LESSONS-AR.md \
         docs/COVERAGE-AUDIT-B1.md docs/COVERAGE-AUDIT-B2.md docs/UX-JOURNEY-AUDIT.md; do
  if [ -f "$f" ]; then
    base=$(basename "$f")
    git mv "$f" "archive/$base"
    echo "  moved: $f -> archive/$base"
  else
    echo "  skip (not found): $f"
  fi
done

echo
echo "== جولة 3: نقل ملف السياق/الخلفية لـ docs/reference/ =="
if [ -f "docs/Project_Scope_EgyGlass.md" ]; then
  git mv "docs/Project_Scope_EgyGlass.md" "docs/reference/Project_Scope_EgyGlass.md"
  echo "  moved: docs/Project_Scope_EgyGlass.md -> docs/reference/Project_Scope_EgyGlass.md"
else
  echo "  skip (not found): docs/Project_Scope_EgyGlass.md"
fi
echo "  ملحوظة: docs/LESSONS-AR.md و docs/SECURITY-PLAN-AR.md و docs/quotation-math.md اتسابوا زي ما هما — نشطين."

echo
echo "== تم. راجع 'git status' قبل الـ commit. =="
echo "خطوة إضافية موصى بيها: ضيف في AGENTS.md السطر التالي لو مش موجود:"
echo '  "لا تقرأ أي ملف داخل archive/ إلا إذا طُلب صراحة."'
