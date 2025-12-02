"""Stok sorgulama servisi"""
import logging
from typing import List, Dict, Any, Optional

from src.getir_client import GetirClient
from src.utils import normalize_search_term

logger = logging.getLogger(__name__)


class StockService:
    """Stok sorgulama ve arama servisi"""
    
    def __init__(self, bot_token: Optional[str] = None):
        self.bot_token = bot_token
        self.client = GetirClient(bot_token)
        self._stock_cache: Optional[List[Dict[str, Any]]] = None
        self._cache_timestamp: Optional[float] = None
        self.cache_ttl = 300  # 5 dakika cache süresi
        self._first_page_cache: Optional[List[Dict[str, Any]]] = None
        self._first_page_timestamp: Optional[float] = None
    
    def _is_cache_valid(self) -> bool:
        """Cache'in geçerli olup olmadığını kontrol eder"""
        if not self._stock_cache or not self._cache_timestamp:
            return False
        
        import time
        return (time.time() - self._cache_timestamp) < self.cache_ttl
    
    def _is_first_page_cache_valid(self) -> bool:
        """İlk sayfa cache'inin geçerli olup olmadığını kontrol eder"""
        if not self._first_page_cache or not self._first_page_timestamp:
            return False
        
        import time
        return (time.time() - self._first_page_timestamp) < self.cache_ttl
    
    def _get_first_page_stocks(self, use_cache: bool = True) -> List[Dict[str, Any]]:
        """İlk sayfa stoklarını getirir (hızlı arama için)"""
        if use_cache and self._is_first_page_cache_valid():
            logger.info("İlk sayfa cache'den alınıyor")
            return self._first_page_cache
        
        logger.info("İlk sayfa stok verileri API'den çekiliyor...")
        try:
            stocks = self.client.get_stocks(limit=100, offset=0)
            
            if stocks:
                self._first_page_cache = stocks
                import time
                self._first_page_timestamp = time.time()
                logger.info(f"İlk sayfa stok verileri yüklendi: {len(stocks)} ürün")
            
            return stocks or []
        except Exception as e:
            logger.error(f"İlk sayfa stok verileri çekilirken hata: {e}", exc_info=True)
            return []
    
    def _get_all_stocks(self, use_cache: bool = True) -> List[Dict[str, Any]]:
        """Tüm stok verilerini getirir (cache ile)"""
        if use_cache and self._is_cache_valid():
            logger.info("Cache'den stok verileri alınıyor")
            return self._stock_cache
        
        logger.info("Stok verileri API'den çekiliyor...")
        try:
            stocks = self.client.get_all_stocks()
            
            if stocks:
                self._stock_cache = stocks
                import time
                self._cache_timestamp = time.time()
                logger.info(f"Stok verileri başarıyla yüklendi: {len(stocks)} ürün")
            else:
                logger.warning("Stok verileri alınamadı - boş liste döndü")
            
            return stocks or []
        except Exception as e:
            logger.error(f"Stok verileri çekilirken hata: {e}", exc_info=True)
            return []
    
    def _extract_barcodes_from_packaging(self, product: Dict[str, Any], only_type_1: bool = False) -> Optional[List[str]]:
        """packagingInfo'dan barcodes array'ini çıkarır
        
        Args:
            product: Ürün dict'i
            only_type_1: True ise sadece packagingInfo['1'] içindeki barkodları al (raf etiketi için)
        """
        packaging_info = product.get('packagingInfo', {})
        if not packaging_info:
            return None
        
        if only_type_1:
            # Sadece '1' tipindeki barkodları al (gerçek raf etiketleri)
            type_1 = packaging_info.get('1', {})
            if isinstance(type_1, dict) and 'barcodes' in type_1:
                barcodes = type_1['barcodes']
                if isinstance(barcodes, list) and len(barcodes) > 0:
                    return barcodes
            return None
        else:
            # Tüm packaging type'larındaki barkodları topla (arama için)
            all_barcodes = []
            for key, value in packaging_info.items():
                if isinstance(value, dict) and 'barcodes' in value:
                    barcodes = value['barcodes']
                    if isinstance(barcodes, list):
                        all_barcodes.extend(barcodes)
            
            # Tekrarları kaldır ve sırala
            if all_barcodes:
                return sorted(list(set(all_barcodes)))
        
        return None
    
    def _match_product(self, stock: Dict[str, Any], search_terms: List[str]) -> bool:
        """Ürünün arama terimleriyle eşleşip eşleşmediğini kontrol eder"""
        name_tr = stock.get('name', {}).get('tr', '').lower()
        name_en = stock.get('name', {}).get('en', '').lower()
        full_name_tr = stock.get('fullName', {}).get('tr', '').lower()
        
        # Tüm alanları birleştir
        all_names = f"{name_tr} {name_en} {full_name_tr}"
        
        # Her arama teriminin en az birinde geçmesi gerekiyor
        # Ama en az bir terim mutlaka eşleşmeli
        matches = 0
        for term in search_terms:
            if term in all_names:
                matches += 1
        
        # Tüm terimler eşleşirse veya en az yarısı eşleşirse kabul et
        return matches >= max(1, len(search_terms) * 0.5)
    
    def search_by_name(self, search_term: str, fast_search: bool = True) -> List[Dict[str, Any]]:
        """Ürün adına göre arama yapar
        
        Args:
            search_term: Arama terimi
            fast_search: True ise API search endpoint kullan (hızlı), False ise tüm stoklarda ara
        """
        if not search_term or not search_term.strip():
            logger.warning(f"Geçersiz arama terimi: '{search_term}'")
            return []
        
        # Hızlı arama: /products ile ürünü bul, sonra /stocks ile stok bilgisini al
        if fast_search:
            try:
                # 1. Önce /products endpoint'i ile ürünü bul
                products = self.client.search_products(search_term, limit=100)
                
                # Eğer products None döndüyse ve authentication başarısızsa, boş liste döndür
                if products is None:
                    # Authentication kontrolü yap
                    from src.auth_manager import AuthManager
                    auth_manager = AuthManager(bot_token=self.bot_token)
                    if not auth_manager.is_token_valid():
                        logger.warning("Token geçersiz, boş liste döndürülüyor")
                        return []
                
                if products:
                    logger.info(f"'{search_term}' için {len(products)} ürün bulundu (products API)")
                    
                    # Ürün isimlerini kontrol et ve arama terimiyle eşleşenleri filtrele
                    # Ama çok sıkı filtreleme yapma, API zaten doğru sonuçları döndürüyor
                    normalized_search = normalize_search_term(search_term)
                    search_words = [w.strip() for w in normalized_search.split() if w.strip()]
                    
                    # Eğer çok az sonuç varsa filtreleme yapma
                    if len(products) <= 5:
                        logger.info(f"'{search_term}' için {len(products)} ürün bulundu, filtreleme yapılmıyor")
                    else:
                        filtered_products = []
                        for product in products:
                            product_name = product.get('name', {}).get('tr', '') or product.get('fullName', '')
                            normalized_product_name = normalize_search_term(product_name)
                            
                            # Arama terimindeki kelimelerin çoğu ürün adında olmalı (daha esnek: %50)
                            matches = sum(1 for word in search_words if word in normalized_product_name)
                            if matches >= max(1, len(search_words) * 0.5):  # En az %50 eşleşme
                                filtered_products.append(product)
                            else:
                                logger.debug(f"Ürün filtrelendi: '{product_name}' (eşleşme: {matches}/{len(search_words)})")
                        
                        if filtered_products:
                            products = filtered_products
                            logger.info(f"'{search_term}' için {len(products)} ürün filtrelendi (products API)")
                        else:
                            logger.warning(f"'{search_term}' için hiçbir ürün filtrelenemedi, tüm sonuçlar kullanılacak")
                    
                    # 2. Tüm product ID'lerini topla
                    product_ids = []
                    for product in products:
                        product_id = product.get('_id') or product.get('id')
                        if product_id:
                            product_ids.append(product_id)
                    
                    if product_ids:
                        # 3. /stocks endpoint'ine productIds array ile istek at (browser formatı)
                        logger.debug(f"{len(product_ids)} ürün için stok bilgisi alınıyor...")
                        stocks = self.client.get_stocks(limit=100, offset=0, product_ids=product_ids)
                        
                        if stocks:
                            # 4. Stok bilgilerini ürün bilgileriyle eşleştir
                            stocks_dict = {}
                            for stock in stocks:
                                # Response formatını kontrol et
                                if not isinstance(stock, dict):
                                    logger.warning(f"Beklenmeyen stok formatı: {type(stock)}")
                                    continue
                                
                                # productId'yi bul - farklı formatları kontrol et
                                stock_product_id = None
                                if 'productId' in stock:
                                    stock_product_id = stock['productId']
                                elif 'product' in stock:
                                    product = stock['product']
                                    if isinstance(product, dict):
                                        stock_product_id = product.get('_id') or product.get('id')
                                    elif isinstance(product, str):
                                        stock_product_id = product
                                
                                if stock_product_id:
                                    stocks_dict[stock_product_id] = stock
                                else:
                                    logger.debug(f"Stok'ta productId bulunamadı: {list(stock.keys())[:10]}")
                            
                            # 5. Ürün bilgilerine stok bilgilerini ekle
                            results = []
                            for product in products:
                                product_id = product.get('_id') or product.get('id')
                                
                                if product_id in stocks_dict:
                                    stock = stocks_dict[product_id]
                                    product['available'] = stock.get('available', 0)
                                    product['reserve'] = stock.get('reserve', 0)
                                    product['sapReferenceCode'] = stock.get('sapReferenceCode') or product.get('sapReferenceCode')
                                    
                                    # Barcodes'u packagingInfo'dan al ve ekle (sadece type 1 - raf etiketleri)
                                    barcodes = self._extract_barcodes_from_packaging(stock, only_type_1=True) or self._extract_barcodes_from_packaging(product, only_type_1=True)
                                    if barcodes:
                                        # Sadece ilk barkodu göster (kullanıcı istedi)
                                        product['barcodes'] = [barcodes[0]] if len(barcodes) > 0 else []
                                    
                                    logger.debug(f"Ürün {product_id} için stok bulundu: available={product['available']}, reserve={product['reserve']}, barcodes={len(barcodes) if barcodes else 0}")
                                else:
                                    product['available'] = 0
                                    product['reserve'] = 0
                                    
                                    # Barcodes'u product'tan al (sadece type 1 - raf etiketleri)
                                    barcodes = self._extract_barcodes_from_packaging(product, only_type_1=True)
                                    if barcodes:
                                        # Sadece ilk barkodu göster (kullanıcı istedi)
                                        product['barcodes'] = [barcodes[0]] if len(barcodes) > 0 else []
                                    
                                    logger.warning(f"Ürün {product_id} için stok bilgisi bulunamadı")
                                
                                results.append(product)
                            
                            logger.info(f"'{search_term}' için {len(results)} sonuç hazırlandı (stok bilgileriyle)")
                            return results
                        else:
                            logger.warning(f"Stok bilgileri alınamadı, ürünler stok bilgisi olmadan döndürülüyor")
                            # Stok bilgisi alınamadıysa, ürünleri stok bilgisi olmadan döndür
                            for product in products:
                                product['available'] = 0
                                product['reserve'] = 0
                            return products
                    else:
                        logger.warning(f"Ürün ID'leri bulunamadı")
                        return products
                else:
                    logger.info(f"Products API sonuç vermedi, ilk sayfada aranıyor...")
                    # API search sonuç vermezse ilk sayfada ara
                    first_page_stocks = self._get_first_page_stocks()
                    normalized_term = normalize_search_term(search_term)
                    search_terms = [term.strip() for term in normalized_term.split() if term.strip()]
                    
                    results = []
                    for stock in first_page_stocks:
                        if self._match_product(stock, search_terms):
                            results.append(stock)
                    
                    logger.info(f"'{search_term}' için {len(results)} sonuç bulundu (ilk sayfa)")
                    return results
            except Exception as e:
                logger.error(f"API search hatası: {e}, ilk sayfada aranıyor...", exc_info=True)
                # Hata durumunda ilk sayfada ara
                first_page_stocks = self._get_first_page_stocks()
                normalized_term = normalize_search_term(search_term)
                search_terms = [term.strip() for term in normalized_term.split() if term.strip()]
                
                results = []
                for stock in first_page_stocks:
                    if self._match_product(stock, search_terms):
                        results.append(stock)
                
                logger.info(f"'{search_term}' için {len(results)} sonuç bulundu (ilk sayfa)")
                return results
        
        # Tüm stoklarda ara (sadece fast_search=False ise)
        all_stocks = self._get_all_stocks()
        normalized_term = normalize_search_term(search_term)
        search_terms = [term.strip() for term in normalized_term.split() if term.strip()]
        
        results = []
        for stock in all_stocks:
            if self._match_product(stock, search_terms):
                results.append(stock)
        
        logger.info(f"'{search_term}' için {len(results)} sonuç bulundu")
        return results
    
    def search_by_barcode(self, barcode: str, fast_search: bool = True) -> Optional[Dict[str, Any]]:
        """Barkod/SKU'ya göre arama yapar
        
        Args:
            barcode: Barkod/SKU (raf etiketi)
            fast_search: True ise API search kullan (hızlı), False ise tüm stoklarda ara
        """
        normalized_barcode = barcode.strip()
        
        # Hızlı arama: /products endpoint'i ile barkod ara (tüm packagingInfo barkodlarını kontrol eder)
        if fast_search:
            products = self.client.search_products(normalized_barcode, limit=100)
            
            if products:
                # Bulunan ürünlerin packagingInfo'sundaki tüm barkodları kontrol et
                for product in products:
                    # Tüm packagingInfo barkodlarını kontrol et
                    all_barcodes = self._extract_barcodes_from_packaging(product, only_type_1=False)
                    
                    if all_barcodes and normalized_barcode in all_barcodes:
                        # Ürün bulundu, stok bilgisini al
                        product_id = product.get('_id') or product.get('id')
                        if product_id:
                            stocks = self.client.get_stocks(limit=1, offset=0, product_ids=[product_id])
                            if stocks and len(stocks) > 0:
                                stock = stocks[0]
                                # Ürün bilgilerini stok bilgisine ekle
                                stock.update(product)
                                logger.info(f"Barkod '{barcode}' bulundu (products API)")
                                return stock
                
                logger.info(f"Barkod '{barcode}' products API'de bulundu ama stok bilgisi alınamadı")
                return None
            
            # Products API'de bulunamadıysa, ilk sayfada ara
            first_page_stocks = self._get_first_page_stocks()
            
            for stock in first_page_stocks:
                sap_code = stock.get('sapReferenceCode', '').strip()
                product_id = stock.get('_id', '').strip()
                
                # packagingInfo'daki tüm barkodları kontrol et
                all_barcodes = self._extract_barcodes_from_packaging(stock, only_type_1=False)
                
                if (normalized_barcode == sap_code or 
                    normalized_barcode == product_id or
                    (all_barcodes and normalized_barcode in all_barcodes)):
                    logger.info(f"Barkod '{barcode}' bulundu (ilk sayfa)")
                    return stock
            
            logger.info(f"Barkod '{barcode}' ilk sayfada bulunamadı")
            return None
        
        # Tüm stoklarda ara (sadece fast_search=False ise)
        all_stocks = self._get_all_stocks()
        
        for stock in all_stocks:
            sap_code = stock.get('sapReferenceCode', '').strip()
            product_id = stock.get('_id', '').strip()
            
            # packagingInfo'daki tüm barkodları kontrol et
            all_barcodes = self._extract_barcodes_from_packaging(stock, only_type_1=False)
            
            if (normalized_barcode == sap_code or 
                normalized_barcode == product_id or
                (all_barcodes and normalized_barcode in all_barcodes)):
                logger.info(f"Barkod '{barcode}' bulundu")
                return stock
        
        logger.info(f"Barkod '{barcode}' bulunamadı")
        return None
    
    def search(self, search_term: str) -> List[Dict[str, Any]]:
        """Genel arama - önce barkod, sonra ürün adı"""
        search_term = search_term.strip()
        
        # Önce barkod olarak dene (sayısal veya alfanumerik)
        if search_term.replace('-', '').replace('_', '').isalnum():
            result = self.search_by_barcode(search_term)
            if result:
                return [result]
        
        # Barkod bulunamazsa ürün adı ile ara
        return self.search_by_name(search_term)
    
    def get_stock_info(self, product_id: str) -> Optional[Dict[str, Any]]:
        """Belirli bir ürünün stok bilgisini getirir"""
        all_stocks = self._get_all_stocks()
        
        for stock in all_stocks:
            if stock.get('_id') == product_id:
                return stock
        
        return None
    
    def clear_cache(self):
        """Cache'i temizler"""
        self._stock_cache = None
        self._cache_timestamp = None
        self._first_page_cache = None
        self._first_page_timestamp = None
        logger.info("Cache temizlendi")

