/**
 * Günlük sayım — kontrol paneli verisi (format netleşince genişletilecek).
 * counting.js, seçilen günlük tarih tablosuna satır çekerken bu modülü kullanır.
 */
(function () {
    'use strict';

    /**
     * @typedef {Object} DailyCountRow
     * @property {string} [barcode] - Öncelikli eşleştirme
     * @property {string} [name] - Barkod yoksa ürün adı ile arama
     * @property {number} [quantity] - Varsa depo sayımına yazılır
     */

    window.DailyCountImport = {
        /**
         * Belirtilen gün için kontrol panelindeki günlük sayım satırları.
         * TODO: Kontrol paneli API / export formatına bağlanacak.
         * @param {string} isoDate - YYYY-MM-DD (yerel gün)
         * @returns {Promise<DailyCountRow[]>}
         */
        async fetchDailyRowsForDate(isoDate) {
            if (window.__DAILY_COUNT_MOCK_ROWS && Array.isArray(window.__DAILY_COUNT_MOCK_ROWS)) {
                return window.__DAILY_COUNT_MOCK_ROWS;
            }
            // Geliştirme: örnek satır yok — boş döner; bağlantı sonrası doldurulacak
            void isoDate;
            return [];
        },
    };
})();
