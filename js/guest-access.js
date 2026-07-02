(function () {
    'use strict';

    const cfg = () => window.JETBARKOD_GUEST_ACCESS || {};
    const isEnabled = () => cfg().enabled === true;
    const storageKey = () => cfg().welcomeStorageKey || 'jetbarkod_welcome_seen_v1';

    function hasSeenWelcome() {
        try {
            return localStorage.getItem(storageKey()) === '1';
        } catch (e) {
            return false;
        }
    }

    function markWelcomeSeen() {
        try {
            localStorage.setItem(storageKey(), '1');
        } catch (e) {
            /* ignore */
        }
    }

    function createGuestSession() {
        const sessionData = {
            username: 'Misafir',
            company: 'Jet Barkod',
            trialEnd: '2099-12-31T23:59:59.999Z',
            isAdmin: false,
            isGuest: true,
            loginTime: new Date().toISOString(),
            clientIP: '',
        };
        try {
            localStorage.setItem('userSession', JSON.stringify(sessionData));
            localStorage.setItem(
                'authToken',
                btoa(unescape(encodeURIComponent(JSON.stringify(sessionData))))
            );
        } catch (e) {
            console.warn('Guest session kaydedilemedi:', e);
        }
        return sessionData;
    }

    function goToProductSearch() {
        window.location.replace('pages/product_search.html');
    }

    function enterGuestApp() {
        markWelcomeSeen();
        createGuestSession();
        goToProductSearch();
    }

    function getGuestPremiumFeatures() {
        const list = cfg().guestPremiumFeatures;
        return Array.isArray(list) ? list.slice() : ['autoPaste', 'bulkCopy', 'imageSearch'];
    }

    function injectWelcomeStyles() {
        if (document.getElementById('guestWelcomeStyles')) return;
        const style = document.createElement('style');
        style.id = 'guestWelcomeStyles';
        style.textContent = `
            @keyframes gwBackdropIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes gwCardIn {
                0% { opacity: 0; transform: translateY(28px) scale(0.94); filter: blur(6px); }
                65% { opacity: 1; transform: translateY(-4px) scale(1.008); filter: blur(0); }
                100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
            }
            @keyframes gwLineIn {
                from { opacity: 0; transform: translateY(12px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes gwBeamFloat {
                0% { transform: translate(-35%, -25%) rotate(-18deg) scale(1); opacity: 0.28; }
                33% { transform: translate(25%, 5%) rotate(8deg) scale(1.08); opacity: 0.48; }
                66% { transform: translate(5%, 28%) rotate(-6deg) scale(0.96); opacity: 0.34; }
                100% { transform: translate(-35%, -25%) rotate(-18deg) scale(1); opacity: 0.28; }
            }
            @keyframes gwBeamFloatAlt {
                0% { transform: translate(30%, 20%) rotate(12deg) scale(0.92); opacity: 0.18; }
                50% { transform: translate(-20%, -10%) rotate(-10deg) scale(1.05); opacity: 0.32; }
                100% { transform: translate(30%, 20%) rotate(12deg) scale(0.92); opacity: 0.18; }
            }
            @keyframes gwPulseRing {
                0%, 100% { transform: scale(1); opacity: 0.45; }
                50% { transform: scale(1.06); opacity: 0.85; }
            }
            @keyframes gwBtnInvite {
                0%, 100% {
                    transform: translateY(0) scale(1);
                    box-shadow: 0 10px 28px rgba(19, 91, 236, 0.28), 0 0 0 0 rgba(19, 91, 236, 0.22);
                }
                50% {
                    transform: translateY(-2px) scale(1.018);
                    box-shadow: 0 14px 34px rgba(19, 91, 236, 0.42), 0 0 0 5px rgba(19, 91, 236, 0.07);
                }
            }
            @keyframes gwBtnShimmer {
                0% { transform: translateX(-130%) skewX(-14deg); opacity: 0; }
                35% { opacity: 0.45; }
                100% { transform: translateX(220%) skewX(-14deg); opacity: 0; }
            }
            #guestWelcomeOverlay {
                animation: gwBackdropIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
            }
            #guestWelcomeOverlay .gw-backdrop {
                background: rgba(7, 11, 20, 0.58);
                backdrop-filter: blur(22px) saturate(1.35);
                -webkit-backdrop-filter: blur(22px) saturate(1.35);
            }
            #guestWelcomeOverlay .gw-beam {
                position: absolute;
                width: 140%;
                height: 140%;
                top: -20%;
                left: -20%;
                pointer-events: none;
                background: radial-gradient(ellipse 42% 28% at 50% 50%, rgba(19, 91, 236, 0.34) 0%, rgba(125, 211, 252, 0.12) 38%, transparent 72%);
                filter: blur(18px);
                animation: gwBeamFloat 14s ease-in-out infinite;
            }
            #guestWelcomeOverlay .gw-beam-alt {
                position: absolute;
                width: 120%;
                height: 120%;
                top: -10%;
                left: -10%;
                pointer-events: none;
                background: radial-gradient(ellipse 36% 22% at 60% 40%, rgba(99, 102, 241, 0.22) 0%, rgba(56, 189, 248, 0.08) 45%, transparent 70%);
                filter: blur(24px);
                animation: gwBeamFloatAlt 18s ease-in-out infinite;
            }
            body.guest-welcome-open #loginPageShell {
                filter: blur(10px) saturate(0.92);
                transform: scale(1.01);
                transition: filter 0.45s ease, transform 0.45s ease;
            }
            #guestWelcomeOverlay .gw-card {
                animation: gwCardIn 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards;
            }
            #guestWelcomeOverlay .gw-line-1 { animation: gwLineIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both; }
            #guestWelcomeOverlay .gw-line-2 { animation: gwLineIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.22s both; }
            #guestWelcomeOverlay .gw-line-3 { animation: gwLineIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.32s both; }
            #guestWelcomeOverlay .gw-line-4 { animation: gwLineIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.42s both; }
            #guestWelcomeOverlay .gw-line-5 { animation: gwLineIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.52s both; }
            #guestWelcomeOverlay .gw-logo-ring {
                animation: gwPulseRing 2.8s ease-in-out infinite;
            }
            #guestWelcomeOverlay .gw-btn-primary {
                position: relative;
                overflow: hidden;
                animation: gwBtnInvite 2.6s ease-in-out infinite;
                transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
            }
            #guestWelcomeOverlay .gw-btn-primary::after {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.22) 50%, transparent 62%);
                animation: gwBtnShimmer 3.2s ease-in-out infinite;
                pointer-events: none;
            }
            #guestWelcomeOverlay .gw-btn-primary:hover {
                animation-play-state: paused;
                transform: translateY(-2px) scale(1.02);
                box-shadow: 0 16px 36px rgba(19, 91, 236, 0.45);
            }
            #guestWelcomeOverlay .gw-btn-primary:active {
                transform: translateY(0) scale(0.995);
            }
        `;
        document.head.appendChild(style);
    }

    function showWelcomeOverlay() {
        injectWelcomeStyles();
        const email = cfg().contactEmail || 'furkan@flowcobalt.com';
        const overlay = document.createElement('div');
        overlay.id = 'guestWelcomeOverlay';
        overlay.className =
            'fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6';
        overlay.innerHTML = `
            <div class="gw-backdrop absolute inset-0 overflow-hidden">
                <div class="gw-beam"></div>
                <div class="gw-beam-alt"></div>
            </div>
            <div class="gw-card relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#121a2e] to-[#0c1220] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
                <div class="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-[#135bec]/15 blur-3xl pointer-events-none"></div>
                <div class="absolute -bottom-20 -left-16 h-40 w-40 rounded-full bg-indigo-500/8 blur-3xl pointer-events-none"></div>
                <div class="relative px-7 pt-9 pb-8 sm:px-9 sm:pt-10 sm:pb-9 text-center">
                    <div class="gw-line-1 mx-auto mb-5 relative flex h-20 w-20 items-center justify-center">
                        <span class="gw-logo-ring absolute inset-0 rounded-2xl border border-[#135bec]/40"></span>
                        <img src="assets/logo.png" alt="Jet Barkod" class="relative h-14 w-14 object-contain drop-shadow-lg">
                    </div>
                    <p class="gw-line-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7dd3fc]/90 mb-2">Hoş geldiniz</p>
                    <h2 class="gw-line-3 text-2xl sm:text-[1.65rem] font-bold text-white tracking-tight leading-tight mb-3">
                        Jet Barkod geçici olarak<br class="hidden sm:block"> herkese açık
                    </h2>
                    <p class="gw-line-4 text-sm sm:text-[0.95rem] text-slate-300/95 leading-relaxed max-w-md mx-auto mb-2">
                        Veritabanı bakımı nedeniyle giriş ekranını kısa süreliğine devre dışı bıraktık.
                        Ürün barkod aramasına doğrudan devam edebilirsiniz.
                    </p>
                    <p class="gw-line-4 text-xs text-slate-400/90 mb-7">
                        Sorularınız için:
                        <a href="mailto:${email}" class="text-[#93c5fd] hover:text-white font-medium underline-offset-2 hover:underline">${email}</a>
                    </p>
                    <div class="gw-line-5">
                        <button type="button" id="guestWelcomePrimary" class="gw-btn-primary w-full rounded-xl bg-[#135bec] text-white font-semibold py-3.5 px-5 text-[15px]">
                            Ürün barkod aramaya geç
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.body.classList.add('overflow-hidden', 'guest-welcome-open');

        overlay.querySelector('#guestWelcomePrimary')?.addEventListener('click', () => enterGuestApp());
    }

    function isIndexPage() {
        const path = window.location.pathname || '';
        return /index\.html$/i.test(path) || path.endsWith('/') || path === '';
    }

    function initIndexGuestFlow() {
        if (!isEnabled()) return false;
        if (!isIndexPage()) return false;

        const session = window.authUtils?.checkAuth?.();
        if (session && !session.isGuest) return false;

        const loginShell = document.getElementById('loginPageShell');
        if (loginShell) loginShell.setAttribute('aria-hidden', 'true');

        if (hasSeenWelcome()) {
            createGuestSession();
            goToProductSearch();
            return true;
        }

        showWelcomeOverlay();
        return true;
    }

    function ensureGuestSessionForAppPage() {
        if (!isEnabled()) return null;
        let session = window.authUtils?.checkAuth?.();
        if (session) return session;
        return createGuestSession();
    }

    window.jetbarkodGuestAccess = {
        isEnabled,
        hasSeenWelcome,
        markWelcomeSeen,
        createGuestSession,
        ensureGuestSessionForAppPage,
        enterGuestApp,
        getGuestPremiumFeatures,
    };

    document.addEventListener('DOMContentLoaded', () => {
        initIndexGuestFlow();
    });
})();
