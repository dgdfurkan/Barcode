# Jet Barkod — Güvenlik Sertleştirme Kurulum Kılavuzu

> **Altın kural:** Hiçbir adım üretimi bozmadan geri alınabilir olmalı.
> Her aşamanın sonunda bir **doğrulama** ve bir **geri alma** adımı var.
>
> **Bana asla şifre/token yapıştırma.** Aşağıdaki scriptler hiçbir gizli
> değeri ekrana basmaz; çıktılarını güvenle paylaşabilirsin.

---

## Aşamalar ve durum

| Aşama | Ne yapar | Üretimi etkiler mi? | Durum |
|-------|----------|---------------------|-------|
| **0** | Yedek al | Hayır | ⬜ |
| **1** | Test DB'de RLS'i kanıtla | Hayır (ayrı DB) | ⬜ |
| **2** | Üretim DB'ye rolleri + RLS'i kur | Hayır (PostgREST hâlâ eski rolde) | ⬜ |
| **3** | API'yi güncelle (JWT, bcrypt, misafir sohbeti) | Evet — kısa restart | ⬜ |
| **4** | Frontend'i güncelle | Evet | ⬜ |
| **5** | PostgREST'i kısıtlı role çevir → **açık kapanır** | Evet | ⬜ |
| **6** | Düz metin parola kolonunu düşür | Hayır | ⬜ |

Bu dosya şu an **Aşama 0 ve 1**'i kapsıyor. Sonraki aşamalar hazır oldukça eklenecek.

---

## Aşama 0 — Yedek (ATLAMA)

Mac terminalinden VPS'e bağlan:

```bash
ssh root@SUNUCU_IP
```

> `SUNUCU_IP` yerine kendi sunucu adresini yaz. Farklı bir kullanıcı/port
> kullanıyorsan: `ssh -p PORT kullanici@SUNUCU_IP`

VPS'te, tam yedek al:

```bash
mkdir -p /root/jetbarkod-yedek && cd /root/jetbarkod-yedek
sudo -u postgres pg_dump -Fc jetbarkod > jetbarkod_$(date +%F_%H%M).dump
ls -lh /root/jetbarkod-yedek
```

**Bana gönder:** `ls -lh` çıktısı (dosya boyutu makul mü diye bakacağım).

> Geri yükleme gerekirse:
> `sudo -u postgres pg_restore -d jetbarkod --clean --if-exists YEDEK.dump`

Ayrıca API klasörünün yedeği:

```bash
cp -a /opt/jetbarkod-api /root/jetbarkod-yedek/jetbarkod-api-$(date +%F)
ls /root/jetbarkod-yedek/
```

---

## Aşama 1 — Test veritabanında RLS'i kanıtla

Üretime **hiç dokunmadan**, gerçek şemanın kopyası üzerinde test edeceğiz.

### 1.1 Scriptleri sunucuya al

VPS'te:

```bash
mkdir -p /root/guvenlik && cd /root/guvenlik
```

Şimdi iki dosyayı buraya koyman lazım. En kolayı: **Mac terminalinde yeni bir
sekme aç** (VPS'ten çıkma) ve repo klasöründen kopyala:

```bash
cd ~/CursorProjects/Barcode && git fetch origin && git checkout security-hardening && git pull
```

```bash
scp sql_files/security_01_roles_and_rls.sql sql_files/security_verify.sql root@SUNUCU_IP:/root/guvenlik/
```

### 1.2 Test veritabanını oluştur

VPS sekmesinde:

```bash
sudo -u postgres psql -c "DROP DATABASE IF EXISTS jetbarkod_rlstest;"
sudo -u postgres psql -c "CREATE DATABASE jetbarkod_rlstest OWNER jetbarkod;"
sudo -u postgres pg_dump jetbarkod | sudo -u postgres psql -q -d jetbarkod_rlstest
echo "--- test DB tablo sayisi ---"
sudo -u postgres psql -d jetbarkod_rlstest -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
```

> Üretim veritabanı bu işlemden **etkilenmez**; `pg_dump` yalnızca okur.

### 1.3 Migration'ı test DB'ye uygula

```bash
sudo -u postgres psql -d jetbarkod_rlstest -f /root/guvenlik/security_01_roles_and_rls.sql
```

**Bana gönder:** çıktının tamamı. Özellikle sondaki üç tabloyu göreceğim:
- RLS durumu (hepsi `t` olmalı)
- `web_anon` yetkileri (yalnızca `system_features` / `SELECT` olmalı)
- `web_user` parola kolonu (**boş** olmalı)

### 1.4 Kanıt testini çalıştır

```bash
sudo -u postgres psql -d jetbarkod_rlstest -f /root/guvenlik/security_verify.sql
```

**Beklenen:** en sonda

```
SONUC: TUM TESTLER GECTI
```

**Bana gönder:** çıktının tamamı. Bir test bile kalırsa script durur ve
hangi testin neden kaldığını yazar — o zaman politikayı düzeltip tekrar deneriz.

Bu script şunları kanıtlıyor:

| # | Test |
|---|------|
| 1 | Kullanıcı kendi verisini görebiliyor (sistem bozulmadı) |
| 2 | Kullanıcı başkasının verisini **göremiyor** |
| 3 | Giriş yapmamış ziyaretçi `users` / `guest_chats` / `admin_settings`'e **erişemiyor** |
| 4 | Parola kolonları **hiç kimseye** okunmuyor |
| 5 | Kullanıcı kendine premium / admin / trial uzatması **veremiyor** |
| 6 | Kullanıcı kendi sayım verisini yazabiliyor (bozulmadı) |
| 7 | Kullanıcı **başkası adına** veri yazamıyor |
| 8 | Admin herkesi görebiliyor |
| 9 | `is_admin` claim'i sahteyse admin politikası boş dönüyor |

### 1.5 Test veritabanını sil

```bash
sudo -u postgres psql -c "DROP DATABASE jetbarkod_rlstest;"
```

---

## Sonra ne olacak?

Testler geçtiğinde:

- **Aşama 2**: aynı SQL'i üretim veritabanına uygularım. Bu adım **davranışı
  değiştirmez** — PostgREST hâlâ eski `jetbarkod` rolüyle çalıştığı için site
  aynen çalışmaya devam eder. Sadece yeni roller ve politikalar hazır bekler.
- **Aşama 3–4**: API ve frontend güncellenir (JWT, bcrypt, misafir sohbeti).
- **Aşama 5**: PostgREST kısıtlı role çevrilir. **Açık bu anda kapanır.**
- **Aşama 6**: düz metin parola kolonu düşürülür.

Aşama 5'te kısa bir kesinti riski var (tarayıcısında eski JS önbellekte kalan
kullanıcılar bir kez sayfayı yenilemek zorunda kalabilir). Bunu en aza indirmek
için Aşama 4'te script adreslerine sürüm etiketi ekleyeceğiz.

---

## Ayrıca yapılacaklar (not)

- [ ] Eski Supabase projesi (`ytekbbxvfdheiexsojpx`) — veri taşınmış, **projeyi
      Supabase panelinden sil/duraklat**, sonra repodaki anon key ve config'i temizleyeceğim.
- [ ] Tüm kullanıcı parolalarının sıfırlanması. Parolalar düz metin tutulduğu ve
      veritabanı bir süre açıkta kaldığı için **hepsi yanmış kabul edilmeli**.
      Aşama 6'dan sonra planlayacağız.
- [ ] Telegram bot token'ı rotasyonu (`admin_settings` tablosu açıktaydı).
      BotFather → `/revoke` → yeni token → admin panelinden gir.
