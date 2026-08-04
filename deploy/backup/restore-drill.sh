#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  EgyGlass ERP — تدريب الاسترجاع (م-10 · الفحص الثامن)
#  الاستعمال:  sudo /usr/local/bin/egyglass-restore-drill.sh 2026/08/db-20260805-0230.dump
# ═══════════════════════════════════════════════════════════════════════════════
#
# 🔴 **نسخة لم تُجرَّب ليست نسخة.** هذا السكربت هو ما يحوّل ملفًّا على S3 إلى
#    ضمانة. يُشغَّل مرة في م-10، ومرة كل شهر بعدها.
#
# ⚠️ **لا يمسّ قاعدة الإنتاج إطلاقًا.** ينشئ قاعدة منفصلة `egyglass_drill`،
#    يسترجع فيها، يعدّ الصفوف، ثم **يحذف القاعدة التجريبية وحدها**.
#    القاعدة العاملة `egyglass` لا تُقرأ ولا تُكتب في أي سطر أدناه.

set -Eeuo pipefail

CONFIG_FILE="/etc/egyglass/backup.env"
[ -r "$CONFIG_FILE" ] || { echo "FATAL: $CONFIG_FILE غير مقروء" >&2; exit 78; }
# shellcheck source=/dev/null
source "$CONFIG_FILE"

: "${S3_BUCKET:?}"; : "${COMPOSE_DIR:?}"; : "${AWS_REGION:=me-south-1}"
KEY="${1:?مرّر مفتاح الكائن على S3، مثال: 2026/08/db-20260805-0230.dump}"

DRILL_DB="egyglass_drill"
TMP="/var/backups/egyglass/drill-$(date +%s).dump"

compose() {
  docker compose --project-directory "$COMPOSE_DIR" \
    -f "$COMPOSE_DIR/docker-compose.prod.yml" --env-file /etc/egyglass/env "$@"
}
log() { echo "[$(date '+%F %T %Z')] $*"; }

log "▶ تنزيل s3://$S3_BUCKET/$KEY"
aws s3 cp "s3://$S3_BUCKET/$KEY" "$TMP" --region "$AWS_REGION"

log "▶ إنشاء قاعدة التدريب (منفصلة تمامًا عن egyglass)"
compose exec -T db psql -U egyglass -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS $DRILL_DB;"
compose exec -T db psql -U egyglass -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE $DRILL_DB OWNER egyglass;"

log "▶ الاسترجاع"
# الملف يُنقل إلى الحاوية أولًا لا يُمرَّر عبر stdin — نفس سبب سكربت النسخ:
# pg_restore على ملف حقيقي سلوكه قاطع، وعلى أنبوب يتفاوت.
compose cp "$TMP" db:/tmp/drill.dump
# --exit-on-error إلزامي: بدونه يتخطّى pg_restore الأخطاء ويكمل، فتحصل على
# قاعدة ناقصة تبدو ناجحة — نفس فخّ psql بلا ON_ERROR_STOP.
compose exec -T db pg_restore -U egyglass -d "$DRILL_DB" --exit-on-error /tmp/drill.dump
compose exec -T db rm -f /tmp/drill.dump

log "▶ عدّ الصفوف في القاعدة المسترجَعة"
compose exec -T db psql -U egyglass -d "$DRILL_DB" -c "
SELECT 'الهجرات المطبَّقة' k, count(*)::text v FROM _prisma_migrations WHERE finished_at IS NOT NULL
UNION ALL SELECT 'المستخدمون',   count(*)::text FROM \"User\"
UNION ALL SELECT 'العملاء',      count(*)::text FROM \"Customer\"
UNION ALL SELECT 'عروض الأسعار', count(*)::text FROM \"Quotation\"
UNION ALL SELECT 'الخامات',      count(*)::text FROM \"Material\"
UNION ALL SELECT 'أنواع المنتجات',count(*)::text FROM \"ProductType\"
UNION ALL SELECT 'الوصفات',      count(*)::text FROM \"ProductRecipe\"
UNION ALL SELECT 'المستندات',    count(*)::text FROM documents
UNION ALL SELECT 'سجل الأحداث',  count(*)::text FROM \"ActivityLog\";"

log "▶ حذف قاعدة التدريب وحدها"
compose exec -T db psql -U egyglass -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE $DRILL_DB;"
rm -f "$TMP"

log "✅ نجح تدريب الاسترجاع. قارن الأعداد أعلاه بالإنتاج — تطابقها هو الدليل."
