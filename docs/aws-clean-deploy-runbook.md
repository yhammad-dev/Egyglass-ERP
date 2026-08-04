# كتيّب النشر النظيف على AWS — بيئة جديدة من الصفر

> **الحالة: تجهيز. صفر تنفيذ على AWS · صفر بيانات اعتماد طُلبت أو قُبلت.**
> الوكيل كتب وأثبت · **يوسف ينفّذ ويراجع** (`L-02` · `L-03`).
> **الأساس:** `master` عند `21e35e9` · الشجرة نظيفة من ملفات الكود ✅ (مُتحقَّق — الوحيد
> غير المتعقَّب: `docs/` و`notes.docx`).
> **آخر تحديث:** 2026-08-04

**يكمّل ولا يكرّر:** [`docs/fresh-db-runbook.md`](fresh-db-runbook.md) — قرارات القاعدة
والبيانات المرجعية والمستخدمين محسومة هناك (§١-ب · §٢ · §٦). هذا الكتيّب يضيف
**البنية التحتية** ويستدعي ذاك عند م-5 · م-6 · م-7.

---

## ٠ · كيف تقرأ هذا الكتيّب في الثالثة صباحًا

| الرمز | معناه |
|---|---|
| 💻 | يُنفَّذ **على جهازك (ويندوز)** |
| ☁️ | يُنفَّذ **على جهازك** لكنه يخاطب AWS (يحتاج `aws` CLI مُهيّأً) |
| 🖥️ | يُنفَّذ **داخل الخادم** بعد `ssh` |
| ✅ | معيار النجاح — **لا تنتقل قبل تحقّقه** |
| 🔧 | ماذا تفعل إن أخفق |

**ثلاث قواعد لا تُخترق:**
1. **ممنوع كتم المخرجات** (`>/dev/null`) — الفشل الصامت أخطر من الظاهر. (وقعت 3 مرات.)
2. **لا تنتقل لمرحلة قبل ✅ سابقتها.** الترتيب ليس تفضيلًا.
3. **كل قيمة `<HKDA>` تُولَّد وقت النشر.** ممنوع أي قيمة كانت يومًا في المستودع.

**متغيّرات تُستعمل في كل مكان — املأها أولًا واحتفظ بها في نافذة واحدة:**

```bash
REGION=me-south-1
KEY=egyglass-uat-2026
BUCKET=<BUCKET_NAME>          # س-5 — يلزم قبل م-9 فقط
# التالية تُملأ **أثناء** م-1 و م-2، لا قبلهما:
MYIP= ; VPC= ; SG= ; AMI= ; IID= ; ALLOC= ; EIP= ; VOL= ; SHA=
```

> ⚠️ **نافذة طرفية واحدة من أول م-1 إلى آخر م-2.** إغلاقها يفقد المتغيّرات، ولا
> يوجد ما يذكّرك: الأوامر التالية ستعمل بقيم فارغة وتفشل برسائل لا تشير إلى السبب.
> لو أُغلقت: استرجع القيم بـ
> `aws ec2 describe-instances --region $REGION --filters Name=tag:Name,Values=egyglass-uat --query 'Reservations[].Instances[].[InstanceId,PublicIpAddress,SecurityGroups[0].GroupId]' --output table`

---

## 🔴 ١ · ما اكتشفه الاستطلاع في الكود — اقرأه قبل أي أمر

سبعة عيوب حقيقية، كلّها بدليل `file:line`. **أربعة منها كانت ستُسقط النشر.**

| # | الاكتشاف | الدليل | الأثر لو مرّ | الحالة |
|---|---|---|---|---|
| 1 | 🔴 **`Dockerfile` لم يُستعمل قطّ** — `docker-compose.prod.yml` كان يبني وقت الإقلاع (`npm ci && build && start`) فبقي الـDockerfile مكتوبًا وغير مُختبَر | `docker-compose.prod.yml:20` (قبل التعديل) | ترفع صورة لم تعمل مرة | ✅ أُعيدت كتابته · **يُختبَر محليًّا في م-4** |
| 2 | 🔴 **`next.config.ts` لم يكن يُنسخ لمرحلة التشغيل** | `Dockerfile:23-27` (قبل) | سقف الـServer Action يعود للافتراضي (~1MB) ⇒ **كل رفع رسمة > 1 ميجا ينكسر** برسالة مبهمة | ✅ أُضيف |
| 3 | 🔴 **`tzdata` غائبة عن `node:20-alpine`** ⇒ `TZ` تُتجاهَل **بصمت** | صورة الأساس | 20 مُنسِّق وقت غير مثبَّت (`BL-184`) يرسمون UTC على الخادم، و`document-number.ts:128` يشتقّ **شهر المستند** من `getMonth()` المحلي ⇒ مستند صادر 01 سبتمبر 01:00 بالقاهرة يحمل شهر **8** | ✅ `apk add tzdata` + `TZ` — **يحتاج موافقتك، س-2** |
| 4 | 🔴 **`.dockerignore` كان يستثني `.env` وحده** — و`.env.prod` موجود في الجذر | `.dockerignore:4` (قبل) | كلمة مرور الإنتاج تدخل سياق البناء | ✅ صار `.env*` باستثناء الأمثلة |
| 5 | 🔴 **`rateLimit` يفتح على مفتاح `"unknown"` بلا proxy** | `lib/rate-limit.ts:6` | بلا `X-Forwarded-For` **الشركة كلها في دلو واحد سعته 60/دقيقة**. الجرس يستقصي كل 30 ث (`notifications-bell.tsx:29`) ⇒ 15 مستخدمًا بتبويبين = 60/دقيقة، والجرس يتوقّف **بصمت** (`if (!res.ok) return;`) | ⚠️ nginx يفصل الدلاء على هذه البيئة — **تخفيف لا علاج.** مسجَّل `BL-206` ويبقى مفتوحًا: السطر في الكود كما هو، وأي بيئة بلا proxy تعود للعطل |
| 6 | 🔴 **نطاق البريد المفروض `@egyglass.net`** بينما جدول المستخدمين كلّه `@egyglass.com` | `src/lib/config.ts:5` · `users/actions.ts:92` | **الأربعة عشر حسابًا تُرفض كلها** بـ`errors.emailDomainNotAllowed` | ✅ **محسوم (يوسف، 2026-08-05):** `@egyglass.net` للأربعة عشر · الأدمن بالافتراضي ثم يُعدَّل. صفر كود. جدول م-7 محدَّث |
| 7 | ⚠️ **`npm run build` أخضر بالتصميم** — `typescript.ignoreBuildErrors: true` | `next.config.ts:4-6` | تستنتج سلامة الأنواع من بناء لا يفحصها | ✅ خطّ الأساس **مُقاس: 31 خطأ `tsc`** (انظر أدناه) |

### خطّ أساس الأنواع — مقيس لا مقدَّر

```
npx prisma generate  &&  npx tsc --noEmit   →   31 خطأ
```

⚠️ **قبل `prisma generate` كان العدد 575** — كلها انحراف عميل Prisma قديم على جهازك
(`warrantyTextProjects does not exist…`). **العدد الحقيقي 31**، ويطابق ما ذكرتَه.

**التصنيف:** كلها في `src/app/**` (مكوّنات عميل) + ملف واحد مولَّد من Next —
`string | undefined` · توقيع `Select` في Base-UI · خاصية `asChild`. **صفر منها في
مسار تشغيل الخادم.**
⇒ **ليست حاجز نشر.** سجّل 31 خطًّا للأساس، **وأجهض فقط إن زاد الرقم**.

---

## ٢ · المراحل العشر

### م-1 · النسخة · المفتاح · الشبكة

**١·١ مفتاح SSH جديد** (☁️)

```bash
aws ec2 create-key-pair --region $REGION --key-name $KEY \
  --query 'KeyMaterial' --output text > "$HOME/.ssh/$KEY.pem"
```

ثم **إغلاق صلاحياته على ويندوز** (💻 PowerShell) — هذا هو ما كان مفتوحًا في المفتاح القديم:

```powershell
icacls "$env:USERPROFILE\.ssh\egyglass-uat-2026.pem" /inheritance:r /grant:r "$($env:USERNAME):(R)"
```

✅ `icacls` يعرض المستخدم وحده بصلاحية `(R)` — بلا `BUILTIN\Users` وبلا `Everyone`.
🔧 لو ظهر `Authorities` آخر: أعد الأمر؛ `ssh` سيرفض المفتاح بـ`UNPROTECTED PRIVATE KEY FILE` وإلا.

**١·٢ مجموعة الأمان — 22 و443 فقط** (☁️)

**أولًا: اعرف عنوانك العام** (المدخل الوحيد الذي تحتاجه م-1 منك):

```bash
MYIP=$(curl -s https://checkip.amazonaws.com | tr -d '\n')
echo "MYIP=$MYIP"
```

⚠️ **مزوّد الإنترنت المصري قد يبدّله.** إن عجزت عن `ssh` يومًا فهذا أول ما تراجعه —
أمر التحديث في س-3.

```bash
VPC=$(aws ec2 describe-vpcs --region $REGION \
  --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
echo "VPC=$VPC"
```

🔧 **لو طبع `None`** فالحساب بلا VPC افتراضية (يحدث في حسابات أُنشئت حديثًا أو
نُظّفت). أنشئها بأمر واحد ثم أعد السطر أعلاه:
`aws ec2 create-default-vpc --region $REGION`

```bash
SG=$(aws ec2 create-security-group --region $REGION --group-name egyglass-uat \
  --description "EgyGlass UAT - ports 22 and 443 only" --vpc-id "$VPC" \
  --query 'GroupId' --output text)
echo "SG=$SG"

# 🔴 22 من عنوانك وحدك — لا 0.0.0.0/0 (س-3)
aws ec2 authorize-security-group-ingress --region $REGION --group-id "$SG" \
  --ip-permissions "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=$MYIP/32,Description=youssef}]"

aws ec2 authorize-security-group-ingress --region $REGION --group-id "$SG" \
  --ip-permissions 'IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0,Description=company-devices}]'
```

> ⚠️ **علامتا التنصيص مختلفتان عمدًا:** الأولى **مزدوجة** كي يُستبدل `$MYIP`،
> والثانية **مفردة** كي لا تُفسَّر الأقواس. عكسهما يُنتج قاعدة بعنوان حرفي `$MYIP`.

✅ `aws ec2 describe-security-groups --region $REGION --group-ids $SG --query 'SecurityGroups[0].IpPermissions'`
يُظهر **قاعدتين فقط**. **لا وجود لـ3100 — ولا يجب أن يوجد.**

#### 🔁 عند تبدّل عنوانك (بند تشغيلي دائم — س-3)

> ℹ️ **اقرأه الآن، ونفّذه لاحقًا.** لا علاقة له بإتمام م-1 — موضعه هنا كي تجده يوم
> ينقطع اتصالك، لا كي توقفك اليوم.

العرض: `ssh` يعلّق ثم ينتهي بـ`Connection timed out`، بينما `https://$EIP` يعمل عاديًّا.
هذا التمييز وحده يكفي للتشخيص: 443 مفتوح للجميع و22 مقيَّد بك.

```bash
OLDIP=$(aws ec2 describe-security-groups --region $REGION --group-ids "$SG" \
  --query "SecurityGroups[0].IpPermissions[?FromPort==\`22\`].IpRanges[0].CidrIp" --output text)
NEWIP=$(curl -s https://checkip.amazonaws.com | tr -d '\n')
echo "OLD=$OLDIP  NEW=$NEWIP/32"

aws ec2 authorize-security-group-ingress --region $REGION --group-id "$SG" \
  --ip-permissions "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=$NEWIP/32,Description=youssef}]"

# 🔴 والقديمة تُسحب — لا تُترك «احتياطًا»
aws ec2 revoke-security-group-ingress --region $REGION --group-id "$SG" \
  --ip-permissions "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=$OLDIP}]"
```

> 🔴 **السحب ليس ترتيبًا.** عنوانك من تجميعة ديناميكية لمزوّد مصري — العنوان الذي
> تركتَه سيُسنَد لمشترك آخر خلال أيام، وتبقى قاعدتك تمنحه **المنفذ 22**. وتراكم
> القواعد يجعل «مَن يصل إلى الخادم؟» سؤالًا بلا إجابة.
>
> ✅ التحقّق بعد التحديث: نفس أمر `describe-security-groups` أعلاه ⇒ **قاعدتان فقط**،
> وقاعدة الـ22 تحمل عنوانك الحالي وحده.

**١·٣ النسخة** (☁️)

```bash
AMI=$(aws ssm get-parameter --region $REGION \
  --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id \
  --query 'Parameter.Value' --output text)
echo "AMI=$AMI"

IID=$(aws ec2 run-instances --region $REGION --image-id "$AMI" \
  --instance-type t3.small --key-name $KEY --security-group-ids "$SG" \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3","DeleteOnTermination":true,"Encrypted":true}}]' \
  --metadata-options 'HttpTokens=required,HttpEndpoint=enabled' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=egyglass-uat}]' \
  --query 'Instances[0].InstanceId' --output text)
echo "IID=$IID"
```

> 🔴 **`HttpTokens=required` (IMDSv2 إجباري) ليس تزيينًا.** سنُلصق بهذه النسخة
> **دور IAM** له صلاحية الكتابة على S3 (م-9). مع IMDSv1 أي ثغرة SSRF في التطبيق
> تسحب بيانات اعتماد ذلك الدور بطلب HTTP واحد. IMDSv2 يقطع هذا المسار.

> ℹ️ **دور IAM يُلصق في م-9** لا هنا — كي تبقى كل مرحلة مكتفية بذاتها.

**١·٤ Elastic IP**

```bash
ALLOC=$(aws ec2 allocate-address --region $REGION --domain vpc --query 'AllocationId' --output text)
aws ec2 associate-address --region $REGION --instance-id "$IID" --allocation-id "$ALLOC"
EIP=$(aws ec2 describe-addresses --region $REGION --allocation-ids "$ALLOC" \
  --query 'Addresses[0].PublicIp' --output text)
echo "EIP=$EIP"
```

✅ `ssh -i "$HOME/.ssh/$KEY.pem" ubuntu@$EIP 'echo CONNECTED; free -m'`
**المتوقَّع:** `CONNECTED` + إجمالي ذاكرة ≈ **1966 ميجا** (لا 908 — هذا دليل أن `t3.small` فعلًا).
🔧 لو علّق الاتصال: مجموعة الأمان لا تسمح بعنوانك على 22 — أعد `curl -s https://checkip.amazonaws.com`
وقارنه بما في `describe-security-groups`. تبدّل عنوان مزوّد الإنترنت هو السبب الأول.

---

### م-2 · 🔴 قرص EBS للمرفقات — والتركيب الذي يجب أن يبقى

> **لماذا هذه أخطر مرحلة:** النظام يكتب في `/app/var/uploads`
> (`src/lib/storage/paths.ts:17-22`). على قرص مؤقت أو تركيب يدوي، **أول إعادة
> إنشاء/إقلاع تمحو كل الملفات** والقاعدة تبقى تشير إليها ⇒ رسومات ومستندات
> «موجودة» في النظام ومفقودة على القرص.

**٢·١ إنشاء القرص وإلحاقه** (☁️)

```bash
AZ=$(aws ec2 describe-instances --region $REGION --instance-ids "$IID" \
  --query 'Reservations[0].Instances[0].Placement.AvailabilityZone' --output text)

VOL=$(aws ec2 create-volume --region $REGION --availability-zone "$AZ" \
  --size 20 --volume-type gp3 --encrypted \
  --tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value=egyglass-data}]' \
  --query 'VolumeId' --output text)

aws ec2 wait volume-available --region $REGION --volume-ids "$VOL"
aws ec2 attach-volume --region $REGION --volume-id "$VOL" --instance-id "$IID" --device /dev/sdf
```

**٢·٢ التنسيق والتركيب** (🖥️)

> 🔴 **`/dev/sdf` كذبة.** `t3` نسخة Nitro ⇒ النظام يراه **`/dev/nvme1n1`**.
> ولا تعتمد على الاسم أصلًا — الترتيب يتبدّل بين الإقلاعات. **استخرجه بالرقم التسلسلي.**

```bash
lsblk -o NAME,SIZE,TYPE,MOUNTPOINT,SERIAL
# القرص الجديد = ذو الحجم 20G وبلا MOUNTPOINT. سلسلته تبدأ بـvol...
DEV=$(lsblk -o NAME,SERIAL -dn | awk -v v="$(echo <VOLUME_ID> | tr -d '-')" '$2==v {print "/dev/"$1}')
echo "DEV=$DEV"
```

```bash
sudo mkfs.ext4 -L egyglass-data "$DEV"
sudo mkdir -p /mnt/egyglass-data
UUID=$(sudo blkid -s UUID -o value "$DEV")
echo "UUID=$UUID  /mnt/egyglass-data  ext4  defaults,nofail  0  2" | sudo tee -a /etc/fstab
sudo systemctl daemon-reload
sudo mount -a
findmnt /mnt/egyglass-data
```

> 🔴 **`UUID=` لا اسم الجهاز** — الأسماء تتبدّل، الـUUID لا.
> 🔴 **`nofail` إلزامية.** بدونها: لو غاب القرص يومًا، النظام **لا يُقلع إلى حالة
> صالحة** ويسقط في وضع الطوارئ **بلا SSH** — أي تفقد الخادم بالكامل بسبب قرص بيانات.
> 🔴 **`daemon-reload` بعد تعديل `/etc/fstab`** — systemd يولّد وحدات التركيب من
> الملف، وبدونه قد يتصرّف `mount -a` بشكل يخالف ما سيحدث عند الإقلاع.

**٢·٣ المجلدان والملكية**

```bash
sudo mkdir -p /mnt/egyglass-data/pgdata /mnt/egyglass-data/uploads
# 🔴 uid 1000 = المستخدم node داخل صورة التطبيق (التي تعمل USER node).
#    التطبيق لا يملك صلاحية chown، فالمضيف يجب أن يهيّئها سلفًا وإلا فشل أول رفع بـEACCES.
sudo chown -R 1000:1000 /mnt/egyglass-data/uploads
sudo chmod 750 /mnt/egyglass-data/uploads
```

> ⚠️ **لا تلمس ملكية `pgdata`.** نقطة دخول صورة postgres تعمل بـroot أولًا وتنفّذ
> `chown -R postgres "$PGDATA"` بنفسها ثم تهبط للمستخدم. تدخّلك اليدوي هنا (خصوصًا
> بـ`999` المأخوذة من صورة Debian بينما `alpine` تستعمل **70**) يُنتج فشل إقلاع مربكًا.

✅ `findmnt /mnt/egyglass-data` يعرض التركيب · `stat -c '%u:%g %a' /mnt/egyglass-data/uploads` ⇒ `1000:1000 750`
🔴 **الاختبار الحقيقي مؤجَّل إلى م-10 الفحص 2** — بعد `reboot` كامل، لا الآن.

---

### م-3 · Docker · Compose · swap · المنطقة الزمنية · aws CLI (🖥️)

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg unzip apache2-utils
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

**swap 2 جيجا** — البناء لن يحدث هنا، لكن ذروة استعمال Postgres + Node على 2 جيجا تستحق شبكة أمان:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-egyglass.conf && sudo sysctl --system
```

**المنطقة الزمنية للمضيف** (تخصّ cron والسجلات — **لا تمسّ القاعدة**، فهي مثبَّتة UTC في compose):

```bash
sudo timedatectl set-timezone Africa/Cairo
```

**aws CLI v2:**

```bash
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp && sudo /tmp/aws/install
```

**٣·١ 🔴 مختصر `dc` والمتغيّرات — ثبّتها الآن أو ستكتبها مئة مرة**

> كل أمر لاحق في هذا الكتيّب يستعمل `dc`. **جلسة `ssh` جديدة تفقد أي تعريف مؤقّت**،
> وهذا بالضبط ما يوقعك في الثالثة صباحًا: تعود بعد `reboot` (الفحص 2) فلا يعمل شيء.

```bash
cat >> ~/.bashrc <<'EOF'

# ── EgyGlass ──
export REGION=me-south-1
export BUCKET=<BUCKET_NAME>
export EIP=<ELASTIC_IP>
dc() {
  docker compose --project-directory /opt/egyglass \
    -f /opt/egyglass/docker-compose.prod.yml \
    --env-file /etc/egyglass/env "$@"
}
EOF
source ~/.bashrc
```

✅ `exit` ثم `ssh` من جديد (لتفعيل مجموعة docker **ولاختبار بقاء `dc`**)، ثم:
```bash
docker version --format '{{.Server.Version}}' && docker compose version \
  && aws --version && date && type dc && echo "EIP=$EIP"
```
**المتوقَّع:** إصدار خادم Docker · إصدار compose v2 · `aws-cli/2.x` · تاريخ ينتهي
بـ`EEST` (صيفًا) · `dc is a function` · العنوان صحيح.
🔧 `dc: not found` بعد إعادة الدخول ⇒ الكتلة لم تُضَف — أعد الأمر وتحقّق بـ`tail -12 ~/.bashrc`.

---

### م-4 · 🔴 الصورة المبنية مسبقًا — والمقابل الذي طلبتَ عرضه

#### القرار: أي الطريقين؟

| | **(أ) بناء على جهازك ودفع الصورة** ← **الموصى به** | **(ب) بناء على الخادم مرة واحدة** | **(ج) سجلّ ECR خاص** |
|---|---|---|---|
| ذاكرة البناء | جهازك (وفير) | **2 جيجا + swap — مقامرة على OOM** | جهازك |
| زمن أول نشر | بناء ~5 د + رفع ~400 ميجا | بناء 15–30 د مع تبديل قرصي | بناء + رفع + إعداد سجلّ |
| بيانات اعتماد إضافية | **صفر** | مفتاح نشر للمستودع الخاص | دور IAM لـECR |
| النشر التالي | إعادة رفع ~400 ميجا | `git pull` + إعادة بناء (نفس المقامرة) | **طبقات فارقة فقط — الأسرع** |
| إثبات الجِدّة | **الوسم = الـSHA. حاسم.** | يعتمد على انضباط `git log` | الوسم = الـSHA |
| تعقيد إضافي | صفر | صفر | مورد رابع يُدار ويُحاسَب |

**التوصية: (أ) للنشر الأول.** يُخرج ذاكرة الخادم من المعادلة تمامًا، ويجعل الصورة
**غير قابلة للتبدّل**: ما اختبرتَه محليًّا هو حرفيًّا ما يعمل. وإن صارت النشرات
أسبوعية، انتقل إلى (ج) — عندها تستحق كلفتها (~$0.10/جيجا/شهر).

#### ٤·١ البناء (💻 Git Bash)

```bash
cd /e/Projects/EgyGlass_ERP_New_Build
SHA=$(git rev-parse --short HEAD)
BUILT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "SHA=$SHA  BUILT=$BUILT"

docker build --platform linux/amd64 \
  --build-arg GIT_SHA="$SHA" --build-arg BUILT_AT="$BUILT" \
  -t "egyglass-app:$SHA" .
```

✅ `Successfully tagged egyglass-app:<SHA>`
🔧 فشل البناء على `prisma generate`: تأكّد أن `prisma/` داخل سياق البناء (`.dockerignore`
**لا يستثنيه** — تحقّق بـ`docker build --no-cache` مرة واحدة).

#### ٤·٢ 🔴 اختبار الصورة **محليًّا** قبل الرفع — هذه أهم خطوة في المرحلة

الـ`Dockerfile` لم يُشغَّل قطّ قبل اليوم (اكتشاف #1). **لا يُرفع ما لم يُقلع.**

```bash
docker run -d --name egytest -p 3999:3000 \
  -e AUTH_SECRET=boot-check-only-not-a-real-secret \
  -e DATABASE_URL='postgresql://x:x@127.0.0.1:5432/x' \
  "egyglass-app:$SHA"
sleep 15

echo "— حالة /login —";      curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3999/login
echo "— المنطقة الزمنية —";  docker exec egytest date
echo "— الوسم —";            docker exec egytest printenv APP_GIT_SHA APP_BUILT_AT
echo "— ملفات حرجة —";       docker exec egytest ls -l /app/next.config.ts /app/prisma/migrations | head -5
echo "— هوية العملية —";     docker exec egytest id
echo "— أدوات التشغيل —";    docker exec egytest ls /app/node_modules/.bin/prisma /app/node_modules/.bin/tsx
```

✅ **الستة معًا:**
| الفحص | المتوقَّع |
|---|---|
| `/login` | **200** |
| `date` | ينتهي بـ **`EEST`** (صيفًا) أو `EET` (شتاءً) — **لا `UTC`** ⇒ `tzdata` عملت |
| `APP_GIT_SHA` | يطابق `$SHA` تمامًا |
| `next.config.ts` | **موجود** ⇒ سقف الـ14mb سيُقرأ (اكتشاف #2) |
| `id` | `uid=1000(node)` — **لا `uid=0(root)`** |
| `prisma` و`tsx` | كلاهما موجود ⇒ م-5 وم-7 سيعملان |

🔧 `date` يعرض UTC ⇒ `tzdata` لم تُثبَّت — راجع سطر `apk add` في `Dockerfile`.
🔧 `/login` يعطي 500 ⇒ اقرأ `docker logs egytest` (وارد أن يكون خطأ قاعدة، وهو مقبول
في هذا الفحص طالما رجعت 200؛ أي رمز آخر يعني عطلًا حقيقيًّا).

```bash
docker rm -f egytest
```

#### ٤·٣ الشحن (💻 ثم 🖥️)

```bash
docker save "egyglass-app:$SHA" | gzip > "/e/Projects/EgyGlass_ERP_Backups/egyglass-app-$SHA.tar.gz"
ls -lh "/e/Projects/EgyGlass_ERP_Backups/egyglass-app-$SHA.tar.gz"   # المتوقَّع ≈ 350–500 ميجا

scp -i "$HOME/.ssh/$KEY.pem" "/e/Projects/EgyGlass_ERP_Backups/egyglass-app-$SHA.tar.gz" \
    "ubuntu@$EIP:/tmp/"
```

```bash
# 🖥️
gunzip -c "/tmp/egyglass-app-$SHA.tar.gz" | docker load
docker image inspect "egyglass-app:$SHA" \
  --format 'revision={{index .Config.Labels "org.opencontainers.image.revision"}} created={{.Created}}'
rm -f "/tmp/egyglass-app-$SHA.tar.gz"
```

✅ `revision=<SHA>` مطابق لما بنيتَه.

#### ٤·٤ نسخة العمل وملفات الإعداد (🖥️)

```bash
sudo mkdir -p /opt/egyglass /etc/egyglass/tls /etc/egyglass/htpasswd
sudo chown ubuntu:ubuntu /opt/egyglass
```

انسخ من جهازك **ملفَّي النشر فقط** (لا المستودع كله — لا داعي للمصدر على الخادم):

```bash
# 💻
scp -i "$HOME/.ssh/$KEY.pem" docker-compose.prod.yml "ubuntu@$EIP:/opt/egyglass/"
ssh -i "$HOME/.ssh/$KEY.pem" "ubuntu@$EIP" 'mkdir -p /opt/egyglass/deploy/nginx'
scp -i "$HOME/.ssh/$KEY.pem" deploy/nginx/egyglass.conf "ubuntu@$EIP:/opt/egyglass/deploy/nginx/"
scp -i "$HOME/.ssh/$KEY.pem" deploy/backup/egyglass-backup.sh deploy/backup/restore-drill.sh \
    deploy/backup/s3-lifecycle.json "ubuntu@$EIP:/tmp/"
```

**ملف البيئة** (🖥️ — يُكتب على الخادم مباشرةً، لا يُنقل عبر الشبكة):

```bash
sudo tee /etc/egyglass/env >/dev/null <<'EOF'
APP_IMAGE=egyglass-app:<SHA>
POSTGRES_PASSWORD=<GENERATE_AT_DEPLOY>
DATABASE_URL=postgresql://egyglass:<SAME_PASSWORD>@db:5432/egyglass?schema=public
AUTH_SECRET=<GENERATE_AT_DEPLOY>
APP_PUBLIC_URL=https://<EIP>
EOF
sudo chmod 600 /etc/egyglass/env
```

**لتوليد القيمتين** (🖥️ — انسخ الناتج يدويًّا إلى الملف):
```bash
echo "POSTGRES_PASSWORD: $(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
echo "AUTH_SECRET:       $(openssl rand -base64 32)"
```

> ⚠️ **لماذا يُجرَّد `POSTGRES_PASSWORD` من الرموز:** يدخل داخل `DATABASE_URL`، و
> `@` أو `/` أو `+` فيه تكسر تحليل الرابط أو تحتاج ترميز `%40`. التجريد يقتل هذه
> الفئة من الأعطال بلا نقاش. الطول 24 محرفًا عشوائيًّا يفيض عن أي حاجة أمنية هنا.
> ⚠️ **لا استبدال متغيّرات داخل `--env-file`** — اكتب كلمة المرور **حرفيًّا** في السطرين.

📄 القالب المرجعي: [`deploy/env.prod.example`](../deploy/env.prod.example)

---

### م-5 · القاعدة والهجرات (🖥️)

> `dc` مُعرَّف في `~/.bashrc` منذ م-3·١ ويعمل من أي مجلد.

```bash
dc up -d db
dc exec -T db psql -U egyglass -d egyglass -c "SELECT version();"
```

✅ `PostgreSQL 16.x on x86_64-pc-linux-musl`
🔧 `role "egyglass" does not exist` ⇒ `pgdata` غير فارغ من محاولة سابقة. أوقف، احذف
`/mnt/egyglass-data/pgdata/*`، أعد. (آمن الآن فقط — قبل أي بيانات.)

```bash
dc run --rm app ./node_modules/.bin/prisma migrate deploy
```

> ⚠️ **المسار المباشر لا `npx`** — `npx` قد يستعلم من الشبكة إن أخطأ في الحلّ المحلي.
> البرنامج موجود داخل الصورة (مُتحقَّق في ٤·٢).

✅ `All migrations have been successfully applied.`

```bash
dc exec -T db psql -U egyglass -d egyglass -Atc \
  "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;"
```
✅ **43 بالضبط.** (لا 48 — العدد مُتحقَّق من `prisma/migrations`.)
🔧 أقلّ من 43 ⇒ توقّفت هجرة. `dc run --rm app ./node_modules/.bin/prisma migrate status`
يسمّي المتعثّرة. **لا تُصلحها يدويًّا في القاعدة** — أعد `deploy` بعد فهم السبب.

---

### م-6 · 🚚 البيانات المرجعية — الترتيب مُلزِم

> **المرجع الكامل:** [`fresh-db-runbook.md` §١-ب](fresh-db-runbook.md) — الفخّ والقرارات
> محسومة هناك. هنا شكل الأمر على AWS فقط.

🔴 **القاعدة الحاكمة:** **النقل قبل الاستيراد.** `Material.id` و`ProductType.id` بلا
`@default`، وشاشة الاستيراد تولّد `randomUUID()` جديدًا
(`admin/import/actions.ts:101`) ⇒ استيراد `xlsx` **قبل** النقل يجعل كل `materialId`
في الوصفات يشير إلى معرّف زال.

| الترتيب | المسار | الكيان | العدد |
|---|---|---|---|
| **1** | 🚚 نقل (`refdata-products.sql`) | `ProductType` · `ProductRecipe` · `ConfigType` · `Material` | **331 صفًّا** |
| 2 | ✍️ يدوي `/admin/pricing` | `SystemSettings` · `PricingFactor` | — |
| 3 | ✍️ يدوي `/factories` | `Factory` | ≥1 |
| 4 | 📥 استيراد `/admin/import` | خامات إضافية · `PriceListItem` | — |

```bash
# 💻
scp -i "$HOME/.ssh/$KEY.pem" /e/Projects/EgyGlass_ERP_Backups/refdata-products.sql \
    "ubuntu@$EIP:/tmp/"
```

```bash
# 🖥️  — ON_ERROR_STOP=1 إلزامية: بدونها يتخطّى psql الأخطاء ويكمل فتحصل على
#      بيانات ناقصة تبدو ناجحة.
dc exec -T db psql -U egyglass -d egyglass -v ON_ERROR_STOP=1 < /tmp/refdata-products.sql
```

**التحقّق — والسطر الأخير هو الحاسم:**

```bash
dc exec -T db psql -U egyglass -d egyglass -c "
SELECT 'ProductType' e, count(*) FROM \"ProductType\"
UNION ALL SELECT 'ProductRecipe', count(*) FROM \"ProductRecipe\"
UNION ALL SELECT 'ConfigType',    count(*) FROM \"ConfigType\"
UNION ALL SELECT 'Material',      count(*) FROM \"Material\"
UNION ALL SELECT 'وصفات بخامة مفقودة (يجب 0)', count(*)
  FROM \"ProductRecipe\" r LEFT JOIN \"Material\" m ON m.id = r.\"materialId\"
  WHERE r.\"materialId\" IS NOT NULL AND m.id IS NULL;"
```

✅ `9 · 45 · 14 · 263 · 0` — و**الصفر الأخير غير قابل للتفاوض**.
🔧 الصفر ليس صفرًا ⇒ استُورد شيء قبل النقل. أفرغ الجداول الأربعة وأعد بالترتيب.

⚠️ **الملفّان لقطة 2026-08-03.** تغيّرت القاعدة المحلية بعدها؟ **أعد التصدير** بأمر
`fresh-db-runbook §١-ب` قبل الرفع.

⚠️ **نصّ ضمان السوشيال ميديا كان خاطئًا (منسوخًا من نصّ المشروعات).** الصحيح:
**صيانة مجانية 3 سنوات ضد عيوب الصناعة + ضمان صيانة مدى الحياة.**
أدخله في `warrantyTextSocialMedia` من `/admin/pricing` — **ولا تنسخ نصّ المشروعات.**

---

### م-7 · المستخدمون الخمسة عشر

> ✅ **س-1 محسوم (يوسف، 2026-08-05): النطاق `@egyglass.net` للأربعة عشر.**
> الأدمن يُنشأ بالافتراضي `admin@egyglass.com` (البذرة تكتب مباشرةً فتتخطّى الحارس)
> **ثم يُعدَّل من الشاشة إلى `.net`** — التعديل **إلى** `.net` يمرّ من نفس الحارس
> (`users/actions.ts:115` يفحص النطاق فقط عند إرسال بريد جديد). صفر تعديل كود.
>
> ⚠️ **الجدول أدناه محدَّث بـ`.net`. يخالف `fresh-db-runbook §٢` (كان `.com`) —
> هذا الكتيّب هو النافذ في نطاق النشر.**

**٧·١ حساب الأدمن** (🖥️) — يُنشأ ببذرة مباشرة فيتخطّى فحص النطاق:

```bash
read -rsp "كلمة مرور الأدمن (≥8 و3 فئات من 4): " SEED_ADMIN_PASSWORD; echo
export SEED_ADMIN_PASSWORD
dc run --rm -e SEED_ADMIN_PASSWORD app ./node_modules/.bin/tsx prisma/seed-admin.ts
unset SEED_ADMIN_PASSWORD
```

✅ `✅ Admin user created: admin@egyglass.com`
🔧 `too weak` ⇒ السياسة مفروضة في `seed-admin.ts:15` — ≥8 محارف و**3 من 4** فئات.
🔒 **كلمة مرور مولَّدة الآن.** ممنوع أي قيمة كانت يومًا في المستودع أو محليًّا.

**٧·٢ الأربعة عشر — من الشاشة `/users` بحساب الأدمن**

🔴 **ترتيب مُلزِم:** التيم ليدران (**9 و10**) **قبل** المهندسين (11 و12) — قائمة اختيار
التيم ليدر لا تعرض إلا من هو `TEC_LEAD` فعلًا، والحارس يرفض معرّفًا غير صالح
(`users/actions.ts:148`).

| # | الاسم | البريد | `role` | `department` | `leadRoute` | `teamLead` |
|---|---|---|---|---|---|---|
| 1 | يوسف حماد | `admin@egyglass.net` ⬅️ **بعد التعديل** | `ADMIN` | `EXECUTIVE` | — | — |
| 2 | مدير المبيعات | `sales.manager@egyglass.net` | `SALES_MANAGER` | `SALES` | — | — |
| 3 | مندوب مبيعات ١ | `sales1@egyglass.net` | `SALES_REP` | `SALES` | — | — |
| 4 | مندوب مبيعات ٢ | `sales2@egyglass.net` | `SALES_REP` | `SALES` | — | — |
| 5 | مدير المعاينات | `insp.manager@egyglass.net` | `INSPECTION_MANAGER` | `INSPECTIONS` | — | — |
| 6 | مندوب معاينات ١ | `insp1@egyglass.net` | `INSPECTION_REP` | `INSPECTIONS` | — | — |
| 7 | مندوب معاينات ٢ | `insp2@egyglass.net` | `INSPECTION_REP` | `INSPECTIONS` | — | — |
| 8 | محمد فاروق | `m.farouk@egyglass.net` | `TEC_APPROVER` | `TECHNICAL_OFFICE` | — | — |
| **9** | تيم ليدر مشروعات | `tec.lead.projects@egyglass.net` | `TEC_LEAD` | `TECHNICAL_OFFICE` | **`PROJECTS`** | — |
| **10** | تيم ليدر سوشيال | `tec.lead.social@egyglass.net` | `TEC_LEAD` | `TECHNICAL_OFFICE` | **`SOCIAL_MEDIA`** | — |
| 11 | مهندس مشروعات ١ | `tec1@egyglass.net` | `TECHNICAL_OFFICE` | `TECHNICAL_OFFICE` | — | **#9** |
| 12 | مهندس مشروعات ٢ | `tec2@egyglass.net` | `TECHNICAL_OFFICE` | `TECHNICAL_OFFICE` | — | **#9** |
| 13 | المراجعة | `review@egyglass.net` | `REVIEW` | `TECHNICAL_OFFICE` | — | — |
| 14 | الحسابات | `accounting@egyglass.net` | `ACCOUNTING` | `ACCOUNTING` | — | — |
| 15 | الموارد البشرية | `hr@egyglass.net` | `HR` | `HR` | — | — |

⚠️ **ربط المهندسين بالتيم ليدر (`teamLeadId`) اختياري في النظام** — لا يفرضه حارس.
يُنفَّذ بانضباطك، ويُتحقَّق منه في الاستعلام التالي.

**٧·٢ب تعديل بريد الأدمن إلى `.net`** — بعد إنشاء الأربعة عشر، من `/users` عدّل
الحساب #1 إلى `admin@egyglass.net`.

✅ التحقّق: `dc exec -T db psql -U egyglass -d egyglass -Atc "SELECT count(*) FROM \"User\" WHERE email NOT LIKE '%@egyglass.net';"` ⇒ **0**
🔧 يعطي 1 ⇒ التعديل لم يُحفظ. أعد المحاولة؛ فشله يعني أن `updateSchema` رفض القيمة —
راجع الإملاء (`users/actions.ts:115`).
⚠️ **لا تُعدِّل البريد قبل إنشاء الأربعة عشر** — لو فشل التعديل لسبب ما، تكون قد
فقدت الحساب الوحيد القادر على إنشائهم.

**٧·٣ التحقّق**

```bash
dc exec -T db psql -U egyglass -d egyglass -c \
  "SELECT role, count(*) FROM \"User\" GROUP BY 1 ORDER BY 1;"
dc exec -T db psql -U egyglass -d egyglass -c \
  "SELECT email, \"leadRoute\" FROM \"User\" WHERE role='TEC_LEAD' ORDER BY email;"
dc exec -T db psql -U egyglass -d egyglass -c \
  "SELECT u.email, l.email AS team_lead FROM \"User\" u
   LEFT JOIN \"User\" l ON l.id = u.\"teamLeadId\" WHERE u.role='TECHNICAL_OFFICE';"
```

✅ 15 مستخدمًا · **`leadRoute` غير فارغ لكلا التيم ليدرين** · `team_lead` غير فارغ للمهندسَين.
🔴 `leadRoute` فارغ ⇒ `TEC_LEAD` سيرى **صفر طلبات** وبوابة `TO-24` تحجب طباعة عروضه للأبد.

---

### م-8 · nginx · الشهادة · Basic Auth (🖥️)

**٨·١ الشهادة الموقَّعة ذاتيًّا**

```bash
sudo openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout /etc/egyglass/tls/egyglass.key \
  -out    /etc/egyglass/tls/egyglass.crt \
  -subj "/C=EG/ST=Cairo/L=Cairo/O=EgyGlass/CN=$EIP" \
  -addext "subjectAltName=IP:$EIP"
sudo chmod 600 /etc/egyglass/tls/egyglass.key
sudo chmod 644 /etc/egyglass/tls/egyglass.crt
```

> 🔴 **`subjectAltName=IP:` ليست اختيارية.** المتصفحات الحديثة تتجاهل `CN` تمامًا
> وتقرأ SAN وحده. شهادة بلا SAN لعنوان IP تُنتج `ERR_CERT_COMMON_NAME_INVALID`
> بشاشة لا تعرض حتى خيار المتابعة في بعض الإصدارات.

**٨·٢ حساب Basic Auth المشترك**

```bash
sudo htpasswd -B -c /etc/egyglass/htpasswd/egyglass egyglass
sudo chmod 644 /etc/egyglass/htpasswd/egyglass
```

> `-B` = bcrypt. `644` ضرورية لأن عمليات nginx العاملة (uid 101) تقرأ الملف عند كل طلب.
> **اسم المستخدم `egyglass` وكلمة مرور واحدة مشتركة** — أجهزة شركة فقط، بقرارك.

**٨·٣ الإقلاع الكامل**

```bash
dc up -d
dc ps
```

✅ ثلاث خدمات `running` · `db` و`app` بحالة `healthy`.

**٨·٤ التحقّق الطبقي — كل طبقة على حدة**

```bash
# (1) nginx يطلب المصادقة
curl -k -s -o /dev/null -w 'no-auth → %{http_code}\n' "https://localhost/login"
# (2) بعد Basic Auth، التطبيق يخدم
curl -k -s -u 'egyglass:<BASIC_PW>' -o /dev/null -w 'with-auth → %{http_code}\n' "https://localhost/login"
# (3) ترويسات الوكيل تصل صحيحة
curl -k -s -u 'egyglass:<BASIC_PW>' -D- -o /dev/null "https://localhost/login" | head -12
```

✅ `no-auth → 401` · `with-auth → 200`

**٨·٥ 🔴 ما تفعله إن أخفق الدخول — جهّزته سلفًا لا وقت العطل**

| العرض | السبب | العلاج |
|---|---|---|
| تدخل ببيانات صحيحة فيعيدك `/login` **بلا رسالة خطأ**، إلى ما لا نهاية | `X-Forwarded-Proto` لا تصل ⇒ Auth.js يكتب الكوكي باسم `authjs.session-token` ويقرأ `__Secure-authjs.session-token` (أو العكس) | تأكّد من سطر `proxy_set_header X-Forwarded-Proto https;` في `egyglass.conf`. **هذا هو السبب في أكثر من 90% من هذه الحالة.** |
| كل زر/فعل يفشل برسالة عامة، والصفحات تُعرض سليمة | `Host` مُرَّرت كـ`$proxy_host` ⇒ فحص `Origin` مقابل `Host` في Server Actions يفشل | `proxy_set_header Host $host;` — **لا `$proxy_host`** |
| رفع رسمة > 1 ميجا يعطي **413** | `client_max_body_size` الافتراضي 1m | `client_max_body_size 20m;` موجود في الملف |
| **502** فجأة بعد `dc up -d app` | nginx يحتفظ بـIP قديم للحاوية | `resolver 127.0.0.11` + `proxy_pass $upstream_app$request_uri` موجودان. الحلّ الفوري: `dc restart nginx` |
| المتصفح يرفض الشهادة بلا خيار متابعة | SAN مفقود | أعد ٨·١ مع `-addext` |

> ✅ **الشهادة الموقَّعة ذاتيًّا لا تُقلق `NextAuth` بذاتها.** لا يجري التطبيق أي
> اتصال TLS صادر إلى نفسه؛ من يفحص الشهادة هو **المتصفح** وحده، وقبول الاستثناء
> يجعل الأصل «سياقًا آمنًا» فتُقبل كوكيز `__Secure-` طبيعيًّا. المشكلة الحقيقية هي
> **الترويسات**، لا الشهادة — ولهذا الجدول أعلاه مرتَّب بهذا الترتيب.
>
> **البديل المؤقّت إن انسدّ كل شيء** (وثّقه ولا تتركه): أوقف `nginx`، انشر التطبيق على
> `127.0.0.1:3100` وادخل عبر نفق SSH
> (`ssh -L 3100:127.0.0.1:3100 ubuntu@$EIP`) ⇒ الأصل يصير `http://localhost:3100`
> فتتصالح الكوكيز، وتظلّ الشبكة مغلقة. **حلّ تشخيص لا حلّ نشر.**

---

### م-9 · 🔴 النسخة اليومية إلى S3 — شرط قرار الحاوية

**٩·١ الدلو** (☁️)

```bash
aws s3api create-bucket --bucket "$BUCKET" --region $REGION \
  --create-bucket-configuration LocationConstraint=$REGION

aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'

aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
  --lifecycle-configuration file://deploy/backup/s3-lifecycle.json
```

✅ `aws s3api get-bucket-lifecycle-configuration --bucket $BUCKET` يعرض `Expiration.Days = 30`.

**٩·٢ دور IAM — بلا مفاتيح** (☁️)

```bash
cat > /tmp/trust.json <<'EOF'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow",
 "Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}
EOF

sed "s|<BUCKET_NAME>|$BUCKET|g" deploy/backup/iam-policy-backup.json > /tmp/s3policy.json

aws iam create-role --role-name egyglass-uat-backup \
  --assume-role-policy-document file:///tmp/trust.json
aws iam put-role-policy --role-name egyglass-uat-backup \
  --policy-name s3-backup --policy-document file:///tmp/s3policy.json
aws iam create-instance-profile --instance-profile-name egyglass-uat-profile
aws iam add-role-to-instance-profile \
  --instance-profile-name egyglass-uat-profile --role-name egyglass-uat-backup
sleep 15   # انتشار IAM
aws ec2 associate-iam-instance-profile --region $REGION \
  --instance-id "$IID" --iam-instance-profile Name=egyglass-uat-profile
```

> 🔴 **السياسة تمنح `PutObject` و`GetObject` و`ListBucket` — ولا تمنح `DeleteObject`.**
> الحذف وظيفة قاعدة دورة الحياة على الدلو. النتيجة: **نسخة مخترقة لا تستطيع محو
> تاريخ نسخها الاحتياطية.** هذا فرق جوهري بين نسخة احتياطية ونسخة *محمية*.

✅ (🖥️) `aws sts get-caller-identity` يعرض `assumed-role/egyglass-uat-backup/...`
🔧 يعرض خطأ اعتماد ⇒ لم ينتشر الملف الشخصي بعد؛ انتظر دقيقة وأعد.

**٩·٣ تركيب السكربتات** (🖥️)

```bash
sudo install -m 750 -o root -g root /tmp/egyglass-backup.sh /usr/local/bin/egyglass-backup.sh
sudo install -m 750 -o root -g root /tmp/restore-drill.sh   /usr/local/bin/egyglass-restore-drill.sh
sudo mkdir -p /var/backups/egyglass /var/lib/egyglass

sudo tee /etc/egyglass/backup.env >/dev/null <<EOF
S3_BUCKET=$BUCKET
AWS_REGION=$REGION
COMPOSE_DIR=/opt/egyglass
DATA_DIR=/mnt/egyglass-data
STAGING_DIR=/var/backups/egyglass
LOCAL_KEEP_DAYS=3
EOF
sudo chmod 600 /etc/egyglass/backup.env
```

> ℹ️ هذا الملف **لا يحوي أي بيانات اعتماد** — الصلاحية من دور IAM. `600` احتياطًا فقط.

**٩·٤ الجدولة والتدوير**

```bash
sudo tee /etc/cron.d/egyglass-backup >/dev/null <<'EOF'
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin
30 2 * * * root /usr/local/bin/egyglass-backup.sh >> /var/log/egyglass-backup.log 2>&1
EOF
sudo chmod 644 /etc/cron.d/egyglass-backup

sudo tee /etc/logrotate.d/egyglass-backup >/dev/null <<'EOF'
/var/log/egyglass-backup.log {
    weekly
    rotate 8
    compress
    missingok
    notifempty
}
EOF
```

> **02:30 بتوقيت القاهرة** (المضيف مضبوط عليها في م-3).
> ⚠️ **cron يعمل بـPATH ضيّق** — ولهذا `PATH` مثبَّت في الملف وفي السكربت معًا،
> وإلا فشل بـ`docker: command not found` **بصمت في السجلّ وحده**.

**٩·٥ التشغيل الأول يدويًّا — لا تنتظر منتصف الليل**

```bash
sudo /usr/local/bin/egyglass-backup.sh
cat /var/lib/egyglass/last-backup
aws s3 ls "s3://$BUCKET/" --recursive --human-readable
```

✅ ملف الحالة يبدأ بـ`OK` · و`s3 ls` يعرض **ملفَّين**: `db-*.dump` و`uploads-*.tar.gz`.
🔧 `FAIL` ⇒ السطر نفسه يحمل السبب. السكربت يتحقّق من: حجم الملف · **فهرس
`pg_restore -l`** · قابلية قراءة الأرشيف · **وجود الكائن على S3 ومطابقة حجمه**.

---

### م-10 · اختبار الدخان — ثمانية لا تُختصر

> 🔴 **قبل كل شيء: بوابة جِدّة البناء.** تُنفَّذ بعد **كل** نشر، لا مرة واحدة.

```bash
# 🖥️ الأرقام الثلاثة يجب أن تحكي القصة نفسها
docker inspect egyglass-erp-app-1 --format 'image={{.Config.Image}} started={{.State.StartedAt}}'
dc exec -T app printenv APP_GIT_SHA APP_BUILT_AT
```
```bash
# 💻
git rev-parse --short HEAD
```
✅ `APP_GIT_SHA` == `git rev-parse --short HEAD` == الوسم في `image=`
و`started` **أحدث** من `APP_BUILT_AT`.
🔴 **هذه هي الخطوة التي أنقذتنا ثلاث مرات** من استنتاج «الإصلاح فشل» على خادم بائت.
اختلاف واحد ⇒ **توقّف**؛ الحاوية تخدم بناءً قديمًا وكل ما بعده باطل.

| # | الفحص | كيف | ✅ المتوقَّع |
|---|---|---|---|
| **1** | رفع صورة **> 1 ميجا** وعرضها داخل الصفحة | من `/inspections/<id>` ارفع صورة موقع حجمها **1.5–3 ميجا** | تُرفع وتظهر **مضمَّنة** لا كتنزيل. 🔴 حجم >1MB مقصود: يثبت أن `next.config.ts` وصل للصورة (اكتشاف #2) |
| **2** | 🔴 **إعادة تشغيل كاملة** ⇒ الملف باقٍ | `sudo reboot` · انتظر · `ssh` · `findmnt /mnt/egyglass-data` · `ls -l /mnt/egyglass-data/uploads/inspections/` · ثم افتح الصورة من المتصفح | التركيب قائم · الملف موجود · الصورة تُعرض. **`reboot` كامل لا `dc restart`** — الأخير لا يختبر `fstab` إطلاقًا |
| **3** | رابط مرفق بلا جلسة ⇒ يُمنع | `curl -k -i -u 'egyglass:<PW>' https://$EIP/uploads/inspections/<file>` | **401** وجسمه `Unauthorized` **وبلا ترويسة `WWW-Authenticate`**. 🔴 مرِّر Basic Auth وإلا فالـ401 من nginx ولا يثبت شيئًا |
| **4** | المنطقة الزمنية في `dueDate` | اجدول معاينة داخل القاهرة، ثم الاستعلام أدناه | ينتهي بـ**`20:59:59.999+00`** صيفًا (القاهرة UTC+3) · `21:59:59.999+00` شتاءً |
| **5** | الإشعارات تصل ووجهتها تُفتح | بحساب `SALES_REP` اطلب تسعيرًا ⇒ ادخل بحساب `TECHNICAL_OFFICE` | الجرس يعرض الإشعار خلال **≤30 ث**، والضغط يفتح `/technical-office/<id>` — لا `/dashboard` |
| **6** | 🔴 تغيير مهلة المعاينة يسري **بلا إعادة تشغيل** | `/admin/pricing` ⇒ `inspectionSlaInsideDays` من 2 إلى 3 ⇒ احفظ ⇒ **بلا لمس الحاوية** اجدول معاينة جديدة | المهلة الجديدة **3 أيام عمل**. مضمون بنيويًّا: `getSystemSettings()` بلا caching (`src/lib/config.ts:13`) و47 صفحة `force-dynamic` |
| **7** | `SALES_REP` يفتح عرض زميله | سجّل معرّف عرض يملكه `sales1`، ثم افتحه بحساب `sales2` | **404** — لا 403 ولا صفحة منع (`quotations/[id]/page.tsx:50,82`) |
| **8** | 🔴 **تدريب استرجاع فعلي** | `sudo /usr/local/bin/egyglass-restore-drill.sh 2026/08/db-<STAMP>.dump` | ينتهي بـ`✅ نجح تدريب الاسترجاع` والأعداد تطابق الإنتاج. **نسخة لم تُجرَّب ليست نسخة** |

**استعلام الفحص 4:**

```bash
dc exec -T db psql -U egyglass -d egyglass -c "
SELECT id, location, \"scheduledAt\", \"dueDate\"
FROM \"InspectionRequest\" WHERE \"dueDate\" IS NOT NULL
ORDER BY \"createdAt\" DESC LIMIT 1;"
```

> القاعدة مثبَّتة على `PGTZ=UTC` في compose، فالعرض بلا لبس.
> الأساس: `endOfCairoDayForKey` (`src/lib/format/dates.ts:156`) يختم اليوم عند
> `23:59:59.999` **بتوقيت القاهرة** — لا إزاحة يدوية، فمصر تتأرجح بين `+2` و`+3`.

---

## ٣ · مرحلة المسح — منفصلة، وبعد نجاح م-10 كاملة

> ⛔ **لا تبدأ قبل أن تُنهي م-10 بثمانيتها.** والبيانات القديمة: **3 مستخدمين ·
> 2 عرض · صفر مرفق** ⇒ لا شيء يستحق النقل، والمسح آمن.

**٣·١ اجرد أولًا — لقطة قرص منسيّة تظلّ تُحاسَب سنوات** (☁️)

```bash
OLD=<OLD_INSTANCE_ID>

echo "── الأقراص الملحقة ──"
aws ec2 describe-instances --region $REGION --instance-ids "$OLD" \
  --query 'Reservations[].Instances[].BlockDeviceMappings[].Ebs.VolumeId' --output table

echo "── كل الأقراص غير المستعمَلة في الإقليم ──"
aws ec2 describe-volumes --region $REGION --filters Name=status,Values=available \
  --query 'Volumes[].{ID:VolumeId,GB:Size,Created:CreateTime}' --output table

echo "── اللقطات (أخطر ما يُنسى) ──"
aws ec2 describe-snapshots --region $REGION --owner-ids self \
  --query 'Snapshots[].{ID:SnapshotId,Vol:VolumeId,GB:VolumeSize,When:StartTime}' --output table

echo "── عناوين IP غير المرتبطة ──"
aws ec2 describe-addresses --region $REGION \
  --query 'Addresses[?AssociationId==null].{IP:PublicIp,Alloc:AllocationId}' --output table
```

**٣·٢ التسلسل**

```bash
aws ec2 stop-instances --region $REGION --instance-ids "$OLD"
aws ec2 wait instance-stopped --region $REGION --instance-ids "$OLD"
```
⏸️ **قف هنا 48 ساعة.** النسخة المتوقّفة لا تُحاسَب حسابيًّا (القرص فقط)، والتراجع
تشغيلها بأمر واحد. بعدها فقط:

```bash
aws ec2 terminate-instances --region $REGION --instance-ids "$OLD"
aws ec2 wait instance-terminated --region $REGION --instance-ids "$OLD"

aws ec2 delete-volume   --region $REGION --volume-id <ORPHANED_VOL>     # لكل قرص من الجرد
aws ec2 delete-snapshot --region $REGION --snapshot-id <ORPHANED_SNAP>  # لكل لقطة
aws ec2 release-address --region $REGION --allocation-id <UNUSED_ALLOC>
aws ec2 delete-key-pair --region $REGION --key-name <OLD_KEY_NAME>
aws ec2 delete-security-group --region $REGION --group-id <OLD_SG>
```

> ⚠️ **مجموعة الأمان آخر ما يُحذف** — لا تُحذف ما دامت مرتبطة بأي واجهة شبكة.
> ⚠️ **الـvolumes الثلاثة اليتيمة** (`egyglass-db-1` وأخواتها) داخل النسخة القديمة
> تختفي مع إنهائها — لكن تحقّق من الجرد أن لا شيء تبقّى `available`.

**٣·٣ التحقّق النهائي**

```bash
aws ec2 describe-volumes  --region $REGION --filters Name=status,Values=available --query 'length(Volumes)'
aws ec2 describe-snapshots --region $REGION --owner-ids self --query 'length(Snapshots)'
aws ec2 describe-addresses --region $REGION --query "length(Addresses[?AssociationId==null])"
```
✅ **ثلاثة أصفار.** أي رقم آخر = مورد يُحاسَب بلا استعمال.

---

## ٤ · تقدير التكلفة الشهرية

> ⚠️ **أسعار قائمة تقريبية لإقليم `me-south-1`، غير مُتحقَّقة من واجهة تسعير AWS**
> (حاولتُ جلبها آليًّا فلم تُتَح). الحساب مكشوف كي تصحّحه بالأرقام الفعلية من
> **AWS Pricing Calculator**. الخطأ المتوقَّع ±15%.

| البند | الكمية | سعر الوحدة (تقديري) | شهريًّا |
|---|---|---|---|
| `t3.small` عند الطلب | 730 ساعة | ~$0.0264/ساعة | **~$19.3** |
| قرص الجذر gp3 | 30 جيجا | ~$0.095/جيجا | **~$2.9** |
| قرص البيانات gp3 | 20 جيجا | ~$0.095/جيجا | **~$1.9** |
| 🔴 عنوان IPv4 عام | 730 ساعة | $0.005/ساعة | **~$3.7** |
| تخزين S3 | ~2 جيجا | ~$0.027/جيجا | **~$0.1** |
| نقل صادر | ~5 جيجا | ~$0.117/جيجا | **~$0.6** |
| | | **الإجمالي** | **≈ $28–30/شهر** |

🔴 **بند يُغفَل دائمًا:** منذ فبراير 2024 تُحاسِب AWS على **كل** عنوان IPv4 عام —
**حتى المرتبط بنسخة تعمل**. لم يعد Elastic IP مجانيًّا.

**خفض التكلفة — بترتيب العائد:**
| الإجراء | التوفير | المقابل |
|---|---|---|
| إيقاف النسخة ليلًا وعطلة الأسبوع (~50 ساعة/أسبوع تشغيل) | **~$13/شهر** | البيئة غير متاحة خارج الدوام · الأقراص والـIP تُحاسَب كما هي · **النسخة الاحتياطية لن تعمل ليلًا** ⇒ انقل cron إلى 14:00 |
| خطة توفير حوسبة سنة | ~$6–7/شهر | التزام سنة |
| تقليص قرص الجذر إلى 20 جيجا | ~$1/شهر | هامش أقل للسجلات وطبقات الصور — **لا أنصح** |

⚠️ **عتبة تستحق المراقبة:** السكربت يؤرشف **كامل** `uploads` يوميًّا ⇒ 30 نسخة كاملة
على S3. عند 5 جيجا مرفقات تصير الفاتورة ~$4/شهر وتتصاعد خطيًّا.
**عندها فقط** حوّل المرفقات إلى `aws s3 sync` تراكمي، وأبقِ تفريغ القاعدة كما هو.
لا تعقّده قبل ذلك.

---

## ٥ · الأسئلة المفتوحة — تحتاج قرارك

| # | السؤال | لماذا يهم | توصيتي |
|---|---|---|---|
| ~~س-1~~ | ✅ **محسوم (2026-08-05): `@egyglass.net` للأربعة عشر · الأدمن بالافتراضي ثم يُعدَّل من الشاشة.** صفر كود. م-7 محدَّث | — | — |
| ~~س-2~~ | ✅ **محسوم (2026-08-05): `TZ=Africa/Cairo` معتمَد.** مطبَّق في `Dockerfile` (مع `tzdata`) و`docker-compose.prod.yml`. القاعدة تبقى `PGTZ=UTC` | — | — |
| ~~س-3~~ | ✅ **محسوم (2026-08-05): المنفذ 22 مقيَّد على `$MYIP/32`.** إجراء التحديث عند تبدّل العنوان صار **بندًا تشغيليًّا دائمًا داخل م-1** (إضافة القاعدة الجديدة **وسحب القديمة**) — لا يعيش في جدول أسئلة مغلقة | — | — |
| **س-4** | **تشغيل غير جذر (`USER node`) — أوافق؟** | يضيف شرط ملكية على قرص EBS | **نعم** — الحاوية خلف إنترنت. الشرط الوحيد `chown 1000` في م-2، والتراجع سطر واحد في compose (`user: root`) |
| **س-5** | **اسم دلو S3** (فريد عالميًّا) | يلزم قبل م-9 | `egyglass-erp-backups-<أربعة أرقام>` |
| **س-6** | **إيقاف النسخة خارج الدوام؟** | ~$13/شهر | **لا للنشر الأول** — أضف متغيّرًا واحدًا وقت التشخيص. أعد النظر بعد استقرار UAT |
| **س-7** | **هل أعيد تصدير البيانات المرجعية؟** | `refdata-products.sql` لقطة **2026-08-03** | إن تغيّرت القاعدة المحلية بعد ذلك التاريخ ⇒ **نعم**، بأمر `fresh-db-runbook §١-ب` |
| **س-8** | **نطاق حقيقي + شهادة Let's Encrypt؟** | يُسقط تحذير المتصفح وBasic Auth الخشن | **مرحلة تالية.** IP + موقَّعة ذاتيًّا كافية لقياس داخلي |

---

## ٦ · ما لم يُغطَّ — صريحًا

| # | البند | الحالة |
|---|---|---|
| 1 | **لم أنفّذ أمرًا واحدًا على AWS** · لم أطلب ولم أقبل أي بيانات اعتماد · صفر commit | ✅ بالتصميم |
| 2 | **المراقبة والتنبيه** | ❌ **لا شيء.** لا CloudWatch Agent، ولا إنذار على ذاكرة/قرص/توقّف خدمة. الأثر: امتلاء القرص أو موت الحاوية يُكتشف **بشكوى مستخدم**. أقرب حلّ رخيص: إنذار `StatusCheckFailed` + إنذار ذاكرة عبر وكيل CloudWatch |
| 3 | **إشعار فشل النسخة الاحتياطية** | ❌ السكربت يكتب `FAIL` في `/var/lib/egyglass/last-backup` **ولا يُخطر أحدًا**. اجعل قراءته عادة أسبوعية حتى يُضاف SNS |
| 4 | **الاستمرارية** | ❌ نسخة واحدة · منطقة توافر واحدة · بلا تجاوز فشل. عطل عتادي = توقّف حتى إعادة البناء من النسخة (ساعة تقريبًا بهذا الكتيّب) |
| 5 | **نطاق وشهادة حقيقية** | ❌ IP + موقَّعة ذاتيًّا (س-8) |
| 6 | **تحديثات الأمان للنظام** | ❌ لا `unattended-upgrades` ولا جدول ترقيع مُعلَن |
| 7 | **`BL-184` — 20 مُنسِّق وقت غير مثبَّت** | ⚠️ `TZ` **يخفّف الأثر على الخادم فقط**. الدَّين في الكود **قائم**، وقوالب الطباعة أخطره (مستند مطبوع بتاريخ خاطئ يخرج من الشركة) |
| 7ب | **`BL-206` — حدّ المعدّل المشترك** | ⚠️ **مسجَّل ومفتوح.** إعداد nginx يفصل الدلاء **على هذه البيئة وحدها**؛ `rate-limit.ts:6` كما هو، وابتلاع الـ429 في `notifications-bell.tsx:64` كما هو. **لا يُغلق بنجاح النشر** |
| 8 | **31 خطأ `tsc`** | ⚠️ قائمة كما هي — ليست حاجز نشر، وسُجّلت خطَّ أساس |
| 9 | **`--omit=dev` للصورة** | ⚠️ **مؤجَّل بوعي.** يوفّر ~300 ميجا مقابل ثلاث نقاط فشل (رقعة `next` · `prisma` CLI · `tsx`) — والثلاثة يحتاجها م-5 وم-7 والنسخة اليومية |
| 10 | **`W-07` استطلاع الرضا · HR · مؤجّلات كريم** | ❌ خارج النطاق بقرارك السابق — لا علاقة لها بالنشر |
| 11 | **`deploy/backup/backup.env.example`** | ℹ️ **حاول الوكيل كتابته فمنعه `protect.py`** (يحظر ملفات الأسرار). القانون عمل كما ينبغي؛ المحتوى مضمَّن في **م-9·٣** كأمر جاهز للصق بدلًا منه |

---

## ٧ · جرد الملفات المُنتَجة

| الملف | الحالة | ماذا يفعل |
|---|---|---|
| [`docs/aws-clean-deploy-runbook.md`](aws-clean-deploy-runbook.md) | 🆕 | هذا الكتيّب |
| [`Dockerfile`](../Dockerfile) | ♻️ أُعيدت كتابته | بناء مسبق + `tzdata` + `next.config.ts` + غير جذر + وسم `GIT_SHA` |
| [`docker-compose.prod.yml`](../docker-compose.prod.yml) | ♻️ أُعيدت كتابته | صفر بناء وقت الإقلاع · **صفر منفذ للتطبيق** · قرص EBS · تدوير سجلات · فحوص صحة |
| [`.dockerignore`](../.dockerignore) | ♻️ مُحصَّن | `.env*` · لا يستثني `prisma/migrations/*.sql` |
| [`deploy/nginx/egyglass.conf`](../deploy/nginx/egyglass.conf) | 🆕 | TLS · Basic Auth · الترويسات الأربع الحرجة · `client_max_body_size 20m` |
| [`deploy/backup/egyglass-backup.sh`](../deploy/backup/egyglass-backup.sh) | 🆕 | نسخة يومية مُتحقَّقة (قاعدة + مرفقات) إلى S3 |
| [`deploy/backup/restore-drill.sh`](../deploy/backup/restore-drill.sh) | 🆕 | تدريب استرجاع لا يمسّ الإنتاج |
| [`deploy/backup/s3-lifecycle.json`](../deploy/backup/s3-lifecycle.json) | 🆕 | حذف ما يتجاوز 30 يومًا |
| [`deploy/backup/iam-policy-backup.json`](../deploy/backup/iam-policy-backup.json) | 🆕 | صلاحية دنيا · **بلا `DeleteObject`** |
| [`deploy/env.prod.example`](../deploy/env.prod.example) | 🆕 | قالب بيئة — `<PLACEHOLDER>` فقط |
| [`.gitattributes`](../.gitattributes) | 🆕 | 🔴 يثبّت `LF` على ملفات النشر — انظر أدناه |

**كلها غير مُودَعة.** المراجعة والالتزام بيدك (`L-03`).

### 🔴 لماذا `.gitattributes` ليست ترفًا

جهازك مضبوط على `core.autocrlf=true` (مُتحقَّق: `git config --get core.autocrlf`).
الملفات المكتوبة الآن نهاياتها `LF` سليمة، **لكن أول `checkout` بعد الإيداع يحوّلها
إلى `CRLF`** — وحينها:

```
/usr/bin/env bash^M: bad interpreter: No such file or directory
```

سكربت النسخة الاحتياطية يموت بهذا السطر، و`nginx.conf` و`docker-compose` يفشلان
بأخطاء تحليل لا تذكر السبب. النطاق مضيَّق على ملفات النشر وحدها — بلا إعادة تطبيع
شاملة للمستودع.

**تحقّق سريع على الخادم بعد أي نسخ:**
```bash
file /usr/local/bin/egyglass-backup.sh
```
✅ `POSIX shell script, ASCII text executable` — **بلا** عبارة `with CRLF line terminators`.
