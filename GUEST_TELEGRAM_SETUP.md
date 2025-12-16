# Guest Kullanıcılar için Telegram Bildirimi Kurulumu

## Sorun
Guest kullanıcılar (Kullanıcı100, Kullanıcı101, vb.) mesaj gönderdiğinde Telegram bildirimi gitmiyor.

## Çözüm
Supabase'de `guest_chats` tablosu için Telegram bildirim trigger'ını aktif etmen gerekiyor.

## Adımlar

### 1. Supabase Dashboard'a Git
- Supabase Dashboard → SQL Editor

### 2. Trigger'ı Çalıştır
`sql_files/guest_chats_telegram_trigger.sql` dosyasının içeriğini kopyala ve Supabase SQL Editor'da çalıştır.

### 3. Trigger'ın Çalıştığını Kontrol Et
Aşağıdaki sorguyu çalıştırarak trigger'ın aktif olduğunu doğrula:

```sql
-- Trigger var mı?
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'trg_notify_telegram_on_guest_chat';

-- Fonksiyon var mı?
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'notify_telegram_on_guest_chat';

-- pg_net extension yüklü mü?
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```

### 4. Test Et
- Guest kullanıcı olarak (index.html'den) bir mesaj gönder
- Telegram'da bildirimi kontrol et
- Supabase Logs'da hata var mı kontrol et

## Notlar
- Trigger, `guest_chats` tablosunda `chat_messages` güncellendiğinde çalışır
- Sadece `sender: 'user'` olan mesajlar için bildirim gönderir
- Trigger hataları sessizce geçer (chat güncellemelerini engellemez)

