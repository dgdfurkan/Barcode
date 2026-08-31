/**
 * Giriş sayfası arka planı: canlı gradyan.
 * ============================================================================
 *
 * WebGL üzerinde simplex gürültüsüyle çizilen, çok yavaş akan bir zemin.
 * Kaynağı bir React bileşeniydi; projede derleme adımı olmadığı için
 * shader'ı alıp saf JavaScript'e taşıdım. Ekleme yapılan kütüphane yok.
 *
 * RENK: NEDEN GÖKKUŞAĞI DEĞİL
 * Örnekteki palet yeşilden siyaha geçen canlı bir karışımdı. Bizim
 * paletimiz derin mürekkep zemin ve tek bir mavi (logodaki #135bec) etrafında
 * dönen tonlar. İki farklı renk arasında geçen parlak degradeler ısmarlama
 * değil şablon hissi veriyor; burada renk bir efekt değil, kartın arkasında
 * duran sessiz bir zemin.
 *
 * PERFORMANS
 * Tam ekran bir fragment shader, üç oktav gürültüyle, düşük güçlü bir
 * bilgisayarda pahalı. Üç önlem var:
 *   1. Gerçek çözünürlüğün yarısında çiziliyor. Gürültü zaten yumuşak;
 *      büyütülünce fark edilmiyor ama piksel sayısı dörtte bire iniyor.
 *   2. Saniyede otuz kare. Zemin çok yavaş aktığı için altmış kare
 *      gereksiz; yarısı aynı görünüyor, yarısı kadar iş yapıyor.
 *   3. Sekme arkada kalınca döngü tamamen duruyor.
 *
 * ÇALIŞMAZSA
 * WebGL yoksa, bağlam kaybolursa ya da kullanıcı hareket azaltma seçtiyse
 * tuval hiç kurulmuyor. Arkada CSS ile çizilmiş sabit bir zemin var; sayfa
 * her koşulda dolu görünüyor.
 * ============================================================================
 */
(function () {
    'use strict';

    // Dipteki yıl: elle güncellenen bir sayı geride kalıyor
    var yil = document.getElementById('girisYil');
    if (yil) yil.textContent = new Date().getFullYear();

    var tuval = document.getElementById('girisTuval');
    if (!tuval) return;

    var azHareket = window.matchMedia &&
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (azHareket) return;

    var gl = null;
    try {
        gl = tuval.getContext('webgl', { antialias: false, alpha: false, depth: false,
                                         powerPreference: 'low-power' }) ||
             tuval.getContext('experimental-webgl');
    } catch (e) { gl = null; }
    if (!gl) return;

    var KOSE = [
        'attribute vec2 konum;',
        'varying vec2 vUv;',
        'void main() {',
        '  vUv = konum * 0.5 + 0.5;',
        '  gl_Position = vec4(konum, 0.0, 1.0);',
        '}'
    ].join('\n');

    var PARCA = [
        'precision mediump float;',
        'varying vec2 vUv;',
        'uniform vec2 u_olcu;',
        'uniform float u_zaman;',
        'uniform vec3 u_renk[4];',
        'uniform vec3 u_zemin;',
        '',
        'vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }',
        '',
        'float gurultu(vec2 v) {',
        '  const vec4 C = vec4(0.211324865405187, 0.366025403784439,',
        '                     -0.577350269189626, 0.024390243902439);',
        '  vec2 i  = floor(v + dot(v, C.yy));',
        '  vec2 x0 = v - i + dot(i, C.xx);',
        '  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);',
        '  vec4 x12 = x0.xyxy + C.xxzz;',
        '  x12.xy -= i1;',
        '  i = mod(i, 289.0);',
        '  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));',
        '  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);',
        '  m = m*m; m = m*m;',
        '  vec3 x = 2.0 * fract(p * C.www) - 1.0;',
        '  vec3 h = abs(x) - 0.5;',
        '  vec3 ox = floor(x + 0.5);',
        '  vec3 a0 = x - ox;',
        '  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);',
        '  vec3 g;',
        '  g.x  = a0.x  * x0.x  + h.x  * x0.y;',
        '  g.yz = a0.yz * x12.xz + h.yz * x12.yw;',
        '  return 130.0 * dot(m, g);',
        '}',
        '',
        'void main() {',
        '  vec2 uv = vUv;',
        '  float oran = u_olcu.x / max(u_olcu.y, 1.0);',
        '  vec2 p = uv - 0.5;',
        '  p.x *= oran;',
        '',
        '  float t = u_zaman * 0.06;',
        '',
        '  float n1 = gurultu(p * 0.85 + vec2(t * 0.20, -t * 0.28));',
        '  float n2 = gurultu(p * 1.20 + vec2(-t * 0.16, t * 0.22) + n1 * 0.25);',
        '  float n3 = gurultu(p * 1.70 + vec2(t * 0.11, -t * 0.18) + n2 * 0.20);',
        '',
        '  vec3 renk = u_zemin;',
        '  /* Karışım oranları düşük: renk zemini boyamıyor, üstünde geziniyor. */',
        '  renk = mix(renk, u_renk[0], smoothstep(-0.10, 0.75, n1) * 0.55);',
        '  renk = mix(renk, u_renk[1], smoothstep( 0.05, 0.80, n2) * 0.32);',
        '  renk = mix(renk, u_renk[2], smoothstep(-0.20, 0.60, n3) * 0.26);',
        '  renk = mix(renk, u_renk[3], smoothstep( 0.15, 0.85, n1 * n2) * 0.30);',
        '',
        '  /* Kenarlar koyulaşıyor: giriş kartı ortada, gözü ortada tutuyor. */',
        '  float uzaklik = length(p) * 1.35;',
        '  float kenar = 1.0 - smoothstep(0.25, 1.15, uzaklik);',
        '  renk = mix(renk * 0.28, renk, kenar);',
        '',
        '  /* Çok hafif tane: düz degradenin bant bant görünmesini kırıyor. */',
        '  float tane = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);',
        '  renk += (tane - 0.5) * 0.022;',
        '',
        '  gl_FragColor = vec4(renk, 1.0);',
        '}'
    ].join('\n');

    function shader(tur, kaynak) {
        var s = gl.createShader(tur);
        gl.shaderSource(s, kaynak);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
        return s;
    }

    var vs = shader(gl.VERTEX_SHADER, KOSE);
    var fs = shader(gl.FRAGMENT_SHADER, PARCA);
    if (!vs || !fs) return;

    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    var arabellek = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, arabellek);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var konum = gl.getAttribLocation(program, 'konum');
    gl.enableVertexAttribArray(konum);
    gl.vertexAttribPointer(konum, 2, gl.FLOAT, false, 0, 0);

    var yer = {
        olcu: gl.getUniformLocation(program, 'u_olcu'),
        zaman: gl.getUniformLocation(program, 'u_zaman'),
        renk: gl.getUniformLocation(program, 'u_renk'),
        zemin: gl.getUniformLocation(program, 'u_zemin')
    };

    function rgb(hex) {
        var h = hex.replace('#', '');
        return [parseInt(h.slice(0, 2), 16) / 255,
                parseInt(h.slice(2, 4), 16) / 255,
                parseInt(h.slice(4, 6), 16) / 255];
    }

    /* Logodaki mavinin etrafında tonlar. Dördüncüsü neredeyse siyah:
       zeminin çoğu koyu kalsın, mavi sadece geçsin. */
    var ZEMIN = '#050810';
    var RENKLER = ['#0e2a63', '#135bec', '#123a86', '#04060c'];

    var duzRenk = new Float32Array(RENKLER.reduce(function (t, h) { return t.concat(rgb(h)); }, []));
    var zeminRgb = rgb(ZEMIN);

    gl.uniform3fv(yer.renk, duzRenk);
    gl.uniform3f(yer.zemin, zeminRgb[0], zeminRgb[1], zeminRgb[2]);

    /* Gerçek çözünürlüğün yarısı. Gürültü yumuşak olduğu için büyütülmesi
       fark edilmiyor; piksel sayısı dörtte bire iniyor. */
    var OLCEK = 0.5;

    function boyutla() {
        var g = Math.max(1, Math.round(window.innerWidth * OLCEK));
        var y = Math.max(1, Math.round(window.innerHeight * OLCEK));
        if (tuval.width === g && tuval.height === y) return;
        tuval.width = g;
        tuval.height = y;
        gl.viewport(0, 0, g, y);
        gl.uniform2f(yer.olcu, g, y);
    }

    boyutla();
    window.addEventListener('resize', boyutla, { passive: true });

    var KARE_ARALIGI = 1000 / 30;   // saniyede otuz kare yeter
    var sonKare = 0;
    var istek = 0;
    var calisiyor = false;

    function ciz(t) {
        istek = requestAnimationFrame(ciz);
        if (t - sonKare < KARE_ARALIGI) return;
        sonKare = t;
        gl.uniform1f(yer.zaman, t * 0.001);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function basla() {
        if (calisiyor) return;
        calisiyor = true;
        sonKare = 0;
        istek = requestAnimationFrame(ciz);
    }

    function dur() {
        calisiyor = false;
        if (istek) { cancelAnimationFrame(istek); istek = 0; }
    }

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) dur(); else basla();
    });

    /* Bağlam kaybolursa (sürücü sıfırlaması, sekme belleği) döngü durur ve
       arkadaki CSS zemin görünür kalır. Hata mesajı çıkmaz. */
    tuval.addEventListener('webglcontextlost', function (e) {
        e.preventDefault();
        dur();
        tuval.classList.remove('hazir');
    });

    tuval.classList.add('hazir');
    basla();
})();
