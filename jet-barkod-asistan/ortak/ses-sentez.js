/**
 * Bildirim sesleri: dosya yok, Web Audio ile çalınırken üretilir
 * ============================================================================
 *
 * Ses arayuz/ses.html (görünmez belge, arka plan açar) ve Asistan
 * penceresindeki "Dinle" düğmesi tarafından çalınır. Ses düzeyi en
 * yüksekte; sıkıştırıcı tepe noktalarını kırpıp sesi dolgun tutar.
 * Bilgisayarın ana ses düzeyini bir eklenti değiştiremez.
 *
 * JBASes.cal(ad, tekrar) → çalma süresi (ms)
 * JBASes.SESLER          → [{ ad, baslik }]
 * ============================================================================
 */
(function (global) {
    'use strict';

    var SESLER = [
        { ad: 'zil', baslik: 'Kapı Zili' },
        { ad: 'can', baslik: 'Çan' },
        { ad: 'melodi', baslik: 'Melodi' },
        { ad: 'kampana', baslik: 'Kampana' },
        { ad: 'alarm', baslik: 'Alarm' }
    ];

    var baglam = null;
    var cikis = null;

    function hazirla() {
        if (!baglam || baglam.state === 'closed') {
            baglam = new (global.AudioContext || global.webkitAudioContext)();
            var sikistir = baglam.createDynamicsCompressor();
            sikistir.threshold.value = -10;
            sikistir.knee.value = 6;
            sikistir.ratio.value = 8;
            sikistir.attack.value = 0.002;
            sikistir.release.value = 0.2;
            cikis = baglam.createGain();
            cikis.gain.value = 1.6;
            cikis.connect(sikistir);
            sikistir.connect(baglam.destination);
        }
        if (baglam.state === 'suspended') baglam.resume();
        return baglam;
    }

    /* Tek ton: tür, frekans, başlangıç, süre, düzey; hızlı atak, üstel sönüm */
    function ton(t0, frekans, sure, duzey, tur) {
        var o = baglam.createOscillator();
        var g = baglam.createGain();
        o.type = tur || 'sine';
        o.frequency.setValueAtTime(frekans, t0);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(duzey, t0 + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
        o.connect(g);
        g.connect(cikis);
        o.start(t0);
        o.stop(t0 + sure + 0.05);
    }

    /* Çan rengi: temel ve uyumsuz üst kısmiler (gerçek çanın oranları) */
    function canSesi(t0, frekans, sure, duzey) {
        [[1, 1], [2.76, 0.45], [5.4, 0.25], [8.93, 0.12]].forEach(function (k, i) {
            ton(t0, frekans * k[0], sure / (1 + i * 0.6), duzey * k[1]);
        });
    }

    /* Her desen bir kez çalar, süresini (sn) döndürür */
    var DESEN = {
        zil: function (t) {
            canSesi(t, 1318.5, 1.1, 0.9);
            canSesi(t + 0.42, 1046.5, 1.5, 0.9);
            return 1.6;
        },
        can: function (t) {
            canSesi(t, 880, 2.2, 1);
            return 1.9;
        },
        melodi: function (t) {
            [1046.5, 1318.5, 1568].forEach(function (f, i) {
                ton(t + i * 0.16, f, i === 2 ? 0.9 : 0.35, 0.8);
                ton(t + i * 0.16, f * 2, i === 2 ? 0.5 : 0.2, 0.25);
            });
            return 1.2;
        },
        kampana: function (t) {
            [784, 987.8, 1174.7, 1568].forEach(function (f, i) {
                ton(t + i * 0.09, f, 0.7, 0.7, 'triangle');
            });
            return 1;
        },
        alarm: function (t) {
            for (var i = 0; i < 3; i++) {
                ton(t + i * 0.28, 1046.5, 0.13, 0.55, 'square');
                ton(t + i * 0.28 + 0.13, 1396.9, 0.13, 0.55, 'square');
            }
            return 0.95;
        }
    };

    function cal(ad, tekrar) {
        var b = hazirla();
        var desen = DESEN[ad] || DESEN.zil;
        var n = tekrar === 3 ? 3 : 1;
        var t = b.currentTime + 0.05;
        for (var i = 0; i < n; i++) t += desen(t) + 0.35;
        return Math.round((t - b.currentTime) * 1000);
    }

    global.JBASes = { cal: cal, SESLER: SESLER };
})(globalThis);
