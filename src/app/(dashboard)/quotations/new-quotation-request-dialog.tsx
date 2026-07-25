"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
// SF-01: نستهلك نفس أفعال الـbackend الجاهزة — بلا تعديل عليها ولا route جديد.
// كلاهما محروس server-side بـrequireRole(ALLOWED_ROLES) داخل customers/actions.ts.
import { createCustomerAction, createQuotationRequestAction } from "../customers/actions";

// نفس قيم enum المستخدمة في شاشة العملاء (customers-client.tsx) — عرض/إدخال فقط.
const CUSTOMER_TYPES = ["INDIVIDUAL", "ENGINEER", "COMPANY"] as const;
const CUSTOMER_SOURCES = ["AD", "REFERRAL", "WHATSAPP", "EXHIBITION", "VISIT"] as const;

export type CustomerLite = { id: string; name: string; phone: string };

/**
 * SF-01: نقطة دخول المندوب لطلب عرض سعر — تدفّق من خطوتين داخل مودال واحد:
 *  (1) اختيار عميل موجود أو إنشاء عميل جديد (createCustomerAction).
 *  (2) الانتقال التلقائي لفورم طلب عرض السعر (createQuotationRequestAction)
 *      بـ customerId مُمرَّر من الخطوة 1 — بلا إدخال يدوي للعميل.
 * لا مساس بأي schema/RBAC/route — استهلاك واجهة لمنطق backend قائم فقط.
 */
export function NewQuotationRequestDialog({
  customers,
}: {
  customers: CustomerLite[];
}) {
  const t = useTranslations();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"customer" | "request">("customer");
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [selected, setSelected] = useState<CustomerLite | null>(null);

  // اختيار عميل موجود
  const [search, setSearch] = useState("");

  // إنشاء عميل جديد (الحقول الإلزامية لـ createCustomerAction فقط)
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newType, setNewType] = useState<string>("INDIVIDUAL");
  const [newSource, setNewSource] = useState<string>("VISIT");

  // فورم الطلب
  const [route, setRoute] = useState<"" | "PROJECTS" | "SOCIAL_MEDIA">("");
  const [summary, setSummary] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(search.trim())
    );
  }, [customers, search]);

  function resetAll() {
    setStep("customer");
    setTab("existing");
    setSelected(null);
    setSearch("");
    setNewName("");
    setNewPhone("");
    setNewType("INDIVIDUAL");
    setNewSource("VISIT");
    setRoute("");
    setSummary("");
    setError(null);
    setSubmitting(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetAll();
  }

  function pickExisting(customer: CustomerLite) {
    setSelected(customer);
    setError(null);
    setStep("request");
  }

  async function createAndContinue() {
    setError(null);
    if (!newName.trim() || !newPhone.trim()) {
      setError(t("errors.required"));
      return;
    }
    setSubmitting(true);
    // isRepeat=false ثابت (يُشتق لاحقًا عند أول تعاقد — دفعة هـ). ownerId يُسند
    // للمندوب server-side (customers/actions.ts:54) — لا نمرّره من الواجهة.
    const result = await createCustomerAction({
      name: newName.trim(),
      phone: newPhone.trim(),
      type: newType,
      source: newSource,
      isRepeat: false,
    });
    setSubmitting(false);
    if (!result.success) {
      const err = result.error;
      const msg =
        typeof err === "string"
          ? t(err)
          : Object.values(err)
              .flat()
              .filter((k): k is string => typeof k === "string")
              .map((k) => t(k))
              .join("، ");
      setError(msg);
      return;
    }
    setSelected({ id: result.data.id, name: result.data.name, phone: result.data.phone });
    setStep("request");
  }

  async function submitRequest() {
    setError(null);
    if (!selected) {
      setStep("customer");
      return;
    }
    if (!route) {
      setError(t("errors.routeRequired"));
      return;
    }
    if (!summary.trim()) {
      setError(t("errors.required"));
      return;
    }
    setSubmitting(true);
    const result = await createQuotationRequestAction({
      customerId: selected.id,
      technicalRoute: route,
      summary,
    });
    setSubmitting(false);
    if (!result.success) {
      setError(t(result.error));
      return;
    }
    toast.success(`${t("quotationRequest.created")}: ${result.code}`);
    handleOpenChange(false);
    router.refresh();
  }

  return (
    <>
      {/* Dialog محكوم بحالة open + زر خارجي — نفس نمط customers-client (بلا DialogTrigger). */}
      <Button type="button" onClick={() => setOpen(true)}>
        {t("newRequestFlow.button")}
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("newRequestFlow.title")}</DialogTitle>
        </DialogHeader>

        {step === "customer" ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={tab === "existing" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setTab("existing");
                  setError(null);
                }}
              >
                {t("newRequestFlow.tabExisting")}
              </Button>
              <Button
                type="button"
                variant={tab === "new" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setTab("new");
                  setError(null);
                }}
              >
                {t("newRequestFlow.tabNew")}
              </Button>
            </div>

            {tab === "existing" ? (
              <div className="space-y-2">
                <Input
                  placeholder={t("customers.searchByNameOrPhone")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
                  {filteredCustomers.length ? (
                    filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => pickExisting(c)}
                        className="flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-accent"
                      >
                        <span className="font-medium">{c.name}</span>
                        <span dir="ltr" className="text-muted-foreground">{c.phone}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      {t("newRequestFlow.noResults")}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="nqr-name">{t("customers.name")}</Label>
                  <Input
                    id="nqr-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nqr-phone">{t("customers.phone")}</Label>
                  <Input
                    id="nqr-phone"
                    dir="ltr"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{t("customers.type")}</Label>
                    <Select value={newType} onValueChange={(v) => setNewType(v ?? "INDIVIDUAL")}>
                      <SelectTrigger>
                        <SelectValue>
                          {t(`customers.${newType.toLowerCase()}`)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {CUSTOMER_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(`customers.${type.toLowerCase()}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{t("customers.source")}</Label>
                    <Select value={newSource} onValueChange={(v) => setNewSource(v ?? "VISIT")}>
                      <SelectTrigger>
                        <SelectValue>
                          {t(`customers.source_${newSource}`)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {CUSTOMER_SOURCES.map((source) => (
                          <SelectItem key={source} value={source}>
                            {t(`customers.source_${source}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={createAndContinue}
                  disabled={submitting}
                  className="w-full"
                >
                  {submitting ? t("app.loading") : t("newRequestFlow.next")}
                </Button>
              </div>
            )}

            <FieldError message={error ?? undefined} />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("newRequestFlow.selectedCustomer", { name: selected?.name ?? "" })}
            </p>

            <div className="space-y-2">
              <Label>{t("quotationRequest.route")} *</Label>
              <div className="flex gap-3">
                {(["PROJECTS", "SOCIAL_MEDIA"] as const).map((r) => (
                  <label
                    key={r}
                    className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer text-sm ${
                      route === r ? "border-blue-600 bg-blue-50" : "border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="nqr-route"
                      checked={route === r}
                      onChange={() => setRoute(r)}
                    />
                    {t(`quotationRequest.route_${r}`)}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="nqr-summary">{t("quotationRequest.summary")} *</Label>
              <Textarea
                id="nqr-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder={t("quotationRequest.summaryPlaceholder")}
              />
            </div>

            <FieldError message={error ?? undefined} />

            <div className="flex justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep("customer");
                  setError(null);
                }}
              >
                {t("app.back")}
              </Button>
              <Button type="button" onClick={submitRequest} disabled={submitting}>
                {submitting ? t("app.loading") : t("quotationRequest.submit")}
              </Button>
            </div>
          </div>
        )}
        </DialogContent>
      </Dialog>
    </>
  );
}
