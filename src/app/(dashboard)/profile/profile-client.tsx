"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { passwordPolicy } from "@/lib/validation/password";
import { updateMyProfileAction, changeMyPasswordAction } from "./actions";

type ProfileUser = {
  name: string;
  email: string;
  role: string;
  department: string;
};

type ProfileFormData = { name: string };
type PasswordFormData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const profileSchema = z.object({
  name: z.string().min(1, "errors.required"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "errors.required"),
    newPassword: passwordPolicy,
    confirmPassword: z.string().min(1, "errors.required"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "errors.passwordMismatch",
    path: ["confirmPassword"],
  });

export function ProfileClient({ user }: { user: ProfileUser }) {
  const t = useTranslations();
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const fe = (err: { message?: string } | undefined) =>
    err?.message ? t(err.message) : undefined;

  const infoForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema) as Resolver<ProfileFormData>,
    defaultValues: { name: user.name },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema) as Resolver<PasswordFormData>,
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmitInfo(formData: ProfileFormData) {
    setSavingInfo(true);
    try {
      const result = await updateMyProfileAction(formData);
      if (!result.success) {
        toast.error(
          typeof result.error === "string"
            ? t(result.error)
            : Object.values(result.error)
                .flat()
                .map((k) => t(k))
                .join("، ")
        );
        return;
      }
      toast.success(t("profile.infoUpdated"));
    } finally {
      setSavingInfo(false);
    }
  }

  async function onSubmitPassword(formData: PasswordFormData) {
    setSavingPassword(true);
    try {
      const result = await changeMyPasswordAction(formData);
      if (!result.success) {
        if (typeof result.error === "string") {
          toast.error(t(result.error));
        } else {
          // أخطاء على مستوى الحقل (كلمة المرور الحالية خاطئة / الجديدة = القديمة)
          for (const [field, messages] of Object.entries(result.error)) {
            const key = messages?.[0];
            if (key) {
              passwordForm.setError(field as keyof PasswordFormData, {
                message: t(key),
              });
            }
          }
        }
        return;
      }
      toast.success(t("profile.passwordChanged"));
      passwordForm.reset();
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">{t("profile.title")}</h1>
      <p className="text-sm text-gray-500 mb-6">{t("profile.subtitle")}</p>

      {/* معلومات الحساب المُدارة إداريًا (قراءة فقط) */}
      <section className="rounded-md border bg-white p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">{t("profile.accountSection")}</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <dt className="text-sm text-gray-500">{t("profile.email")}</dt>
            <dd className="mt-1 font-medium" dir="ltr">
              {user.email}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">{t("profile.role")}</dt>
            <dd className="mt-1 font-medium">{t(`roles.${user.role}`)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">{t("profile.department")}</dt>
            <dd className="mt-1 font-medium">
              {t(`departments.${user.department}`)}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-gray-400 mt-4">
          {t("profile.accountReadonlyHint")}
        </p>
      </section>

      {/* تعديل البيانات الشخصية (الاسم) */}
      <section className="rounded-md border bg-white p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">{t("profile.infoSection")}</h2>
        <form
          onSubmit={infoForm.handleSubmit(onSubmitInfo)}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label htmlFor="name">{t("profile.name")}</Label>
            <Input id="name" {...infoForm.register("name")} />
            <FieldError message={fe(infoForm.formState.errors.name)} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingInfo}>
              {savingInfo ? `${t("app.save")}...` : t("app.save")}
            </Button>
          </div>
        </form>
      </section>

      {/* تغيير كلمة المرور */}
      <section className="rounded-md border bg-white p-6">
        <h2 className="text-lg font-semibold mb-1">
          {t("profile.passwordSection")}
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          {t("profile.passwordPolicyHint")}
        </p>
        <form
          onSubmit={passwordForm.handleSubmit(onSubmitPassword)}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label htmlFor="currentPassword">
              {t("profile.currentPassword")}
            </Label>
            <Input
              id="currentPassword"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              {...passwordForm.register("currentPassword")}
            />
            <FieldError
              message={fe(passwordForm.formState.errors.currentPassword)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="newPassword">{t("profile.newPassword")}</Label>
            <Input
              id="newPassword"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              {...passwordForm.register("newPassword")}
            />
            <FieldError
              message={fe(passwordForm.formState.errors.newPassword)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirmPassword">
              {t("profile.confirmPassword")}
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              {...passwordForm.register("confirmPassword")}
            />
            <FieldError
              message={fe(passwordForm.formState.errors.confirmPassword)}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={savingPassword}>
              {savingPassword
                ? `${t("profile.changePassword")}...`
                : t("profile.changePassword")}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
