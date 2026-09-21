import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const password = process.env.BIZOS_TEST_PASSWORD ?? "Userprueba1234";

assert.ok(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL is required");
assert.ok(publishableKey, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required");

const candidates = [
  "userprueba1@bizos.test",
  "userprueba2@bizos.test",
  "userprueba3@bizos.test",
  "userprueba4@bizos.test",
];

for (const email of candidates) {
  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    console.log(JSON.stringify({ email, login: "failed", message: authError?.message ?? "no user" }));
    continue;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, nombre, correo, requiere_cambio_contrasena, roles(nombre)")
    .eq("id", authData.user.id)
    .maybeSingle();

  console.log(
    JSON.stringify({
      email,
      login: "ok",
      profile: profile
        ? {
            correo: profile.correo,
            nombre: profile.nombre,
            requiereCambioContrasena: profile.requiere_cambio_contrasena,
            rol: Array.isArray(profile.roles) ? profile.roles[0]?.nombre : profile.roles?.nombre,
          }
        : null,
      profileError: profileError ? `${profileError.code ?? "ERROR"} ${profileError.message}` : null,
    }),
  );

  await supabase.auth.signOut();
}
