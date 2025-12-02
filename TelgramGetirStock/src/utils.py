"""Yardımcı fonksiyonlar"""
import logging
import os
import io
import hashlib
from pathlib import Path
from typing import Optional, Tuple, Dict, Union, Any, Iterable

# Logging yapılandırması
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_project_root() -> Path:
    """Proje root dizinini döndürür"""
    return Path(__file__).parent.parent


def ensure_data_dir() -> Path:
    """data dizinini oluşturur ve döndürür"""
    data_dir = get_project_root() / "data"
    data_dir.mkdir(exist_ok=True)
    return data_dir


def get_bot_token_hash(bot_token: Optional[str] = None) -> str:
    """Bot token'ından güvenli bir hash oluşturur (dosya adı için)"""
    if not bot_token:
        # Bot token yoksa default kullan (eski sistemle uyumluluk)
        return "default"
    
    # Bot token'ın ilk kısmını al (8374649024:AAF... formatından)
    # Sadece sayısal kısmı kullan (güvenlik için)
    token_part = bot_token.split(':')[0] if ':' in bot_token else bot_token[:10]
    
    # Hash oluştur (kısa ve güvenli)
    hash_obj = hashlib.md5(bot_token.encode())
    hash_hex = hash_obj.hexdigest()[:12]  # İlk 12 karakter
    
    return f"{token_part}_{hash_hex}"


def get_session_file_path(bot_token: Optional[str] = None) -> Path:
    """Session dosyasının yolunu döndürür (bot token'a göre)"""
    token_hash = get_bot_token_hash(bot_token)
    filename = f"session_{token_hash}.json"
    return ensure_data_dir() / filename


def get_keycloak_token_file_path(bot_token: Optional[str] = None) -> Path:
    """Keycloak token dosyasının yolunu döndürür (bot token'a göre)"""
    token_hash = get_bot_token_hash(bot_token)
    filename = f"keycloak_token_{token_hash}.txt"
    return ensure_data_dir() / filename


def get_keycloak_refresh_token_file_path(bot_token: Optional[str] = None) -> Path:
    """Keycloak refresh token dosyasının yolunu döndürür (bot token'a göre)"""
    token_hash = get_bot_token_hash(bot_token)
    filename = f"keycloak_refresh_token_{token_hash}.txt"
    return ensure_data_dir() / filename


def get_franchise_refresh_token_file_path(bot_token: Optional[str] = None) -> Path:
    """Franchise refresh token dosyasının yolunu döndürür (bot token'a göre)"""
    token_hash = get_bot_token_hash(bot_token)
    filename = f"franchise_refresh_token_{token_hash}.txt"
    return ensure_data_dir() / filename


def normalize_search_term(term: str) -> str:
    """Arama terimini normalize eder (küçük harf, boşlukları temizle, özel karakterleri kaldır)"""
    # Türkçe karakterleri normalize et
    term = term.lower().strip()
    # Parantez içindeki bilgileri kaldır (örn: "(200 ml)" -> "")
    import re
    term = re.sub(r'\([^)]*\)', '', term)
    # Fazla boşlukları temizle
    term = ' '.join(term.split())
    return term


def generate_barcode_image(barcode_value: str) -> Optional[io.BytesIO]:
    """CODE 128 barkod görseli oluşturur"""
    try:
        from barcode import Code128
        from barcode.writer import ImageWriter
        
        # CODE 128 barkod oluştur
        code = Code128(barcode_value, writer=ImageWriter())
        
        # Görseli memory'de oluştur
        buffer = io.BytesIO()
        code.write(buffer, options={
            'module_width': 0.3,
            'module_height': 10,
            'quiet_zone': 2,
            'font_size': 10,
            'text_distance': 3,
            'background': 'white',
            'foreground': 'black',
        })
        buffer.seek(0)
        return buffer
    except Exception as e:
        logger.warning(f"Barkod görseli oluşturulamadı: {e}")
        return None


def _pick_image_url(value: Any) -> Optional[str]:
    """Farklı veri tiplerinden (dict/list/str) görsel URL'si çıkarır"""
    if not value:
        return None
    
    if isinstance(value, str):
        return value
    
    if isinstance(value, dict):
        # Tercih sırasına göre dene
        for key in ('tr', 'en', 'url', 'path', 'default'):
            candidate = value.get(key)
            result = _pick_image_url(candidate)
            if result:
                return result
        # Diğer key'ler listesiyse onları da dene
        for candidate in value.values():
            result = _pick_image_url(candidate)
            if result:
                return result
        return None
    
    if isinstance(value, Iterable):
        for item in value:
            result = _pick_image_url(item)
            if result:
                return result
        return None
    
    return None


def get_product_image_url(product: dict) -> Optional[str]:
    """Ürünün görsel URL'sini döndürür"""
    if not product or not isinstance(product, dict):
        return None
    
    def _extract_image(data: Dict[str, Any]) -> Optional[str]:
        if not data:
            return None
        
        keys = [
            'picURL',
            'picURLs',
            'imageUrl',
            'imageUrls',
            'image',
            'images'
        ]
        
        for key in keys:
            if key in data:
                url = _pick_image_url(data.get(key))
                if url:
                    return url
        return None
    
    image_url = _extract_image(product)
    
    if not image_url and isinstance(product.get('product'), dict):
        image_url = _extract_image(product.get('product', {}))
    
    if not image_url:
        return None
    
    # Eğer relative path ise CDN URL'sini ekle
    if not isinstance(image_url, str):
        return None
    
    if not image_url.startswith('http'):
        if image_url.startswith('/'):
            image_url = f"https://cdn.getir.com{image_url}"
        else:
            image_url = f"https://cdn.getir.com/{image_url}"
    
    return image_url


def format_stock_message(product: dict, skt_info: Optional[Union[str, Dict[str, Optional[str]]]] = None) -> str:
    """Ürün stok bilgisini Telegram mesaj formatına çevirir
    
    Args:
        product: Ürün dict'i
        skt_info: SKT bilgisi (opsiyonel, None ise gösterilmez)
    """
    # Önce fullName'i kontrol et, yoksa name.tr kullan
    name = product.get('fullName', '') or product.get('name', {}).get('tr', 'Bilinmeyen Ürün')
    # Eğer fullName dict ise, tr değerini al
    if isinstance(name, dict):
        name = name.get('tr', 'Bilinmeyen Ürün')
    # Boşlukları temizle ama parantez içindeki bilgileri koru
    name = name.strip()
    
    # None kontrolü yaparak güvenli şekilde al
    available_raw = product.get('available')
    available_display = None  # Gösterilecek değer
    real_stock_value = None  # Gerçek stok değeri (sayımda ise gizli olabilir)
    
    # "Sayımda" durumunu kontrol et - API'de -1 veya null geliyor, browser'da "Sayımda" gösteriliyor
    is_counting = False
    
    # available = -1 ise "Sayımda" durumu
    if available_raw == -1:
        is_counting = True
        available_display = "Sayımda"
        
        # Gerçek stok değerini alternatif alanlardan al
        real_stock_value = (
            product.get('realAvailable') or
            product.get('actualAvailable') or
            product.get('inventoryCount') or
            product.get('stockCount') or
            product.get('quantity') or
            product.get('qty') or
            product.get('count') or
            product.get('hiddenStock') or
            product.get('actualStock') or
            product.get('realStock')
        )
        
        if real_stock_value is not None:
            try:
                real_stock_value = int(real_stock_value)
                logger.info(f"Sayımda ürün için gerçek stok bulundu: {real_stock_value}")
            except (ValueError, TypeError):
                real_stock_value = None
    elif available_raw is None:
        # available null ise sayımda olabilir, ama reserve ve total de null ise kesinlikle sayımda
        reserve_raw = product.get('reserve')
        total_raw = product.get('total')
        
        if reserve_raw is None and total_raw is None:
            is_counting = True
            available_display = "Sayımda"
            
            # Gerçek stok değerini alternatif alanlardan al
            real_stock_value = (
                product.get('realAvailable') or
                product.get('actualAvailable') or
                product.get('inventoryCount') or
                product.get('stockCount') or
                product.get('quantity') or
                product.get('qty') or
                product.get('count') or
                product.get('hiddenStock') or
                product.get('actualStock') or
                product.get('realStock')
            )
            
            if real_stock_value is not None:
                try:
                    real_stock_value = int(real_stock_value)
                    logger.info(f"Sayımda ürün için gerçek stok bulundu: {real_stock_value}")
                except (ValueError, TypeError):
                    real_stock_value = None
        else:
            # Sadece available null ama reserve/total varsa 0 kabul et
            available_display = 0
    elif isinstance(available_raw, str) and ('sayım' in available_raw.lower() or 'counting' in available_raw.lower()):
        # String olarak "Sayımda" gelirse
        is_counting = True
        available_display = "Sayımda"
        
        # Gerçek stok değerini alternatif alanlardan al
        real_stock_value = (
            product.get('realAvailable') or
            product.get('actualAvailable') or
            product.get('inventoryCount') or
            product.get('stockCount') or
            product.get('quantity') or
            product.get('qty') or
            product.get('count') or
            product.get('hiddenStock') or
            product.get('actualStock') or
            product.get('realStock')
        )
        
        if real_stock_value is not None:
            try:
                real_stock_value = int(real_stock_value)
                logger.info(f"Sayımda ürün için gerçek stok bulundu: {real_stock_value}")
            except (ValueError, TypeError):
                real_stock_value = None
    else:
        try:
            available_display = int(available_raw)
            # Eğer -1 ise sayımda olarak işaretle
            if available_display == -1:
                is_counting = True
                available_display = "Sayımda"
        except (ValueError, TypeError):
            available_display = 0
    
    # available değişkenini display değeri olarak ayarla
    available = available_display
    
    reserve = product.get('reserve')
    if reserve is None:
        reserve = 0
    else:
        try:
            reserve = int(reserve)
        except (ValueError, TypeError):
            reserve = 0
    
    # Raf etiketlerini (barcodes) al - bunlar gerçek raf etiketleri
    barcodes = product.get('barcodes', [])
    
    # Eğer barcodes yoksa, product içinde kontrol et
    if not barcodes and 'product' in product and isinstance(product['product'], dict):
        barcodes = product['product'].get('barcodes', [])
    
    # Eğer hala yoksa, packagingInfo'dan çıkar (sadece type 1 - raf etiketleri)
    if not barcodes:
        packaging_info = product.get('packagingInfo', {})
        if packaging_info:
            # Sadece '1' tipindeki barkodları al (gerçek raf etiketleri)
            type_1 = packaging_info.get('1', {})
            if isinstance(type_1, dict) and 'barcodes' in type_1:
                barcodes_list = type_1['barcodes']
                if isinstance(barcodes_list, list) and len(barcodes_list) > 0:
                    # Sadece ilk barkodu göster (kullanıcı istedi)
                    barcodes = [barcodes_list[0]]
    
    # Eğer barcodes yoksa, SAP kodunu gösterme (kullanıcı istemedi)
    if barcodes:
        # Sadece ilk barkodu göster (kullanıcı istedi)
        barcode_text = f"🏷️ Raf Etiketi: `{barcodes[0]}`"
    else:
        # SAP kodunu gösterme, sadece bilgi ver
        barcode_text = "🏷️ Raf Etiketi: Bulunamadı"
    
    message = f"📦 *{name}*\n\n"
    
    # Sayımda durumunu özel olarak göster
    if is_counting:
        message += f"✅ Mevcut Stok: `Sayımda`"
        if real_stock_value is not None:
            message += f" (Gerçek: `{real_stock_value}`)"
        message += "\n"
    else:
        message += f"✅ Mevcut Stok: `{available}`\n"
    
    message += f"🔒 Rezerve Stok: `{reserve}`\n"
    
    # Toplam hesaplama
    if is_counting and real_stock_value is not None:
        total = real_stock_value + reserve
        message += f"📊 Toplam: `{total}` (Sayımda - Gerçek değer)\n"
    elif is_counting:
        message += f"📊 Toplam: `Sayımda`\n"
    else:
        message += f"📊 Toplam: `{available + reserve}`\n"
    
    message += barcode_text
    
    # SKT bilgilerini ekle (yeni format - her adet ve tarih ayrı satırda)
    if skt_info:
        if isinstance(skt_info, dict):
            expiry_text = skt_info.get("expiry_summary")
            removal_text = skt_info.get("removal_summary")
        else:
            expiry_text = skt_info
            removal_text = None
        
        if expiry_text:
            # Her satırı ayrı göster (her satır backtick içinde)
            expiry_lines = expiry_text.split('\n')
            message += "\n📅 SKT: "
            for line in expiry_lines:
                message += f"\n`{line}`"
        
        if removal_text:
            # Her satırı ayrı göster (her satır backtick içinde)
            removal_lines = removal_text.split('\n')
            message += "\n📤 SKT Çıkış: "
            for line in removal_lines:
                message += f"\n`{line}`"
    
    return message


def get_barcode_image_for_product(product: dict) -> Optional[io.BytesIO]:
    """Ürün için barkod görseli döndürür (ilk raf etiketi)"""
    # Raf etiketlerini al
    barcodes = product.get('barcodes', [])
    
    # Eğer barcodes yoksa, product içinde kontrol et
    if not barcodes and 'product' in product and isinstance(product['product'], dict):
        barcodes = product['product'].get('barcodes', [])
    
    # Eğer hala yoksa, packagingInfo'dan çıkar (sadece type 1 - raf etiketleri)
    if not barcodes:
        packaging_info = product.get('packagingInfo', {})
        if packaging_info:
            # Sadece '1' tipindeki barkodları al (gerçek raf etiketleri)
            type_1 = packaging_info.get('1', {})
            if isinstance(type_1, dict) and 'barcodes' in type_1:
                barcodes_list = type_1['barcodes']
                if isinstance(barcodes_list, list) and len(barcodes_list) > 0:
                    # Sadece ilk barkodu göster (kullanıcı istedi)
                    barcodes = [barcodes_list[0]]
    
    if barcodes:
        # İlk raf etiketini kullan
        return generate_barcode_image(barcodes[0])
    
    return None

