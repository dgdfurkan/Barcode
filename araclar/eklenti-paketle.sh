#!/usr/bin/env bash
#
# Chrome eklentilerini dağıtım ZIP'ine paketler.
# ============================================================================
#
# NEDEN VAR
# Kaynak klasördeki manifest ile `eklentiler/` altındaki ZIP birbirinden
# ayrı yaşıyor. Kod güncellenip ZIP unutulunca depo güncel görünüyor ama
# kullanıcı ayarlardan eski sürümü indiriyor. Asistan bir ara altı sürüm
# geride kaldı; bu betik o hatayı imkânsız kılmak için.
#
# KULLANIM
#   araclar/eklenti-paketle.sh              Bayat olan hepsini paketler
#   araclar/eklenti-paketle.sh asistan      Yalnız birini paketler
#   araclar/eklenti-paketle.sh --kontrol    Hiçbir şey yazmaz, bayatları listeler
#   araclar/eklenti-paketle.sh --zorla      Bayat olmasa da yeniden paketler
#
# ZIP YAPISI
# Asistan düz kök (manifest.json ZIP'in kökünde), diğerleri tek üst
# klasör taşıyor. İkisi de sahada kurulu; yapıyı değiştirmek kurulum
# talimatını bozar, o yüzden her eklenti kendi yapısını koruyor.
# ============================================================================
set -euo pipefail

KOK="$(cd "$(dirname "$0")/.." && pwd)"
HEDEF="$KOK/eklentiler"

# kisa_ad | kaynak klasör | zip adı (uzantısız) | yapı (duz|klasor)
EKLENTILER=(
  "asistan|jet-barkod-asistan|Jet Barkod - Asistan|duz"
  "toplu-kopyalama|getir-warehouse-html-copy-extension|Jet Barkod - Toplu Kopyalama|klasor"
  "stok-barkodlari|getir-stock-barcodes-extension|Jet Barkod - Stok Barkodları|klasor"
  "sayim-hazirligi|getir-stock-sync-extension|Jet Barkod - Sayım Hazırlığı|klasor"
  "siparis-arama|getir-warehouse-orders-search-extension|Jet Barkod - Sipariş İçi Ürün Arama|klasor"
  "dusuk-stok|getir-low-stock-alert-extension|Jet Barkod - Düşük Stok Uyarısı|klasor"
)

surum_oku() { python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('version',''))" "$1"; }

zip_surumu() {
  local zip="$1"
  [ -f "$zip" ] || { echo ""; return; }
  local gecici; gecici="$(mktemp -d)"
  unzip -qq "$zip" -d "$gecici" 2>/dev/null || true
  local m; m="$(find "$gecici" -name manifest.json -maxdepth 2 | head -1)"
  if [ -n "$m" ]; then surum_oku "$m"; else echo ""; fi
  rm -rf "$gecici"
}

paketle() {
  local kaynak="$1" zipAdi="$2" yapi="$3"
  local cikti="$HEDEF/$zipAdi.zip"
  local gecici; gecici="$(mktemp -d)"

  if [ "$yapi" = "duz" ]; then
    cp -R "$KOK/$kaynak/." "$gecici/"
  else
    mkdir -p "$gecici/$zipAdi"
    cp -R "$KOK/$kaynak/." "$gecici/$zipAdi/"
  fi

  # macOS artıkları ve düzenleyici çöpü ZIP'e girmesin.
  find "$gecici" \( -name '.DS_Store' -o -name '__MACOSX' -o -name '*.swp' -o -name 'Thumbs.db' \) -exec rm -rf {} + 2>/dev/null || true

  rm -f "$cikti"
  ( cd "$gecici" && zip -qr "$cikti" . -x '.*' )
  rm -rf "$gecici"
}

KONTROL=0; ZORLA=0; SECILEN=""
for arg in "$@"; do
  case "$arg" in
    --kontrol) KONTROL=1 ;;
    --zorla)   ZORLA=1 ;;
    -*) echo "bilinmeyen seçenek: $arg" >&2; exit 2 ;;
    *) SECILEN="$arg" ;;
  esac
done

bayat=0
for satir in "${EKLENTILER[@]}"; do
  IFS='|' read -r kisa kaynak zipAdi yapi <<< "$satir"
  [ -n "$SECILEN" ] && [ "$SECILEN" != "$kisa" ] && continue
  [ -f "$KOK/$kaynak/manifest.json" ] || { echo "atlandı (manifest yok): $kaynak"; continue; }

  kaynakSurum="$(surum_oku "$KOK/$kaynak/manifest.json")"
  zipSurum="$(zip_surumu "$HEDEF/$zipAdi.zip")"

  if [ "$kaynakSurum" = "$zipSurum" ] && [ "$ZORLA" -eq 0 ]; then
    echo "  güncel   $kaynakSurum  ·  $zipAdi"
    continue
  fi

  bayat=$((bayat + 1))
  if [ "$KONTROL" -eq 1 ]; then
    echo "  BAYAT    zip=${zipSurum:-yok} kaynak=$kaynakSurum  ·  $zipAdi"
    continue
  fi

  paketle "$kaynak" "$zipAdi" "$yapi"
  yeni="$(zip_surumu "$HEDEF/$zipAdi.zip")"
  if [ "$yeni" != "$kaynakSurum" ]; then
    echo "HATA: $zipAdi paketlendi ama ZIP sürümü $yeni, beklenen $kaynakSurum" >&2
    exit 1
  fi
  boyut="$(du -h "$HEDEF/$zipAdi.zip" | cut -f1 | tr -d ' ')"
  echo "  yazıldı  $yeni  ($boyut)  ·  $zipAdi"
done

if [ "$KONTROL" -eq 1 ] && [ "$bayat" -gt 0 ]; then
  echo "$bayat eklenti bayat. Paketlemek için: araclar/eklenti-paketle.sh" >&2
  exit 1
fi
