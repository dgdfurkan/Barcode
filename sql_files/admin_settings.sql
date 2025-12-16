-- Admin Settings singleton table and chat trigger for Telegram notifications
-- Run this in Supabase SQL editor

-- Extensions
create extension if not exists pg_net;

-- Singleton settings table
create table if not exists admin_settings (
    id uuid primary key default '00000000-0000-0000-0000-000000000001',
    telegram_bot_token text,
    telegram_chat_id text,
    gemini_api_key text,
    cloudinary_cloud_name text,
    cloudinary_api_key text,
    cloudinary_upload_preset text,
    updated_at timestamptz default now()
);

-- Ensure single seeded row exists
insert into admin_settings (id) values ('00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- RLS (relaxed to avoid breaking existing anon client usage; tighten if auth is added)
alter table admin_settings enable row level security;
do $$
begin
    -- Drop existing policies if they exist
    drop policy if exists allow_all_admin_settings_read on admin_settings;
    drop policy if exists allow_all_admin_settings_write on admin_settings;
    drop policy if exists allow_all_admin_settings_insert on admin_settings;
    
    -- Read policy
    create policy allow_all_admin_settings_read on admin_settings
        for select using (true);
    
    -- Update policy
    create policy allow_all_admin_settings_write on admin_settings
        for update using (true) with check (true);
    
    -- Insert policy (needed for upsert)
    create policy allow_all_admin_settings_insert on admin_settings
        for insert with check (true);
end$$;

-- Trigger function: send latest user message to Edge Function via pg_net
create or replace function public.notify_telegram_on_chat()
returns trigger
language plpgsql
as $$
declare
    old_msgs jsonb := '[]'::jsonb;
    new_msgs jsonb := '[]'::jsonb;
    last_msg jsonb;
    endpoint text := 'https://ytekbbxvfdheiexsojpx.functions.supabase.co/telegram-notify';
begin
    -- Parse JSON arrays safely
    begin
        if new.chat_messages is not null then
            new_msgs := new.chat_messages::jsonb;
        end if;
    exception when others then
        return new;
    end;

    begin
        if old.chat_messages is not null then
            old_msgs := old.chat_messages::jsonb;
        end if;
    exception when others then
        old_msgs := '[]'::jsonb;
    end;

    if jsonb_typeof(new_msgs) <> 'array' then
        return new;
    end if;

    if jsonb_array_length(new_msgs) <= coalesce(jsonb_array_length(old_msgs), 0) then
        return new;
    end if;

    last_msg := new_msgs -> (jsonb_array_length(new_msgs) - 1);

    if coalesce(last_msg ->> 'sender', '') <> 'user' then
        return new;
    end if;

    -- Note: pg_net.http_post doesn't support custom headers easily
    -- Edge Function should be public or accept requests without auth
    -- For now, we'll send without auth header (function should handle this)
    perform net.http_post(
        url := endpoint,
        body := jsonb_build_object(
            'username', new.username,
            'message', last_msg ->> 'message',
            'timestamp', last_msg ->> 'timestamp'
        )::text,
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        )
    );

    return new;
exception when others then
    -- Fail silently to avoid blocking chat updates
    return new;
end;
$$;

-- Trigger on users.chat_messages updates
drop trigger if exists trg_notify_telegram_on_chat on public.users;
create trigger trg_notify_telegram_on_chat
after update of chat_messages on public.users
for each row
when (new.chat_messages is not null)
execute function public.notify_telegram_on_chat();

