/**
 * Bildirim sesleri: dosya yok, Web Audio ile çalınırken üretilir
 * ============================================================================
 *
 * Ses arayuz/ses.html (görünmez belge, arka plan açar) ve Asistan
 * penceresindeki "Dinle" düğmeleri tarafından çalınır.
 *
 * YÜKSEKLİK
 * Tarayıcı sesi tam ölçeğin üstüne çıkaramaz; duyulan yükseklik dolgunluktan
 * gelir. Bu yüzden:
 *   - tonlar kulağın en duyarlı olduğu 1-3 kHz aralığında, kare ve testere
 *     dalgayla (bol üst harmonik, keskin);
 *   - zincir: yumuşak kırpma → sıkıştırıcı → telafi kazancı → sınırlayıcı;
 *     sessiz kuyruklar yükseltilir, ses tam ölçeğe yakın kalır;
 *   - ses düzeyi en sonda, sınırlayıcıdan sonra (ayar doğrusal davranır).
 * Bilgisayarın ana ses düzeyini bir eklenti değiştiremez.
 *
 * JBASes.cal(ad, { tekrar 1-3, sure sn (desen bu süreyi doldurana kadar
 *            döner; yoksa bir kez), duzey 10-100 }) → çalma süresi (ms)
 * JBASes.SESLER → [{ ad, baslik }]
 * ============================================================================
 */
(function (global) {
    'use strict';

    var SESLER = [
        { ad: 'zil', baslik: 'Kapı Zili' },
        { ad: 'can', baslik: 'Çan' },
        { ad: 'melodi', baslik: 'Melodi' },
        { ad: 'kampana', baslik: 'Kampana' },
        { ad: 'alarm', baslik: 'Alarm' },
        { ad: 'siren', baslik: 'Siren' },
        { ad: 'acil', baslik: 'Acil Bip' },
        { ad: 'korna', baslik: 'Korna' }
    ];

    var baglam = null;
    var giris = null;
    var son = null;

    function kirpmaEgrisi() {
        var n = 2048;
        var e = new Float32Array(n);
        var k = 2.2;
        var olcek = Math.tanh(k);
        for (var i = 0; i < n; i++) {
            var x = (i / (n - 1)) * 2 - 1;
            e[i] = Math.tanh(k * x) / olcek;
        }
        return e;
    }

    function hazirla() {
        if (!baglam || baglam.state === 'closed') {
            baglam = new (global.AudioContext || global.webkitAudioContext)();
            giris = baglam.createGain();
            giris.gain.value = 0.9;
            var kirp = baglam.createWaveShaper();
            kirp.curve = kirpmaEgrisi();
            kirp.oversample = '4x';
            var sikistir = baglam.createDynamicsCompressor();
            sikistir.threshold.value = -24;
            sikistir.knee.value = 0;
            sikistir.ratio.value = 12;
            sikistir.attack.value = 0.001;
            sikistir.release.value = 0.12;
            var telafi = baglam.createGain();
            telafi.gain.value = 3.2;
            var sinir = baglam.createDynamicsCompressor();
            sinir.threshold.value = -1;
            sinir.knee.value = 0;
            sinir.ratio.value = 20;
            sinir.attack.value = 0.0005;
            sinir.release.value = 0.05;
            son = baglam.createGain();
            giris.connect(kirp);
            kirp.connect(sikistir);
            sikistir.connect(telafi);
            telafi.connect(sinir);
            sinir.connect(son);
            son.connect(baglam.destination);
        }
        if (baglam.state === 'suspended') baglam.resume();
        return baglam;
    }

    /* Tek ton. s.sabit: dolu tutulur (atak 5 ms, bırakma 40 ms); yoksa üstel sönüm.
       s.kayma: [başlangıç, tepe] frekansla gidip gelen siren süpürmesi. */
    function ton(t0, frekans, sure, duzey, tur, s) {
        s = s || {};
        var o = baglam.createOscillator();
        var g = baglam.createGain();
        o.type = tur || 'sine';
        if (s.kayma) {
            o.frequency.setValueAtTime(s.kayma[0], t0);
            o.frequency.linearRampToValueAtTime(s.kayma[1], t0 + sure / 2);
            o.frequency.linearRampToValueAtTime(s.kayma[0], t0 + sure);
        } else {
            o.frequency.setValueAtTime(frekans, t0);
        }
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(duzey, t0 + 0.005);
        if (s.sabit) {
            g.gain.setValueAtTime(duzey, t0 + Math.max(0.006, sure - 0.04));
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
        } else {
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
        }
        o.connect(g);
        g.connect(giris);
        o.start(t0);
        o.stop(t0 + sure + 0.05);
    }

    /* Çan rengi: gerçek çanın uyumsuz kısmileri, üstüne parlaklık için kare katman */
    function canSesi(t0, frekans, sure, duzey) {
        [[1, 1], [2.76, 0.55], [5.4, 0.35], [8.93, 0.2]].forEach(function (k, i) {
            ton(t0, frekans * k[0], sure / (1 + i * 0.5), duzey * k[1]);
        });
        ton(t0, frekans, sure * 0.6, duzey * 0.3, 'square');
    }

    /* Her desen bir kez çalar, süresini (sn) döndürür */
    var DESEN = {
        zil: function (t) {
            canSesi(t, 1318.5, 1, 0.8);
            canSesi(t + 0.4, 1046.5, 1.3, 0.8);
            return 1.45;
        },
        can: function (t) {
            canSesi(t, 987.8, 1.8, 0.9);
            return 1.6;
        },
        melodi: function (t) {
            [1046.5, 1318.5, 1568, 2093].forEach(function (f, i) {
                var uzun = i === 3;
                ton(t + i * 0.15, f, uzun ? 0.5 : 0.14, 0.55, 'square', { sabit: true });
                ton(t + i * 0.15, f, uzun ? 0.6 : 0.2, 0.5, 'triangle');
            });
            return 1.05;
        },
        kampana: function (t) {
            [1174.7, 1568, 1975.5, 2349.3].forEach(function (f, i) {
                ton(t + i * 0.09, f, 0.6, 0.6, 'triangle');
                ton(t + i * 0.09, f, 0.25, 0.35, 'square');
            });
            return 0.95;
        },
        alarm: function (t) {
            for (var i = 0; i < 3; i++) {
                ton(t + i * 0.3, 1396.9, 0.14, 0.7, 'square', { sabit: true });
                ton(t + i * 0.3 + 0.15, 1864.7, 0.14, 0.7, 'square', { sabit: true });
            }
            return 0.95;
        },
        siren: function (t) {
            ton(t, 0, 0.9, 0.6, 'sawtooth', { sabit: true, kayma: [700, 1600] });
            ton(t, 0, 0.9, 0.4, 'square', { sabit: true, kayma: [1400, 3200] });
            return 0.9;
        },
        acil: function (t) {
            for (var i = 0; i < 8; i++) {
                var f = i % 2 ? 2489 : 2093;
                ton(t + i * 0.12, f, 0.07, 0.75, 'square', { sabit: true });
            }
            return 0.96;
        },
        korna: function (t) {
            [0, 0.42].forEach(function (b) {
                ton(t + b, 466.2, 0.32, 0.5, 'sawtooth', { sabit: true });
                ton(t + b, 587.3, 0.32, 0.5, 'sawtooth', { sabit: true });
                ton(t + b, 1174.7, 0.32, 0.35, 'square', { sabit: true });
            });
            return 0.8;
        }
    };

    /* Bir blok: süre verilmişse desen o süreyi doldurana kadar döner */
    function blok(desen, t, sure) {
        if (!sure) return desen(t);
        var gecen = 0;
        while (gecen < sure - 0.1) gecen += desen(t + gecen) + 0.12;
        return gecen;
    }

    function cal(ad, s) {
        s = s || {};
        var b = hazirla();
        var desen = DESEN[ad] || DESEN.zil;
        var n = Math.max(1, Math.min(3, Number(s.tekrar) || 1));
        var sure = Math.max(0, Math.min(15, Number(s.sure) || 0));
        var duzey = Math.max(10, Math.min(100, Number(s.duzey) || 100)) / 100;
        // 0.94: sınırlayıcının ince taşması tam ölçekte kırpılmasın
        son.gain.setValueAtTime(duzey * 0.94, b.currentTime);
        var t = b.currentTime + 0.05;
        for (var i = 0; i < n; i++) t += blok(desen, t, sure) + (sure ? 0.6 : 0.35);
        return Math.round((t - b.currentTime) * 1000);
    }

    global.JBASes = { cal: cal, SESLER: SESLER };
})(globalThis);
