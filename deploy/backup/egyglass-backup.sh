#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  EgyGlass ERP — النسخة الاحتياطية اليومية إلى S3
#  التركيب: /usr/local/bin/egyglass-backup.sh   (chmod 750 · مالكها root)
#  الإعداد: /etc/egyglass/backup.env
# ═══════════════════════════════════════════════════════════════════════════════
#
# 🔴 هذه النسخة **شرط** قرار «PostgreSQL في حاوية لا RDS». بلا RDS لا لقطات
#    تلقائية ولا استرجاع لحظي — فقدان القرص = فقدان كل شيء. لا تُؤجَّل.
#
# 🔴 تنسخ **الاثنين معًا**: القاعدة و`uploads`. نسخة بلا مرفقات تُنتج قاعدة تشير
#    إلى ملفات غير موجودة — أسوأ من غياب النسخة، لأنها تبدو كاملة.
#
# 🔴 وتتحقّق **قبل الرفع**: `pg_restore -l` يقرأ فهرس الأرشيف. ملف مقطوع يخرج
#    بحجم معقول ولا يفشل إلا يوم الاسترجاع — بعد فوات الأوان.
#
# الصلاحية: **IAM Role على النسخة**. صفر مفاتيح في أي ملف (L-09).
# الحذف: **قاعدة دورة حياة على S3**، لا `aws s3 rm` هنا — وسياسة الدور تمنع
#        `s3:DeleteObject` عمدًا، فنسخة مخترقة لا تستطيع محو تاريخها.
#
# رمز الخروج 0 = نجاح مُتحقَّق منه. أي شيء آخر = فشل، ويُكتب في ملف الحالة.

set -Eeuo pipefail

CONFIG_FILE="/etc/egyglass/backup.env"
[ -r "$CONFIG_FILE" ] || { echo "FATAL: $CONFIG_FILE غير موجود أو غير مقروء" >&2; exit 78; }
# shellcheck source=/dev/null
source "$CONFIG_FILE"

: "${S3_BUCKET:?S3_BUCKET مفقود في backup.env}"
: "${COMPOSE_DIR:?COMPOSE_DIR مفقود في backup.env}"
: "${DATA_DIR:=/mnt/egyglass-data}"
: "${STAGING_DIR:=/var/backups/egyglass}"
: "${LOCAL_KEEP_DAYS:=3}"
: "${AWS_REGION:=me-south-1}"

# cron يعمل بـPATH ضيّق — التثبيت هنا يمنع "docker: command not found" الصامت.
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin"

STAMP="$(date +%Y%m%d-%H%M)"
PREFIX="$(date +%Y/%m)"
DB_FILE="$STAGING_DIR/db-$STAMP.dump"
UP_FILE="$STAGING_DIR/uploads-$STAMP.tar.gz"
STATUS_FILE="/var/lib/egyglass/last-backup"

mkdir -p "$STAGING_DIR" "$(dirname "$STATUS_FILE")"

log()  { echo "[$(date '+%F %T %Z')] $*"; }
fail() {
  # إبطال المصيدة أولًا: لو أخفقت كتابة ملف الحالة أدناه لأعادت استدعاء fail
  # فتنشأ حلقة لا نهائية تخفي الخطأ الأصلي.
  trap - ERR
  log "❌ فشل: $*"
  printf 'FAIL %s | %s\n' "$(date -Is)" "$*" > "$STATUS_FILE" || true
  exit 1
}
trap 'fail "توقّف غير متوقَّع عند السطر $LINENO"' ERR

compose() {
  docker compose \
    --project-directory "$COMPOSE_DIR" \
    -f "$COMPOSE_DIR/docker-compose.prod.yml" \
    --env-file /etc/egyglass/env "$@"
}

# ── 1) قاعدة البيانات ─────────────────────────────────────────────────────────
log "▶ تفريغ قاعدة البيانات والتحقّق منه داخل الحاوية"
# 🔴 التفريغ **إلى ملف داخل الحاوية** ثم النسخ للخارج — لا أنبوب إلى stdout.
#    السبب: `pg_restore -l` على أرشيف قادم من stdin يعتمد على قابلية الإزاحة
#    (seek) ويتفاوت سلوكه. على ملف حقيقي لا يوجد أي التباس، والتحقّق يصير قاطعًا.
# -T إلزامي: cron بلا TTY وبدونه يفشل exec. -Fc أرشيف مضغوط يقبل الاسترجاع الانتقائي.
OBJ_COUNT="$(compose exec -T db sh -c '
    set -e
    pg_dump -U egyglass -d egyglass -Fc -f /tmp/egyglass-backup.dump
    pg_restore -l /tmp/egyglass-backup.dump | grep -c "^[0-9]"
  ' | tr -d "\r")" || fail "فشل التفريغ أو رفض pg_restore الأرشيف — الملف تالف"

[ "${OBJ_COUNT:-0}" -ge 50 ] || fail "الفهرس يحوي ${OBJ_COUNT:-0} كائنًا فقط — الأرشيف مشبوه"

compose cp db:/tmp/egyglass-backup.dump "$DB_FILE" || fail "تعذّر نسخ الأرشيف خارج الحاوية"
compose exec -T db rm -f /tmp/egyglass-backup.dump

DB_BYTES="$(stat -c%s "$DB_FILE")"
[ "$DB_BYTES" -ge 100000 ] || fail "ملف القاعدة صغير بشكل مريب ($DB_BYTES بايت)"
log "  ✅ القاعدة: $DB_BYTES بايت · $OBJ_COUNT كائنًا في الفهرس"

# ── 2) الملفات المرفوعة ───────────────────────────────────────────────────────
log "▶ أرشفة المرفقات"
tar -czf "$UP_FILE" -C "$DATA_DIR" uploads
LISTING="$(tar -tzf "$UP_FILE")" || fail "أرشيف المرفقات لا يُقرأ"
UP_BYTES="$(stat -c%s "$UP_FILE")"
UP_COUNT="$(printf '%s\n' "$LISTING" | grep -vc '/$' || true)"
log "  ✅ المرفقات: $UP_BYTES بايت · $UP_COUNT ملفًا"

# ── 3) الرفع + التحقّق من الوصول ──────────────────────────────────────────────
# صفر مفاتيح: aws CLI يلتقط الاعتماد من IAM Role الملتصق بالنسخة.
for f in "$DB_FILE" "$UP_FILE"; do
  KEY="$PREFIX/$(basename "$f")"
  log "▶ رفع s3://$S3_BUCKET/$KEY"
  aws s3 cp "$f" "s3://$S3_BUCKET/$KEY" --region "$AWS_REGION" --only-show-errors
  # 🔴 تحقّق بعد الرفع لا افتراض: head-object يفشل إن لم يصل الكائن فعلًا.
  REMOTE_BYTES="$(aws s3api head-object --bucket "$S3_BUCKET" --key "$KEY" \
    --region "$AWS_REGION" --query 'ContentLength' --output text)" \
    || fail "الكائن $KEY غير موجود على S3 بعد الرفع"
  [ "$REMOTE_BYTES" = "$(stat -c%s "$f")" ] \
    || fail "حجم $KEY على S3 ($REMOTE_BYTES) لا يطابق المحلي"
  log "  ✅ وصل ومطابق: $REMOTE_BYTES بايت"
done

# ── 4) تنظيف محلي (S3 يُنظَّف بقاعدة دورة الحياة لا من هنا) ──────────────────
find "$STAGING_DIR" -type f -name '*.dump'   -mtime "+$LOCAL_KEEP_DAYS" -delete
find "$STAGING_DIR" -type f -name '*.tar.gz' -mtime "+$LOCAL_KEEP_DAYS" -delete

printf 'OK %s | db=%s bytes, %s objects | uploads=%s bytes, %s files\n' \
  "$(date -Is)" "$DB_BYTES" "$OBJ_COUNT" "$UP_BYTES" "$UP_COUNT" > "$STATUS_FILE"
log "✅ اكتملت النسخة — s3://$S3_BUCKET/$PREFIX/db-$STAMP.dump"
