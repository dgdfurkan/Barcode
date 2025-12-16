// Supabase Edge Function: Telegram notification for new support messages
// Triggered by pg_net HTTP call or manual test from admin panel

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ADMIN_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";
const TELEGRAM_TIMEOUT_MS = 8000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// Supabase Edge Functions automatically provides SUPABASE_URL
// For service_role key, we'll use a custom secret name
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || 
  Deno.env.get("SERVICE_ROLE_KEY") || "";

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  // Allow requests from triggers (no auth) and authenticated requests
  // This function is safe to be public as it only reads admin_settings and sends Telegram messages

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    // ignore parse errors
  }

  const username = (payload.username as string) || "Bilinmiyor";
  const message = (payload.message as string) || "";
  const isTest = Boolean(payload.isTest);

  // Load admin settings (singleton)
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from("admin_settings")
    .select("telegram_bot_token, telegram_chat_id")
    .eq("id", ADMIN_SETTINGS_ID)
    .single();

  if (settingsError || !settings?.telegram_bot_token || !settings?.telegram_chat_id) {
    // Silent skip to avoid breaking pipeline
    return new Response(
      JSON.stringify({ skipped: true, reason: "missing_settings" }),
      { status: 200, headers: corsHeaders },
    );
  }

  const text = isTest
    ? "Test başarılı!"
    : `📩 Yeni Destek Mesajı!\nKimden: ${username}\nMesaj: ${message}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);

  try {
    const telegramResp = await fetch(
      `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: settings.telegram_chat_id,
          text,
          parse_mode: "Markdown",
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (!telegramResp.ok) {
      const detail = await telegramResp.text().catch(() => "unknown");
      console.error("Telegram send error:", detail);
      return new Response(
        JSON.stringify({ ok: false, error: "telegram_error", detail }),
        { status: 500, headers: corsHeaders },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    clearTimeout(timeout);
    console.error("Telegram send exception:", error);
    return new Response(
      JSON.stringify({ ok: false, error: "exception", detail: `${error}` }),
      { status: 500, headers: corsHeaders },
    );
  }
});

