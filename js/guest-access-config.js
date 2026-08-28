/**
 * Geçici misafir erişimi — DB kapalıyken şifresiz giriş + hoş geldin ekranı.
 * Kapatmak için yalnızca enabled: false yapın ve deploy edin.
 */
window.JETBARKOD_GUEST_ACCESS = {
    enabled: false,
    contactEmail: 'furkan@flowcobalt.com',
    welcomeStorageKey: 'jetbarkod_welcome_seen_v1',
    /** Misafir modunda açık premium özellikler */
    guestPremiumFeatures: ['autoPaste', 'bulkCopy'],
};
