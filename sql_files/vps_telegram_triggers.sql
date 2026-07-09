-- VPS Telegram bildirim trigger'ları (opsiyonel — chat.js doğrudan API çağırır)
-- pg_net yüklü değilse bu dosyayı atlayın; /api/telegram/notify yeterlidir.
-- sudo -u postgres psql -d jetbarkod -f /opt/jetbarkod-api/vps_telegram_triggers.sql

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_telegram_on_guest_chat()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_msgs jsonb := '[]'::jsonb;
    new_msgs jsonb := '[]'::jsonb;
    last_msg jsonb;
    endpoint text := 'https://api.flowcobalt.com/api/telegram/notify';
BEGIN
    BEGIN
        IF new.chat_messages IS NOT NULL THEN
            new_msgs := new.chat_messages::jsonb;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN new;
    END;

    BEGIN
        IF TG_OP = 'UPDATE' AND old.chat_messages IS NOT NULL THEN
            old_msgs := old.chat_messages::jsonb;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        old_msgs := '[]'::jsonb;
    END;

    IF jsonb_typeof(new_msgs) <> 'array' THEN
        RETURN new;
    END IF;

    IF TG_OP = 'UPDATE' AND jsonb_array_length(new_msgs) <= COALESCE(jsonb_array_length(old_msgs), 0) THEN
        RETURN new;
    END IF;

    last_msg := new_msgs -> (jsonb_array_length(new_msgs) - 1);

    IF COALESCE(last_msg ->> 'sender', '') <> 'user' THEN
        RETURN new;
    END IF;

    PERFORM net.http_post(
        url := endpoint,
        body := jsonb_build_object(
            'username', new.username,
            'message', last_msg ->> 'message'
        )::text,
        headers := jsonb_build_object('Content-Type', 'application/json')
    );

    RETURN new;
EXCEPTION WHEN OTHERS THEN
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_telegram_on_guest_chat ON public.guest_chats;
CREATE TRIGGER trg_notify_telegram_on_guest_chat
AFTER INSERT OR UPDATE OF chat_messages ON public.guest_chats
FOR EACH ROW
WHEN (new.chat_messages IS NOT NULL)
EXECUTE FUNCTION public.notify_telegram_on_guest_chat();

CREATE OR REPLACE FUNCTION public.notify_telegram_on_chat()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_msgs jsonb := '[]'::jsonb;
    new_msgs jsonb := '[]'::jsonb;
    last_msg jsonb;
    endpoint text := 'https://api.flowcobalt.com/api/telegram/notify';
BEGIN
    BEGIN
        IF new.chat_messages IS NOT NULL THEN
            new_msgs := new.chat_messages::jsonb;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN new;
    END;

    BEGIN
        IF old.chat_messages IS NOT NULL THEN
            old_msgs := old.chat_messages::jsonb;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        old_msgs := '[]'::jsonb;
    END;

    IF jsonb_typeof(new_msgs) <> 'array' THEN
        RETURN new;
    END IF;

    IF jsonb_array_length(new_msgs) <= COALESCE(jsonb_array_length(old_msgs), 0) THEN
        RETURN new;
    END IF;

    last_msg := new_msgs -> (jsonb_array_length(new_msgs) - 1);

    IF COALESCE(last_msg ->> 'sender', '') <> 'user' THEN
        RETURN new;
    END IF;

    PERFORM net.http_post(
        url := endpoint,
        body := jsonb_build_object(
            'username', new.username,
            'message', last_msg ->> 'message'
        )::text,
        headers := jsonb_build_object('Content-Type', 'application/json')
    );

    RETURN new;
EXCEPTION WHEN OTHERS THEN
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_telegram_on_chat ON public.users;
CREATE TRIGGER trg_notify_telegram_on_chat
AFTER UPDATE OF chat_messages ON public.users
FOR EACH ROW
WHEN (new.chat_messages IS NOT NULL)
EXECUTE FUNCTION public.notify_telegram_on_chat();
