-- Telegram Notification Trigger for guest_chats table
-- This trigger sends Telegram notifications when guest users send messages

-- Ensure pg_net extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to notify Telegram on guest chat updates
create or replace function public.notify_telegram_on_guest_chat()
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

-- Trigger on guest_chats.chat_messages updates
drop trigger if exists trg_notify_telegram_on_guest_chat on public.guest_chats;
create trigger trg_notify_telegram_on_guest_chat
after update of chat_messages on public.guest_chats
for each row
when (new.chat_messages is not null)
execute function public.notify_telegram_on_guest_chat();

