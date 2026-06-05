"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type EphemeralPageAlertProps = {
  error?: string;
  success?: string;
};

export function EphemeralPageAlert({ error, success }: EphemeralPageAlertProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [initialError] = useState(error);
  const [initialSuccess] = useState(success);

  useEffect(() => {
    if (!error && !success) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("error");
    params.delete("success");
    const query = params.toString();

    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [error, pathname, router, searchParams, success]);

  if (!initialError && !initialSuccess) return null;

  return (
    <div className="space-y-2">
      {initialError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {initialError}
        </p>
      ) : null}
      {initialSuccess ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {initialSuccess}
        </p>
      ) : null}
    </div>
  );
}
