/**
 * Barkod görseli (EAN-13 / Code128 SVG) — product_search ile aynı mantık.
 * JsBarcode gerekir (EAN-13 için).
 */
(function (global) {
    'use strict';

    const CODE128_CHARSET = {
        ' ': 0, '!': 1, '"': 2, '#': 3, '$': 4, '%': 5, '&': 6, "'": 7,
        '(': 8, ')': 9, '*': 10, '+': 11, ',': 12, '-': 13, '.': 14, '/': 15,
        '0': 16, '1': 17, '2': 18, '3': 19, '4': 20, '5': 21, '6': 22, '7': 23,
        '8': 24, '9': 25, ':': 26, ';': 27, '<': 28, '=': 29, '>': 30, '?': 31,
        '@': 32, 'A': 33, 'B': 34, 'C': 35, 'D': 36, 'E': 37, 'F': 38, 'G': 39,
        'H': 40, 'I': 41, 'J': 42, 'K': 43, 'L': 44, 'M': 45, 'N': 46, 'O': 47,
        'P': 48, 'Q': 49, 'R': 50, 'S': 51, 'T': 52, 'U': 53, 'V': 54, 'W': 55,
        'X': 56, 'Y': 57, 'Z': 58, '[': 59, '\\': 60, ']': 61, '^': 62, '_': 63,
        '`': 64, 'a': 65, 'b': 66, 'c': 67, 'd': 68, 'e': 69, 'f': 70, 'g': 71,
        'h': 72, 'i': 73, 'j': 74, 'k': 75, 'l': 76, 'm': 77, 'n': 78, 'o': 79,
        'p': 80, 'q': 81, 'r': 82, 's': 83, 't': 84, 'u': 85, 'v': 86, 'w': 87,
        'x': 88, 'y': 89, 'z': 90, '{': 91, '|': 92, '}': 93, '~': 94, 'DEL': 95,
    };

    const CODE128_PATTERNS = [
        '11011001100', '11001101100', '11001100110', '10010011000', '10010001100', '10001001100', '10011001000', '10011000100',
        '10001100100', '11001001000', '11001000100', '11000100100', '10110011100', '10011011100', '10011001110', '10111001100',
        '10011101100', '10011100110', '11001110010', '11001011100', '11001001110', '11011100100', '11001110100', '11101101110',
        '11101001100', '11100101100', '11100100110', '11101100100', '11100110100', '11100110010', '11011011000', '11011000110',
        '11000110110', '10100011000', '10001011000', '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
        '11000101000', '11000100010', '10110111000', '10110001110', '10001101110', '10111011000', '10111000110', '10001110110',
        '11101110110', '11010001110', '11000101110', '11011101000', '11011100010', '11011101110', '11101011000', '11101000110',
        '11100010110', '11101101000', '11101100010', '11100011010', '11101111010', '11001000010', '11110001010', '10100110000',
        '10100001100', '10010110000', '10010000110', '10000101100', '10000100110', '10110010000', '10110000100', '10011010000',
        '10011000010', '10000110100', '10000110010', '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
        '10100111100', '10010111100', '10010011110', '10111100100', '10011110100', '10011110010', '11110100100', '11110010100',
        '11110010010', '11011011110', '11011110110', '11110110110', '10101111000', '10100011110', '10001011110', '10111101000',
        '10111100010', '11110101000', '11110100010', '10111011110', '10111101110', '11101011110', '11110101110', '11010000100',
        '11010010000', '11010011100', '1100011101011',
    ];

    function calculateEan13Checksum(code) {
        if (code.length < 12) return null;
        let sum = 0;
        for (let i = 0; i < 12; i++) {
            sum += parseInt(code[i], 10) * (i % 2 === 0 ? 1 : 3);
        }
        const r = sum % 10;
        return r === 0 ? 0 : 10 - r;
    }

    function isEan13Compatible(text) {
        if (!text || typeof text !== 'string') return false;
        const digits = text.replace(/\D/g, '');
        return digits.length === 12 || digits.length === 13;
    }

    function normalizeToEan13(text) {
        const digits = String(text).replace(/\D/g, '');
        if (digits.length === 12) return digits + calculateEan13Checksum(digits);
        if (digits.length === 13) return digits;
        return null;
    }

    function generateEan13SVG(code, width, height) {
        const w = width || 300;
        const h = height || 80;
        const ean = normalizeToEan13(code);
        if (!ean || typeof global.JsBarcode === 'undefined') return null;
        try {
            const wrap = document.createElement('div');
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            wrap.appendChild(svg);
            wrap.style.cssText = 'position:absolute;left:-9999px;top:0;';
            document.body.appendChild(wrap);
            const barHeight = Math.max(24, (h - 20) * 0.72);
            global.JsBarcode(svg, ean, {
                format: 'EAN13',
                lineColor: '#000000',
                width: 2,
                height: barHeight,
                displayValue: true,
                fontSize: Math.max(11, Math.round(h * 0.18)),
                fontOptions: 'bold',
                background: 'transparent',
                margin: 2,
            });
            svg.setAttribute('width', String(w));
            svg.setAttribute('height', String(h));
            const html = wrap.innerHTML;
            document.body.removeChild(wrap);
            return html;
        } catch (e) {
            return null;
        }
    }

    function generateCode128SVG(text, width, height) {
        const w = width || 300;
        const h = height || 80;
        try {
            let checksum = 104;
            const encoded = [];
            encoded.push(CODE128_PATTERNS[104]);
            for (let i = 0; i < text.length; i++) {
                const value = CODE128_CHARSET[text.charAt(i)];
                if (value !== undefined) {
                    encoded.push(CODE128_PATTERNS[value]);
                    checksum += value * (i + 1);
                }
            }
            checksum = checksum % 103;
            encoded.push(CODE128_PATTERNS[checksum]);
            encoded.push('1100011101011');
            const barString = encoded.join('');
            const barWidth = w / barString.length;
            let svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
            svg += `<rect width="${w}" height="${h}" fill="white"/>`;
            let x = 0;
            for (let i = 0; i < barString.length; i++) {
                if (barString[i] === '1') {
                    svg += `<rect x="${x}" y="4" width="${barWidth}" height="${h - 22}" fill="black"/>`;
                }
                x += barWidth;
            }
            const fontSize = h >= 56 ? 12 : 10;
            svg += `<text x="${w / 2}" y="${h - 4}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" fill="black" font-weight="500">${text}</text>`;
            svg += '</svg>';
            return svg;
        } catch (e) {
            return null;
        }
    }

    function generateBarcodeSVG(text, width, height) {
        const s = String(text || '').trim();
        if (!s) return null;
        if (isEan13Compatible(s)) {
            const eanSvg = generateEan13SVG(s, width, height);
            if (eanSvg) return eanSvg;
        }
        return generateCode128SVG(s, width, height);
    }

    global.BarcodeVisual = {
        isEan13Compatible,
        generateBarcodeSVG,
        generateEan13SVG,
        generateCode128SVG,
    };
})(typeof window !== 'undefined' ? window : globalThis);
