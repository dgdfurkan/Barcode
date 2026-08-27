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

---

# Aşama 3 — API'yi güncelle

> **Sıralama neden önemli?**
> Yeni frontend, girişte sunucudan bir JWT bekliyor. API bunu vermeden
> frontend yayına alınırsa giriş kırılır. Bu yüzden **önce API**.
>
> Ayrıca PostgREST, `jwt-secret` tanımlı değilken `Authorization` başlığı
> taşıyan isteği reddeder. O yüzden PostgREST'e sırrı da bu aşamada
> tanıtıyoruz — ama `db-anon-role` şimdilik değişmiyor, yani eski
> tarayıcılar çalışmaya devam ediyor.

## 3.1 Kodu sunucuya al

**Nerede:** Terminal 1 (VPS) · `root@flowcobalt:/#`

```bash
cd /opt/jetbarkod-api && cp server.js server.js.yedek-$(date +%F) && ls
```

**Nerede:** Terminal 2 (Mac) · `furkangunduz@192 Barcode %`

```bash
cd ~/CursorProjects/Barcode && git pull && scp vps-api/server.js vps-api/package.json root@198.55.109.160:/opt/jetbarkod-api/
```

## 3.2 Sırrı üret ve .env'e yaz

**Nerede:** Terminal 1 (VPS) · `root@flowcobalt:/opt/jetbarkod-api#`

> Bu komut sırrı ekrana **basmaz**, doğrudan dosyaya yazar. Bana göndermene
> gerek yok, zaten göndermemelisin.

```bash
cd /opt/jetbarkod-api
grep -q '^JWT_SECRET=' .env || echo "JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')" >> .env
grep -q '^ALLOWED_ORIGINS=' .env || echo "ALLOWED_ORIGINS=https://jetbarkod.com.tr,https://www.jetbarkod.com.tr" >> .env
echo "--- .env anahtarlari (degerler gizli) ---"
sed 's/=.*/=***/' .env
```

> **ALLOWED_ORIGINS zorunlu.** Yeni API, bu ayar boşsa tarayıcı isteklerini
> reddediyor (eskiden boşsa herkese açıktı). Alan adın farklıysa düzelt.

## 3.3 Bağımlılıkları kur ve başlat

**Nerede:** Terminal 1 (VPS) · `root@flowcobalt:/opt/jetbarkod-api#`

```bash
npm install --omit=dev && systemctl restart jetbarkod-api && sleep 2 && systemctl is-active jetbarkod-api && curl -s http://127.0.0.1:3001/health
```

> `active` ve `{"ok":true,...}` görmelisin. Servis açılmıyorsa:
> `journalctl -u jetbarkod-api -n 30 --no-pager`

## 3.4 PostgREST'e aynı sırrı tanıt

**Nerede:** Terminal 1 (VPS) · `root@flowcobalt:/opt/jetbarkod-api#`

```bash
cd /opt/jetbarkod-api
cp postgrest.env postgrest.env.yedek-$(date +%F)
SECRET=$(grep '^JWT_SECRET=' .env | cut -d= -f2-)
grep -q '^jwt-secret' postgrest.env || echo "jwt-secret = \"$SECRET\"" >> postgrest.env
grep -q '^jwt-aud' postgrest.env || true
chmod 600 postgrest.env
systemctl restart postgrest && sleep 2 && systemctl is-active postgrest
echo "--- postgrest.env anahtarlari (degerler gizli) ---"
sed 's/=.*/= ***/' postgrest.env
```

## 3.5 Doğrula — hem eski hem yeni yol çalışmalı

**Nerede:** Terminal 1 (VPS) · `root@flowcobalt:/opt/jetbarkod-api#`

```bash
echo "1) token'siz (eski tarayicilar) - 200 BEKLENIYOR:"
curl -s -o /dev/null -w "   HTTP %{http_code}\n" http://127.0.0.1:3002/system_features
echo "2) gecersiz token - 401 BEKLENIYOR:"
curl -s -o /dev/null -w "   HTTP %{http_code}\n" -H "Authorization: Bearer sahte.token.degeri" http://127.0.0.1:3002/system_features
echo "3) API saglik:"
curl -s http://127.0.0.1:3001/health
```

**Bana at:** 3.3, 3.4 ve 3.5 çıktılarını.

Bu aşamada **site kullanıcı gözünde hiç değişmez.** Giriş yapıp gezin, her şey normal olmalı.

---

# Aşama 4 — Frontend (kritik aşama)

Bu, kırılma olacaksa görüleceği yer. Frontend JWT göndermeye başlayınca
kullanıcılar `web_user` rolüne düşer ve **RLS devreye girer**.

Aşama 3 yeşilse haber ver; frontend'i `main`'e alma komutlarını ve
adım adım doğrulama listesini o zaman vereceğim (tek kullanıcıyla
önce ben test edeceğim).

Geri alma: `git revert` + GitHub Pages'in yeniden yayınlaması (~1 dk).

---

# Aşama 5 — Anonim kapıyı kapat

`postgrest.env` içinde `db-anon-role = "jetbarkod"` → `"web_anon"` ve
`db-uri` kullanıcısı `authenticator` olur. **Açık bu anda kapanır.**

# Aşama 6 — Düz metin parolaları temizle

Herkes bir kez giriş yaptıktan sonra `users.password` kolonu düşürülür.
