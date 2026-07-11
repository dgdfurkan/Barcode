# Landing UI — Container Scroll Animation

Aceternity `@aceternity/container-scroll-animation` bileşeni (shadcn CLI ile kuruldu).

## Kurulum (zaten yapıldı)

```bash
cd landing-ui
npm install
npx shadcn@latest add @aceternity/container-scroll-animation -y
```

## Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `src/components/ui/container-scroll-animation.tsx` | Ana bileşen (shadcn) |
| `src/components/container-scroll-animation-demo.tsx` | Jet Barkod demo |
| `src/App.tsx` | Demo giriş noktası |

## Çalıştır

```bash
cd landing-ui
npm run dev
```

Tarayıcı: `http://localhost:5173`

## Build

```bash
npm run build
```

Çıktı: `landing-ui/dist/`

## Not

Ana site (`index.html`) vanilla HTML olduğu için React bileşeni ayrı `landing-ui/` alt projesinde. Ana sayfaya entegre etmek için build çıktısını embed edebilir veya bu demo'yu referans alarak vanilla port yapılabilir.
