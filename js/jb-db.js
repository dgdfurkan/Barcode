/**
 * Jet Barkod — veritabanı istemcisi
 * ============================================================================
 *
 * PostgREST ile konuşan, bağımlılığı olmayan küçük bir istemci.
 *
 * ---------------------------------------------------------------------------
 * NEDEN YAZILDI
 * ---------------------------------------------------------------------------
 * Önceden bu işi `@supabase/supabase-js` yapıyordu ve kütüphane her sayfada
 * `https://unpkg.com` üzerinden yükleniyordu. Supabase SERVİSİ çoktan
 * terk edilmişti; kütüphane yalnızca bir PostgREST sorgu kurucusu olarak
 * duruyordu. Ama bedeli ağırdı: unpkg engellenirse (kurumsal proxy, gizlilik
 * eklentisi, CDN kesintisi) `createClient` hiç oluşmuyor, uygulama giriş
 * yapıp sonra sessizce ölüyordu — hiçbir tablo okunamıyor, ekranda da hata
 * görünmüyordu. Bir kullanıcının iş bilgisayarında tam olarak bu yaşandı.
 *
 * Artık dış bağımlılık yok. Aynı arayüz, kendi alan adımızdan.
 *
 * ---------------------------------------------------------------------------
 * KAPSAM — bilinçli olarak dar
 * ---------------------------------------------------------------------------
 * Uygulamanın gerçekten kullandığı yüzey:
 *   from().select().insert().update().upsert().delete()
 *   .eq() .neq() .in() .gt() .not() .order() .limit()
 *   .single() .maybeSingle()
 *   rpc()
 *   channel()/removeChannel()  → yoklama tabanlı (gerçek zamanlı soket yok)
 *   storage.from().upload()/getPublicUrl()
 *
 * Daha fazlası kasten yok. İhtiyaç doğarsa buraya eklenir.
 *
 * ---------------------------------------------------------------------------
 * SÖZLEŞME
 * ---------------------------------------------------------------------------
 * Her sorgu `await` edilebilir ve `{ data, error, status }` döner.
 * `error`, PostgREST'in gövdesi olduğu gibi geçer: { code, message, details,
 * hint }. Çağrı yerlerindeki `error.code === 'PGRST116'` ve '42703'
 * kontrolleri bu yüzden aynen çalışmaya devam eder.
 * ============================================================================
 */
(function () {
    'use strict';

    var TEKIL_ACCEPT = 'application/vnd.pgrst.object+json';

    /** Oturum token'ı — PostgREST bunu doğrulayıp JWT'deki role'e geçer. */
    function yetkiBasliklari(temel) {
        var h = new Headers(temel || {});
        var t = window.jetbarkodAuth && window.jetbarkodAuth.get && window.jetbarkodAuth.get();
        if (t) h.set('Authorization', 'Bearer ' + t);
        // Token yoksa istek web_anon olarak gider ve neredeyse hiçbir tabloya
        // erişemez — bu bilinçlidir.
        return h;
    }

    /**
     * Tekil süzgeç değeri.
     *
     * TIRNAK YOK — bilinçli. PostgREST işleçten sonraki İLK noktadan sonrasını
     * değer sayar, dolayısıyla nokta/boşluk/tırnak içeren değerler olduğu gibi
     * gönderilebilir; URL kodlaması zaten serileştirmede yapılıyor.
     * (İlk sürümde nokta içeren her şey tırnaklanıyordu; bu, zaman damgası ve
     * ondalık karşılaştırmalarını supabase-js'in yolladığından farklı bir
     * biçime sokuyordu. Sunucunun yıllardır aldığı biçime sadık kalınıyor.)
     */
    function deger(v) {
        if (v === null || v === undefined) return 'null';
        return String(v);
    }

    /**
     * Liste değeri: `in.(a,b,c)`.
     * Burada tırnak GEREKLİ — virgül ve parantez listeyi böler.
     * supabase-js ile birebir aynı kural.
     */
    function listeDegeri(dizi) {
        var ic = (dizi || [])
            .map(function (v) {
                if (v === null || v === undefined) return 'null';
                var s = String(v);
                return /[,()"]/.test(s) ? '"' + s.replace(/"/g, '\\"') + '"' : s;
            })
            .join(',');
        return '(' + ic + ')';
    }

    function hataYap(kod, mesaj) {
        return { code: kod, message: mesaj, details: null, hint: null };
    }

    // ==================================================================
    // Sorgu kurucusu
    // ==================================================================

    function Sorgu(kok, tablo) {
        this._kok = kok;
        this._tablo = tablo;
        this._yontem = 'GET';
        this._govde = null;
        this._parametreler = [];   // [ad, deger] çiftleri — sıra korunur
        this._prefer = [];
        this._tekil = 0;           // 0 yok · 1 single · 2 maybeSingle
        this._sozVerilen = null;
    }

    Sorgu.prototype._ekle = function (ad, ham) {
        this._parametreler.push([ad, ham]);
        return this;
    };

    // --- Eylemler ---------------------------------------------------

    Sorgu.prototype.select = function (kolonlar) {
        if (this._yontem === 'GET') {
            this._ekle('select', kolonlar || '*');
        } else {
            // insert/update/upsert/delete sonrası .select(): kaydı geri iste
            this._prefer.push('return=representation');
            if (kolonlar) this._ekle('select', kolonlar);
        }
        return this;
    };

    Sorgu.prototype.insert = function (satirlar) {
        this._yontem = 'POST';
        this._govde = satirlar;
        return this;
    };

    Sorgu.prototype.upsert = function (satirlar, secenekler) {
        this._yontem = 'POST';
        this._govde = satirlar;
        this._prefer.push('resolution=merge-duplicates');
        var oc = secenekler && secenekler.onConflict;
        if (oc) this._ekle('on_conflict', oc);
        return this;
    };

    Sorgu.prototype.update = function (nesne) {
        this._yontem = 'PATCH';
        this._govde = nesne;
        return this;
    };

    Sorgu.prototype.delete = function () {
        this._yontem = 'DELETE';
        return this;
    };

    // --- Süzgeçler --------------------------------------------------

    Sorgu.prototype.eq = function (k, v) { return this._ekle(k, 'eq.' + deger(v)); };
    Sorgu.prototype.neq = function (k, v) { return this._ekle(k, 'neq.' + deger(v)); };
    Sorgu.prototype.gt = function (k, v) { return this._ekle(k, 'gt.' + deger(v)); };
    Sorgu.prototype.gte = function (k, v) { return this._ekle(k, 'gte.' + deger(v)); };
    Sorgu.prototype.lt = function (k, v) { return this._ekle(k, 'lt.' + deger(v)); };
    Sorgu.prototype.lte = function (k, v) { return this._ekle(k, 'lte.' + deger(v)); };
    Sorgu.prototype.like = function (k, v) { return this._ekle(k, 'like.' + deger(v)); };
    Sorgu.prototype.ilike = function (k, v) { return this._ekle(k, 'ilike.' + deger(v)); };
    Sorgu.prototype.is = function (k, v) { return this._ekle(k, 'is.' + deger(v)); };
    Sorgu.prototype.in = function (k, dizi) { return this._ekle(k, 'in.' + listeDegeri(dizi)); };
    Sorgu.prototype.not = function (k, islec, v) { return this._ekle(k, 'not.' + islec + '.' + deger(v)); };

    // --- Biçimlendiriciler ------------------------------------------

    Sorgu.prototype.order = function (kolon, secenekler) {
        var artan = !secenekler || secenekler.ascending !== false;
        var ek = '';
        if (secenekler && secenekler.nullsFirst === true) ek = '.nullsfirst';
        else if (secenekler && secenekler.nullsFirst === false) ek = '.nullslast';
        return this._ekle('order', kolon + '.' + (artan ? 'asc' : 'desc') + ek);
    };

    Sorgu.prototype.limit = function (n) { return this._ekle('limit', String(n)); };

    Sorgu.prototype.range = function (bas, son) {
        this._ekle('offset', String(bas));
        return this._ekle('limit', String(son - bas + 1));
    };

    Sorgu.prototype.single = function () { this._tekil = 1; return this; };
    Sorgu.prototype.maybeSingle = function () { this._tekil = 2; return this; };

    // --- Çalıştırma -------------------------------------------------

    Sorgu.prototype._url = function () {
        var qs = this._parametreler
            .map(function (p) { return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1]); })
            .join('&');
        return this._kok + '/rest/v1/' + encodeURIComponent(this._tablo) + (qs ? '?' + qs : '');
    };

    Sorgu.prototype._calistir = function () {
        if (this._sozVerilen) return this._sozVerilen;
        var self = this;

        this._sozVerilen = (async function () {
            var basliklar = yetkiBasliklari({ Accept: self._tekil ? TEKIL_ACCEPT : 'application/json' });
            var init = { method: self._yontem, headers: basliklar };

            if (self._govde !== null && self._govde !== undefined) {
                basliklar.set('Content-Type', 'application/json');
                init.body = JSON.stringify(self._govde);
            }
            if (self._prefer.length) basliklar.set('Prefer', self._prefer.join(','));

            var yanit;
            try {
                yanit = await fetch(self._url(), init);
            } catch (e) {
                // Ağ hatası: PostgREST'ten gövde gelmedi
                return { data: null, error: hataYap('NETWORK', e && e.message ? e.message : 'Ağ hatası'), status: 0 };
            }

            var metin = await yanit.text();
            var govde = null;
            if (metin) {
                try { govde = JSON.parse(metin); } catch (e) { govde = null; }
            }

            if (!yanit.ok) {
                var hata = govde && typeof govde === 'object' && !Array.isArray(govde)
                    ? govde
                    : hataYap(String(yanit.status), metin || yanit.statusText);

                // maybeSingle: "satır yok" bir hata değil, sonucun kendisidir.
                if (self._tekil === 2 && hata.code === 'PGRST116') {
                    return { data: null, error: null, status: yanit.status };
                }
                return { data: null, error: hata, status: yanit.status };
            }

            // 204 / boş gövde: yazma işlemi temsil istemediyse normal
            if (govde === null) return { data: null, error: null, status: yanit.status };
            return { data: govde, error: null, status: yanit.status };
        })();

        return this._sozVerilen;
    };

    // Await edilebilir yap
    Sorgu.prototype.then = function (coz, reddet) { return this._calistir().then(coz, reddet); };
    Sorgu.prototype.catch = function (f) { return this._calistir().catch(f); };
    Sorgu.prototype.finally = function (f) { return this._calistir().finally(f); };

    // ==================================================================
    // Yoklama tabanlı kanallar
    // ------------------------------------------------------------------
    // Gerçek zamanlı soket yok; VPS'te böyle bir uç bulunmuyor. Bunun yerine
    // ilgili tablo periyodik olarak okunup anlık görüntü karşılaştırılıyor.
    // (Bu davranış eski shim'den olduğu gibi taşındı.)
    // ==================================================================

    var yayinUcuVar = true;

    /** Kanal yoklamasında tablo başına çekilecek kolonlar. */
    var YOKLAMA_KOLONLARI = {
        users: 'id,username,premium_features,chat_messages,last_chat_update,counting_data,trial_end,is_active,is_admin',
    };

    function suzgecCoz(f) {
        if (!f || typeof f !== 'string') return null;
        var m = f.match(/^(\w+)=eq\.(.+)$/);
        return m ? { kolon: m[1], deger: m[2] } : null;
    }

    function Kanal(ad, istemci, kok) {
        this.name = ad;
        this._istemci = istemci;
        this._kok = kok;
        this._pg = [];
        this._bc = [];
        this._timer = null;
        this._sonGoruntu = null;
    }

    Kanal.prototype.on = function (tur, suzgec, geri) {
        if (tur === 'postgres_changes') this._pg.push({ suzgec: suzgec, geri: geri });
        else if (tur === 'broadcast') this._bc.push({ suzgec: suzgec, geri: geri });
        return this;
    };

    Kanal.prototype.send = async function (yuk) {
        if (yuk && yuk.event === 'refresh-page' && yuk.payload && yuk.payload.username) {
            await fetch(this._kok + '/api/broadcast/refresh', {
                method: 'POST',
                headers: yetkiBasliklari({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ username: yuk.payload.username }),
            });
        }
        return { status: 'ok' };
    };

    Kanal.prototype.subscribe = function (durumGeri) {
        var self = this;
        setTimeout(function () { if (durumGeri) durumGeri('SUBSCRIBED'); }, 0);
        if (!this._timer) {
            this._timer = setInterval(function () { self._yokla().catch(function () {}); }, 4000);
            this._yokla().catch(function () {});
        }
        return this;
    };

    Kanal.prototype._yokla = async function () {
        for (var i = 0; i < this._pg.length; i++) await this._pgYokla(this._pg[i]);
        for (var j = 0; j < this._bc.length; j++) await this._bcYokla(this._bc[j]);
    };

    Kanal.prototype._pgYokla = async function (h) {
        var tablo = h.suzgec && h.suzgec.table;
        if (!tablo) return;

        // DİKKAT: users tablosunda parola kolonlarına kimsenin SELECT yetkisi
        // yok. PostgreSQL'de kolon bazlı yetki varken `SELECT *` tamamen
        // reddedilir — bu yüzden users için kolonlar açıkça sayılıyor.
        var kolonlar = YOKLAMA_KOLONLARI[tablo] || '*';
        var sorgu = this._istemci.from(tablo).select(kolonlar);
        var s = suzgecCoz(h.suzgec && h.suzgec.filter);
        if (s) sorgu = sorgu.eq(s.kolon, s.deger);

        var sonuc = await sorgu;
        if (sonuc.error) return;

        var goruntu = JSON.stringify(sonuc.data || []);
        if (this._sonGoruntu && this._sonGoruntu !== goruntu) {
            h.geri({
                eventType: h.suzgec && h.suzgec.event === 'INSERT' ? 'INSERT' : 'UPDATE',
                new: Array.isArray(sonuc.data) ? sonuc.data[sonuc.data.length - 1] : sonuc.data,
                old: null,
                schema: (h.suzgec && h.suzgec.schema) || 'public',
                table: tablo,
            });
        }
        this._sonGoruntu = goruntu;
    };

    Kanal.prototype._bcYokla = async function (h) {
        if (!yayinUcuVar) return;
        if (!h.suzgec || h.suzgec.event !== 'refresh-page') return;
        var m = this.name.match(/^user-refresh-(.+)$/);
        if (!m) return;

        var res = await fetch(this._kok + '/api/broadcast/refresh/' + encodeURIComponent(m[1]), {
            headers: yetkiBasliklari(),
        });
        if (res.status === 404 || res.status === 401 || res.status === 403) {
            // Uç yok ya da oturum yok — yoklamayı durdur, konsolu kirletme.
            yayinUcuVar = false;
            return;
        }
        if (!res.ok) return;
        var json = await res.json().catch(function () { return null; });
        if (json && json.pending) {
            h.geri({ event: 'refresh-page', payload: json.payload || { username: m[1] } });
        }
    };

    Kanal.prototype.unsubscribe = async function () {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
    };

    // ==================================================================
    // Dosya deposu
    // ==================================================================

    function depo(kok) {
        return {
            from: function (kova) {
                return {
                    upload: async function (yol, dosya, secenekler) {
                        var res = await fetch(
                            kok + '/storage/v1/object/' + encodeURIComponent(kova) + '/' + yol,
                            {
                                method: 'POST',
                                headers: yetkiBasliklari({
                                    'Content-Type': dosya.type || (secenekler && secenekler.contentType) || 'application/octet-stream',
                                }),
                                body: dosya,
                            }
                        );
                        var json = await res.json().catch(function () { return {}; });
                        if (!res.ok) return { data: null, error: { message: json.error || res.statusText } };
                        return { data: json, error: null };
                    },
                    getPublicUrl: function (yol) {
                        return {
                            data: { publicUrl: kok + '/storage/v1/object/public/' + encodeURIComponent(kova) + '/' + yol },
                        };
                    },
                };
            },
        };
    }

    // ==================================================================
    // İstemci
    // ==================================================================

    function istemciYap(temelUrl) {
        var kok = String(temelUrl || '').replace(/\/$/, '');

        var istemci = {
            from: function (tablo) { return new Sorgu(kok, tablo); },

            rpc: async function (ad, parametreler) {
                var basliklar = yetkiBasliklari({ 'Content-Type': 'application/json', Accept: 'application/json' });
                var res;
                try {
                    res = await fetch(kok + '/rest/v1/rpc/' + encodeURIComponent(ad), {
                        method: 'POST',
                        headers: basliklar,
                        body: JSON.stringify(parametreler || {}),
                    });
                } catch (e) {
                    return { data: null, error: hataYap('NETWORK', e && e.message ? e.message : 'Ağ hatası') };
                }
                var metin = await res.text();
                var govde = null;
                if (metin) { try { govde = JSON.parse(metin); } catch (e) { govde = null; } }
                if (!res.ok) {
                    return {
                        data: null,
                        error: govde && typeof govde === 'object' ? govde : hataYap(String(res.status), metin || res.statusText),
                    };
                }
                return { data: govde, error: null };
            },

            channel: function (ad) { return new Kanal(ad, istemci, kok); },

            removeChannel: async function (kanal) {
                if (kanal && typeof kanal.unsubscribe === 'function') await kanal.unsubscribe();
            },

            storage: depo(kok),
            baseUrl: kok,
        };

        istemci.realtime = { channel: istemci.channel };
        return istemci;
    }

    // Node altında sınanabilsin diye dışa açılıyor
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { istemciYap: istemciYap, Sorgu: Sorgu, deger: deger, listeDegeri: listeDegeri };
    }

    if (typeof window === 'undefined') return;

    // ------------------------------------------------------------------
    // Kurulum
    // ------------------------------------------------------------------
    var cfg = window.JETBARKOD_VPS_API || {};
    var kok = String(cfg.baseUrl || '').replace(/\/$/, '');

    window.jbDb = istemciYap(kok);
    window.__jetbarkodDbMode = 'vps';

    /**
     * Geriye dönük ad. Eski kod `window.supabase` üzerinden çağırıyordu;
     * tüm çağrı yerleri `jbDb`'ye taşındı ama canlı bir sistemde gözden
     * kaçan tek bir satır her şeyi durdurabileceği için bu köprü duruyor.
     * Kullanıldığında bir kez uyarır; konsol temizse güvenle silinebilir.
     */
    var uyarildi = false;
    Object.defineProperty(window, 'supabase', {
        configurable: true,
        get: function () {
            if (!uyarildi) {
                uyarildi = true;
                console.warn('[jb-db] window.supabase artık kullanımdan kalktı; window.jbDb kullanın.');
            }
            return window.jbDb;
        },
        // Yalnızca okunur bir özellik strict mod altında ATAMA'da patlar.
        // Kalan bir atama olsa bile sayfa çökmesin diye sessiz yutucu.
        set: function () {},
    });

    /**
     * Eski kod `jetbarkodWaitForSupabase()` ile istemcinin hazır olmasını
     * beklerdi (CDN yüklemesi asenkrondu). Artık istemci bu dosya
     * çalıştığı anda hazır; bekleme anında çözülür.
     */
    window.jetbarkodWaitForDb = function () { return Promise.resolve(window.jbDb); };
    window.jetbarkodWaitForSupabase = window.jetbarkodWaitForDb;

    window.dispatchEvent(new CustomEvent('jetbarkod-db-ready', { detail: { mode: 'vps' } }));
    window.dispatchEvent(new CustomEvent('jetbarkod-supabase-ready', { detail: { mode: 'vps' } }));
    console.log('✅ DB istemcisi hazır (vps):', kok);
})();
