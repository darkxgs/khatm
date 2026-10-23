"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signUpAction, type FormState } from "@/app/[lang]/actions";
import { dict } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { buttonClass, Field, inputClass, Spinner } from "./ui";

/** Sign in and sign up share one form; sign-up adds the business name. */
export function AuthForm({ lang, mode }: { lang: Lang; mode: "signin" | "signup" }) {
  const t = dict(lang).auth;
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "signin" ? signInAction : signUpAction, { error: null });
  const err = state.error ? ((t.errors as Record<string, string>)[state.error] ?? dict(lang).common.tryAgain) : null;
  const field = (name: string) => (state.error === name ? err : null);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="lang" value={lang} />
      {mode === "signup" ? (
        <Field label={t.businessName} error={field("name")}>
          <input name="businessName" required autoComplete="organization" defaultValue={state.values?.businessName} className={inputClass} aria-invalid={state.error === "name"} />
        </Field>
      ) : null}
      <Field label={t.email} error={field("email") ?? (state.error === "taken" ? err : null)}>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          dir="ltr"
          defaultValue={state.values?.email}
          className={inputClass}
          aria-invalid={state.error === "email" || state.error === "taken"}
        />
      </Field>
      <Field label={t.password} hint={mode === "signup" ? t.passwordHint : undefined} error={field("password")}>
        <input
          name="password"
          type="password"
          required
          minLength={mode === "signup" ? 10 : undefined}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          dir="ltr"
          className={inputClass}
          aria-invalid={state.error === "password"}
        />
      </Field>
      {state.error === "wrong" || state.error === "rate" ? (
        <p role="alert" className="rounded-[10px] bg-late-soft px-3.5 py-2.5 text-[14px] font-medium text-late">
          {err}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "mt-1 w-full")}>
        {pending ? <Spinner /> : null}
        {mode === "signin" ? t.signIn : t.signUp}
      </button>
      <p className="text-center text-[14px] text-ink-2">
        {mode === "signin" ? t.noAccount : t.haveAccount}{" "}
        <Link href={`/${lang}/${mode === "signin" ? "signup" : "signin"}`} className="font-semibold text-seal underline decoration-seal/30 underline-offset-2 hover:decoration-seal">
          {mode === "signin" ? t.createOne : t.signInInstead}
        </Link>
      </p>
    </form>
  );
}
