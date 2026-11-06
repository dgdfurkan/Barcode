/**
 * Bildirim sesleri: dosya yok, Web Audio ile çalınırken üretilir
 * ============================================================================
 *
 * Ses arayuz/ses.html (görünmez belge, arka plan açar) ve Asistan
 * penceresindeki "Dinle" düğmeleri tarafından çalınır. Arka plan yalnız
 * listeyi (SESLER) okur.
 *
 * ÇALGILAR
 *   fm      FM sentezi: oran 1 elektrikli piyano, 1.4 çan, 3.5 parlak zil
 *   cam     sinüs ve iki üst kısmi: cam, rüzgar çanı
 *   telli   iki testere + kapanan alçak geçiren süzgeç: modern "pluck"
 *   marimba, kalimba, yastik (pad), ton (sinüs/kare/testere, süpürme, titreşim)
 * Hepsi kısa bir yankıdan (oda tepkisi) geçer.
 *
 * YÜKSEKLİK
 * Tarayıcı sesi tam ölçeğin üstüne çıkaramaz; duyulan yükseklik dolgunluktan
 * gelir. Zincir: hafif yumuşak kırpma → sıkıştırıcı → telafi kazancı →
 * sınırlayıcı → ses düzeyi. Kırpma hafif tutuldu ki çan ve piyano temiz kalsın.
 * Bilgisayarın ana ses düzeyini bir eklenti değiştiremez.
 *
 * JBASes.cal(ad, { tekrar 1-3, sure sn (desen bu süreyi doldurana kadar
 *            döner; yoksa bir kez), duzey 10-100 }) → çalma süresi (ms)
 * JBASes.dur()      çalanı keser (Dinle düğmesi üst üste binmesin)
 * JBASes.SESLER     [{ ad, baslik, grup }]
 * JBASes.GRUPLAR    [{ ad, baslik }]
 * ============================================================================
 */
(function (global) {
    'use strict';

    var GRUPLAR = [
        { ad: 'yumusak', baslik: 'Yumuşak' },
        { ad: 'belirgin', baslik: 'Belirgin' },
        { ad: 'alarm', baslik: 'Alarm' }
    ];

    var SESLER = [
        { ad: 'cam', baslik: 'Cam', grup: 'yumusak' },
        { ad: 'kristal', baslik: 'Kristal', grup: 'yumusak' },
        { ad: 'damla', baslik: 'Damla', grup: 'yumusak' },
        { ad: 'kalimba', baslik: 'Kalimba', grup: 'yumusak' },
        { ad: 'marimba', baslik: 'Marimba', grup: 'yumusak' },
        { ad: 'piyano', baslik: 'Piyano', grup: 'yumusak' },
        { ad: 'melodi', baslik: 'Melodi', grup: 'yumusak' },
        { ad: 'ruzgar', baslik: 'Rüzgar Çanı', grup: 'yumusak' },
        { ad: 'arp', baslik: 'Arp', grup: 'yumusak' },
        { ad: 'nota', baslik: 'Nota', grup: 'yumusak' },
        { ad: 'basari', baslik: 'Başarı', grup: 'yumusak' },
        { ad: 'mujde', baslik: 'Müjde', grup: 'yumusak' },
        { ad: 'kus', baslik: 'Kuş', grup: 'yumusak' },
        { ad: 'zil', baslik: 'Kapı Zili', grup: 'yumusak' },
        { ad: 'can', baslik: 'Çan', grup: 'yumusak' },
        { ad: 'tapinak', baslik: 'Tapınak Çanı', grup: 'yumusak' },
        { ad: 'kampana', baslik: 'Kampana', grup: 'belirgin' },
        { ad: 'vibrafon', baslik: 'Vibrafon', grup: 'belirgin' },
        { ad: 'nabiz', baslik: 'Nabız', grup: 'belirgin' },
        { ad: 'sonar', baslik: 'Sonar', grup: 'belirgin' },
        { ad: 'gemi', baslik: 'Gemi Çanı', grup: 'belirgin' },
        { ad: 'dijital', baslik: 'Dijital Saat', grup: 'belirgin' },
        { ad: 'alarm', baslik: 'Alarm', grup: 'alarm' },
        { ad: 'yukselen', baslik: 'Yükselen', grup: 'alarm' },
        { ad: 'siren', baslik: 'Siren', grup: 'alarm' },
        { ad: 'acil', baslik: 'Acil Bip', grup: 'alarm' },
        { ad: 'korna', baslik: 'Korna', grup: 'alarm' }
    ];

    /* Notalar (Hz) */
    var N = {
        G4: 392, A4: 440, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
        A5: 880, B5: 987.77, C6: 1046.5, Cd6: 1108.73, D6: 1174.66, E6: 1318.51,
        G6: 1567.98, A6: 1760, B6: 1975.53, C7: 2093, D7: 2349.32, E7: 2637.02
    };

    var baglam = null;
    var giris = null;
    var yankiGiris = null;
    var son = null;
    var hedef = null;
    var oturum = null;

    function kirpmaEgrisi() {
        var n = 2048;
        var e = new Float32Array(n);
        var k = 1.3;
        var olcek = Math.tanh(k);
        for (var i = 0; i < n; i++) {
            var x = (i / (n - 1)) * 2 - 1;
            e[i] = Math.tanh(k * x) / olcek;
        }
        return e;
    }

    /* Kısa oda yankısı: azalan gürültü, iki kanal ayrı */
    function yankiTepkisi(b) {
        var sure = 1.4;
        var n = Math.floor(b.sampleRate * sure);
        var ir = b.createBuffer(2, n, b.sampleRate);
        for (var k = 0; k < 2; k++) {
            var d = ir.getChannelData(k);
            for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.5);
        }
        return ir;
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
            sikistir.threshold.value = -26;
            sikistir.knee.value = 4;
            sikistir.ratio.value = 10;
            sikistir.attack.value = 0.002;
            sikistir.release.value = 0.15;
            var telafi = baglam.createGain();
            telafi.gain.value = 3.4;
            var sinir = baglam.createDynamicsCompressor();
            sinir.threshold.value = -1;
            sinir.knee.value = 0;
            sinir.ratio.value = 20;
            sinir.attack.value = 0.0005;
            sinir.release.value = 0.05;
            son = baglam.createGain();
            var yanki = baglam.createConvolver();
            yanki.buffer = yankiTepkisi(baglam);
            yankiGiris = baglam.createGain();
            yankiGiris.gain.value = 0.22;
            yankiGiris.connect(yanki);
            yanki.connect(giris);
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

    function zarf(g, t0, duzey, sure, atak, sabit) {
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(duzey, t0 + atak);
        if (sabit) g.gain.setValueAtTime(duzey, t0 + Math.max(atak + 0.001, sure - 0.04));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
    }

    /* Tek ton.
       s.sabit: dolu tutulur; yoksa üstel sönüm. s.atak: sn (5 ms).
       s.kayma: [alt, tepe] gidip gelen siren süpürmesi.
       s.supur: [baş, son, sn] bir kez kayan perde.
       s.titre: { hiz Hz, derinlik 0-1 } vibrafon titreşimi. */
    function ton(t0, frekans, sure, duzey, tur, s) {
        s = s || {};
        var o = baglam.createOscillator();
        var g = baglam.createGain();
        o.type = tur || 'sine';
        if (s.kayma) {
            o.frequency.setValueAtTime(s.kayma[0], t0);
            o.frequency.linearRampToValueAtTime(s.kayma[1], t0 + sure / 2);
            o.frequency.linearRampToValueAtTime(s.kayma[0], t0 + sure);
        } else if (s.supur) {
            o.frequency.setValueAtTime(s.supur[0], t0);
            o.frequency.exponentialRampToValueAtTime(s.supur[1], t0 + s.supur[2]);
        } else {
            o.frequency.setValueAtTime(frekans, t0);
        }
        zarf(g, t0, duzey, sure, s.atak || 0.005, s.sabit);
        if (s.titre) {
            var l = baglam.createOscillator();
            var lg = baglam.createGain();
            l.frequency.value = s.titre.hiz;
            lg.gain.value = duzey * s.titre.derinlik;
            l.connect(lg);
            lg.connect(g.gain);
            l.start(t0);
            l.stop(t0 + sure + 0.05);
        }
        o.connect(g);
        g.connect(hedef);
        o.start(t0);
        o.stop(t0 + sure + 0.05);
    }

    /* FM: taşıyıcı f, çarpan f*oran; parlaklık vuruşta yüksek, sonra söner */
    function fm(t0, f, sure, duzey, oran, indeks) {
        var c = baglam.createOscillator();
        var m = baglam.createOscillator();
        var mg = baglam.createGain();
        var g = baglam.createGain();
        c.frequency.value = f;
        m.frequency.value = f * oran;
        var derin = f * oran * indeks;
        mg.gain.setValueAtTime(derin, t0);
        mg.gain.exponentialRampToValueAtTime(Math.max(1, derin * 0.04), t0 + sure * 0.7);
        zarf(g, t0, duzey, sure, 0.003);
        m.connect(mg);
        mg.connect(c.frequency);
        c.connect(g);
        g.connect(hedef);
        m.start(t0);
        c.start(t0);
        m.stop(t0 + sure + 0.05);
        c.stop(t0 + sure + 0.05);
    }

    /* Cam: temel + iki tiz kısmi, tizler daha çabuk söner */
    function cam(t0, f, sure, duzey) {
        ton(t0, f, sure, duzey);
        ton(t0, f * 2.01, sure * 0.55, duzey * 0.3);
        ton(t0, f * 3.98, sure * 0.25, duzey * 0.12);
    }

    /* Telli: iki hafif akortsuz dalga, süzgeç kapanarak söner */
    function telli(t0, f, sure, duzey, tur) {
        var sz = baglam.createBiquadFilter();
        var g = baglam.createGain();
        sz.type = 'lowpass';
        sz.Q.value = 2;
        sz.frequency.setValueAtTime(Math.min(16000, f * 10), t0);
        sz.frequency.exponentialRampToValueAtTime(f * 1.4, t0 + sure * 0.5);
        [1, 1.006].forEach(function (d) {
            var o = baglam.createOscillator();
            o.type = tur || 'sawtooth';
            o.frequency.value = f * d;
            o.connect(sz);
            o.start(t0);
            o.stop(t0 + sure + 0.05);
        });
        zarf(g, t0, duzey, sure, 0.003);
        sz.connect(g);
        g.connect(hedef);
    }

    function marimba(t0, f, sure, duzey) {
        ton(t0, f, sure, duzey);
        ton(t0, f * 4, sure * 0.18, duzey * 0.35);
        ton(t0, f * 9.2, 0.04, duzey * 0.15);
    }

    function kalimba(t0, f, sure, duzey) {
        ton(t0, f, sure, duzey, 'sine', { supur: [f * 1.03, f, 0.03] });
        ton(t0, f * 5.9, sure * 0.12, duzey * 0.2);
        ton(t0, f * 2, sure * 0.4, duzey * 0.15, 'triangle');
    }

    /* Yastık: üç akortsuz testere, yumuşak süzgeç, yavaş atak */
    function yastik(t0, f, sure, duzey) {
        var sz = baglam.createBiquadFilter();
        var g = baglam.createGain();
        sz.type = 'lowpass';
        sz.frequency.value = Math.min(9000, f * 4);
        sz.Q.value = 0.8;
        [-9, 0, 9].forEach(function (d) {
            var o = baglam.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = f;
            o.detune.value = d;
            o.connect(sz);
            o.start(t0);
            o.stop(t0 + sure + 0.05);
        });
        zarf(g, t0, duzey, sure, 0.03, true);
        sz.connect(g);
        g.connect(hedef);
    }

    /* Her desen bir kez çalar, süresini (sn) döndürür */
    var DESEN = {
        cam: function (t) {
            cam(t, N.E6, 1.3, 0.7);
            cam(t + 0.13, N.B6, 1.5, 0.6);
            return 1.35;
        },
        kristal: function (t) {
            fm(t, N.E7, 1.4, 0.45, 3.5, 1.2);
            fm(t + 0.09, N.B6, 1.6, 0.45, 3.5, 1.2);
            cam(t + 0.18, N.E7, 1.2, 0.3);
            return 1.4;
        },
        damla: function (t) {
            [N.A5, N.D6, N.G6].forEach(function (f, i) {
                ton(t + i * 0.16, 0, 0.24, 0.85, 'sine', { supur: [f, f * 1.9, 0.06] });
                ton(t + i * 0.16, 0, 0.12, 0.25, 'triangle', { supur: [f * 2, f * 3.8, 0.06] });
            });
            return 0.65;
        },
        kalimba: function (t) {
            [N.A5, N.Cd6, N.E6, N.A6].forEach(function (f, i) {
                kalimba(t + i * 0.11, f, i === 3 ? 1.4 : 1, 0.7);
            });
            return 1.3;
        },
        marimba: function (t) {
            [N.G5, N.C6, N.E6, N.G6].forEach(function (f, i) {
                marimba(t + i * 0.1, f, i === 3 ? 1.2 : 0.8, 0.75);
            });
            return 1.2;
        },
        piyano: function (t) {
            [N.C6, N.E6, N.G6].forEach(function (f, i) { fm(t + i * 0.025, f, 1.6, 0.42, 1, 1.2); });
            fm(t + 0.35, N.C7, 1.5, 0.42, 1, 1.2);
            return 1.5;
        },
        melodi: function (t) {
            [N.C6, N.E6, N.G6, N.C7].forEach(function (f, i) {
                fm(t + i * 0.15, f, i === 3 ? 1 : 0.5, 0.55, 1, 1.5);
            });
            return 1.1;
        },
        ruzgar: function (t) {
            var notalar = [N.C6, N.E6, N.G6, N.A6, N.D6, N.C7, N.G6, N.E6];
            var anlar = [0, 0.07, 0.15, 0.21, 0.3, 0.36, 0.45, 0.52];
            notalar.forEach(function (f, i) { cam(t + anlar[i], f, 1.4, 0.38); });
            return 1.7;
        },
        arp: function (t) {
            [N.C5, N.E5, N.G5, N.C6, N.E6].forEach(function (f, i) {
                telli(t + i * 0.07, f, i === 4 ? 1 : 0.7, 0.5);
            });
            return 0.95;
        },
        nota: function (t) {
            telli(t, N.G5, 0.8, 0.6);
            telli(t + 0.16, N.D6, 1, 0.6);
            return 0.9;
        },
        basari: function (t) {
            marimba(t, N.C6, 0.5, 0.7);
            marimba(t + 0.1, N.E6, 0.5, 0.7);
            marimba(t + 0.2, N.G6, 1, 0.75);
            cam(t + 0.32, N.C7, 1.2, 0.45);
            return 1.3;
        },
        mujde: function (t) {
            yastik(t, N.G5, 0.13, 0.45);
            yastik(t + 0.16, N.G5, 0.13, 0.45);
            [N.C6, N.E6, N.G6].forEach(function (f) { yastik(t + 0.32, f, 0.7, 0.28); });
            cam(t + 0.34, N.C7, 1, 0.3);
            return 1.1;
        },
        kus: function (t) {
            [0, 0.11, 0.22, 0.45, 0.56].forEach(function (o) {
                ton(t + o, 0, 0.1, 0.75, 'sine', { supur: [1900, 3200, 0.08] });
                ton(t + o, 0, 0.1, 0.25, 'triangle', { supur: [950, 1600, 0.08] });
            });
            return 0.85;
        },
        zil: function (t) {
            fm(t, N.E6, 1.3, 0.6, 3.5, 0.8);
            ton(t, N.E6, 1.3, 0.3);
            fm(t + 0.42, N.C6, 1.6, 0.6, 3.5, 0.8);
            ton(t + 0.42, N.C6, 1.6, 0.3);
            return 1.6;
        },
        can: function (t) {
            fm(t, N.B5, 2.2, 0.75, 1.4, 2.5);
            ton(t, N.B5 * 2, 1, 0.2);
            return 1.9;
        },
        tapinak: function (t) {
            fm(t, N.G4, 3, 0.8, 1.4, 4);
            ton(t, N.G4 * 2.76, 1.6, 0.25);
            ton(t, N.G4 * 5.4, 0.8, 0.12);
            return 2.4;
        },
        kampana: function (t) {
            [N.D6, N.G6, N.B6, N.D7].forEach(function (f, i) {
                fm(t + i * 0.09, f, 0.7, 0.55, 3.5, 1);
                ton(t + i * 0.09, f, 0.2, 0.22, 'square');
            });
            return 0.95;
        },
        vibrafon: function (t) {
            [N.F5, N.A5, N.C6, N.E6].forEach(function (f, i) {
                ton(t + i * 0.16, f, 1.4, 0.6, 'sine', { titre: { hiz: 6, derinlik: 0.35 } });
                ton(t + i * 0.16, f * 4, 0.2, 0.12);
            });
            return 1.7;
        },
        nabiz: function (t) {
            telli(t, N.A5, 0.18, 0.6, 'square');
            telli(t + 0.18, N.A5, 0.18, 0.6, 'square');
            telli(t + 0.36, N.E6, 0.5, 0.7, 'square');
            return 0.9;
        },
        sonar: function (t) {
            [[0, 0.8], [0.32, 0.35], [0.64, 0.15]].forEach(function (y) {
                ton(t + y[0], 1250, 1, y[1]);
                ton(t + y[0], 2500, 0.3, y[1] * 0.2, 'triangle');
            });
            return 1.4;
        },
        gemi: function (t) {
            for (var i = 0; i < 8; i++) fm(t + i * 0.125, i % 2 ? N.C6 : N.E6, 0.5, 0.6, 3.5, 1.2);
            return 1.05;
        },
        dijital: function (t) {
            for (var i = 0; i < 4; i++) {
                ton(t + i * 0.12, N.A6, 0.09, 0.4, 'square', { sabit: true });
                ton(t + i * 0.12, N.A6, 0.09, 0.35, 'triangle', { sabit: true });
            }
            return 1;
        },
        alarm: function (t) {
            for (var i = 0; i < 3; i++) {
                ton(t + i * 0.3, 1396.9, 0.14, 0.7, 'square', { sabit: true });
                ton(t + i * 0.3 + 0.15, 1864.7, 0.14, 0.7, 'square', { sabit: true });
            }
            return 0.95;
        },
        yukselen: function (t) {
            ton(t, 0, 0.6, 0.55, 'sawtooth', { sabit: true, supur: [500, 1600, 0.6] });
            ton(t, 0, 0.6, 0.3, 'square', { sabit: true, supur: [1000, 3200, 0.6] });
            return 0.75;
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

    function dur() {
        if (!oturum || !baglam) return;
        var o = oturum;
        oturum = null;
        try {
            o.gain.setTargetAtTime(0, baglam.currentTime, 0.015);
            setTimeout(function () { try { o.disconnect(); } catch (e) { /* zaten ayrık */ } }, 150);
        } catch (e) { /* bağlam kapandı */ }
    }

    function cal(ad, s) {
        s = s || {};
        var b = hazirla();
        var desen = DESEN[ad] || DESEN.cam;
        var n = Math.max(1, Math.min(3, Number(s.tekrar) || 1));
        var sure = Math.max(0, Math.min(15, Number(s.sure) || 0));
        var duzey = Math.max(10, Math.min(100, Number(s.duzey) || 100)) / 100;
        // 0.9: sınırlayıcının ince taşması tam ölçekte kırpılmasın
        son.gain.setValueAtTime(duzey * 0.9, b.currentTime);
        oturum = b.createGain();
        oturum.connect(giris);
        oturum.connect(yankiGiris);
        hedef = oturum;
        var t = b.currentTime + 0.05;
        for (var i = 0; i < n; i++) t += blok(desen, t, sure) + (sure ? 0.6 : 0.35);
        return Math.round((t - b.currentTime) * 1000);
    }

    global.JBASes = { cal: cal, dur: dur, SESLER: SESLER, GRUPLAR: GRUPLAR };
})(globalThis);
