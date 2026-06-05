"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  bootstrapEmpresaInicialSchema,
  loginSchema,
  signupSchema,
} from "@/modules/auth/schemas";
import {
  clearPendingInvitationToken,
  getPendingInvitationToken,
  setPendingInvitationToken,
} from "@/modules/users/invitations/invitation-cookie";

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function appendInvitationToken(path: string, token?: string | null): string {
  if (!token) {
    return path;
  }

  return `${path}?invitation_token=${encodeURIComponent(token)}`;
}

function isPublicSignupEnabled() {
  return process.env.PUBLIC_SIGNUP_ENABLED !== "false";
}

async function getAppBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");

  if (configuredUrl) {
    return configuredUrl;
  }

  const headerStore = await headers();
  const origin = headerStore.get("origin");

  if (origin) {
    return origin.replace(/\/$/, "");
  }

  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");

  if (!host) {
    return "http://localhost:3000";
  }

  const protocol =
    headerStore.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${protocol}://${host}`;
}

async function getSignupEmailRedirectTo(invitationToken?: string | null) {
  const baseUrl = await getAppBaseUrl();

  if (invitationToken) {
    return `${baseUrl}/invitation?token=${encodeURIComponent(invitationToken)}`;
  }

  return `${baseUrl}/onboarding`;
}

function redirectWithAuthError(
  path: "/login" | "/signup",
  message: string,
  token?: string | null,
): never {
  const params = new URLSearchParams({ error: message });

  if (token) {
    params.set("invitation_token", token);
  }

  redirect(`${path}?${params.toString()}`);
}

type AuthErrorLike = {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
};

type LoginProfileState =
  | { status: "active" }
  | { status: "inactive" | "suspended" }
  | { status: "missing" }
  | { error: unknown; status: "error" };

function maskEmail(email: string) {
  const [localPart = "", domain = ""] = email.split("@");
  const safeLocal =
    localPart.length <= 2
      ? `${localPart.slice(0, 1)}***`
      : `${localPart.slice(0, 2)}***${localPart.slice(-1)}`;

  return domain ? `${safeLocal}@${domain}` : `${safeLocal}@***`;
}

function getAuthErrorMessage(error: AuthErrorLike) {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("email not confirmed")) {
    return "Correo no confirmado. Revisa tu correo antes de iniciar sesion.";
  }

  if (
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials")
  ) {
    return "Credenciales invalidas. Revisa correo y contrasena.";
  }

  return "Error inesperado al iniciar sesion. Revisa la terminal para mas detalle.";
}

function logAuthError(
  actionName: string,
  error: AuthErrorLike | null,
  email: string,
  context: Record<string, unknown> = {},
) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${actionName}] Supabase Auth error`, {
      code: error?.code,
      context,
      email: maskEmail(email),
      message: error?.message,
      name: error?.name,
      status: error?.status,
    });
  }
}

function logProfileLookupError(
  actionName: string,
  error: unknown,
  email: string,
  userId: string,
) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${actionName}] Profile lookup error`, {
      email: maskEmail(email),
      error,
      userId,
    });
  }
}

async function getLoginProfileState(
  userId: string,
  email: string,
): Promise<LoginProfileState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, estado")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    logProfileLookupError("loginAction", error, email, userId);

    return { error, status: "error" };
  }

  if (!data) {
    return { status: "missing" };
  }

  if (data.estado === "activo") {
    return { status: "active" };
  }

  if (data.estado === "suspendido") {
    return { status: "suspended" };
  }

  return { status: "inactive" };
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/login", "Correo o contrasena invalidos.");
  }

  const invitationToken =
    parsed.data.invitation_token ?? (await getPendingInvitationToken());

  if (invitationToken) {
    await setPendingInvitationToken(invitationToken);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    logAuthError("loginAction", error, parsed.data.email, {
      hasUser: Boolean(data.user),
      invitationFlow: Boolean(invitationToken),
    });
    redirectWithAuthError(
      "/login",
      error
        ? getAuthErrorMessage(error)
        : "Login incompleto: Supabase no devolvio usuario.",
      invitationToken,
    );
  }

  const profileState = await getLoginProfileState(data.user.id, parsed.data.email);

  if (profileState.status === "error") {
    redirectWithAuthError(
      "/login",
      "No se pudo leer el profile del usuario. Revisa permisos RLS o estado de la cuenta.",
      invitationToken,
    );
  }

  if (profileState.status === "inactive" || profileState.status === "suspended") {
    await supabase.auth.signOut();
    redirectWithAuthError(
      "/login",
      profileState.status === "suspended"
        ? "Cuenta suspendida. Contacta al administrador de tu empresa."
        : "Cuenta inactiva. Contacta al administrador de tu empresa.",
      invitationToken,
    );
  }

  if (profileState.status === "active") {
    if (invitationToken) {
      await clearPendingInvitationToken();
    }
    if (process.env.NODE_ENV !== "production") {
      console.info("[loginAction] login ok", {
        email: maskEmail(parsed.data.email),
        redirectTarget: "/dashboard",
      });
    }
    redirect("/dashboard");
  }

  if (invitationToken) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[loginAction] login ok", {
        email: maskEmail(parsed.data.email),
        redirectTarget: "/invitation",
      });
    }
    redirect(`/invitation?token=${encodeURIComponent(invitationToken)}`);
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[loginAction] login ok", {
      email: maskEmail(parsed.data.email),
      redirectTarget: "/onboarding",
    });
  }
  redirect("/onboarding");
}

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/signup", "Correo o contrasena invalidos.");
  }

  const invitationToken =
    parsed.data.invitation_token ?? (await getPendingInvitationToken());

  if (!invitationToken && !isPublicSignupEnabled()) {
    redirectWithAuthError(
      "/signup",
      "El registro publico no esta disponible. Solicita una invitacion.",
      null,
    );
  }

  if (invitationToken) {
    await setPendingInvitationToken(invitationToken);
  }

  const emailRedirectTo = await getSignupEmailRedirectTo(invitationToken);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    options: {
      emailRedirectTo,
    },
    password: parsed.data.password,
  });

  if (error) {
    redirectWithAuthError("/signup", "No se pudo crear la cuenta.", invitationToken);
  }

  if (!data.session) {
    const path = appendInvitationToken("/login", invitationToken);
    const separator = path.includes("?") ? "&" : "?";

    redirect(`${path}${separator}notice=confirm-email-invitation`);
  }

  if (invitationToken) {
    redirect(`/invitation?token=${encodeURIComponent(invitationToken)}`);
  }

  redirect("/onboarding");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function bootstrapEmpresaInicialAction(formData: FormData) {
  const parsed = bootstrapEmpresaInicialSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/onboarding", "Datos de alta invalidos.");
  }

  const supabase = await createClient();
  const pendingInvitationToken = await getPendingInvitationToken();

  if (pendingInvitationToken) {
    redirect(`/invitation?token=${encodeURIComponent(pendingInvitationToken)}`);
  }

  if (!isPublicSignupEnabled()) {
    redirectWithError(
      "/onboarding",
      "El registro publico no esta disponible. Solicita una invitacion.",
    );
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const userEmail = userData.user.email;

  if (!userEmail) {
    redirectWithError("/onboarding", "La sesion no tiene correo verificado.");
  }

  const { error } = await supabase.rpc("bootstrap_empresa_inicial", {
    p_correo_empresa: userEmail,
    p_correo_usuario: userEmail,
    p_identificacion_fiscal: parsed.data.identificacionFiscal ?? null,
    p_nombre_comercial: parsed.data.nombreComercial ?? null,
    p_nombre_empresa: parsed.data.nombreEmpresa,
    p_nombre_usuario: parsed.data.nombreUsuario,
    p_telefono_empresa: parsed.data.telefonoEmpresa ?? null,
    p_telefono_usuario: parsed.data.telefonoUsuario ?? null,
  });

  if (error) {
    redirectWithError("/onboarding", "No se pudo completar el alta inicial.");
  }

  redirect("/dashboard");
}
