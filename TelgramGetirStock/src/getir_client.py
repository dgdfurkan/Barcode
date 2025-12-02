"""Getir API Client"""
import logging
import os
import time
from typing import Optional, Dict, Any, List
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from src.auth_manager import AuthManager

logger = logging.getLogger(__name__)


class GetirClient:
    """Getir API client sınıfı"""
    
    def __init__(self, bot_token: Optional[str] = None):
        self.base_url = os.getenv('GETIR_API_BASE_URL', 'https://franchise-api-gateway.getirapi.com')
        self.recaptcha_site_key = os.getenv('GETIR_RECAPTCHA_SITE_KEY', '6LfRdRobAAAAAGtQPnhju9dtpIU0eeMuJ_4ogcGa')
        self.username = os.getenv('GETIR_USERNAME')
        self.password = os.getenv('GETIR_PASSWORD')
        self.bot_token = bot_token
        self.auth_manager = AuthManager(bot_token)
        
        # Session oluştur ve retry stratejisi ekle
        self.session = requests.Session()
        # Rate limiting için 429'u retry listesinden çıkarıyoruz
        retry_strategy = Retry(
            total=2,
            backoff_factor=2,
            status_forcelist=[500, 502, 503, 504],  # 429'u kaldırdık
            allowed_methods=["GET", "POST"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Timeout ayarları
        self.timeout = 30
    
    def _get_headers(self, include_auth: bool = True) -> Dict[str, str]:
        """Request headers'ı oluşturur"""
        headers = {
            'Content-Type': 'application/json',
            'Accept': '*/*',  # Browser'da böyle kullanılıyor
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': 'https://franchise.getir.com',
            'Referer': 'https://franchise.getir.com/',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br, zstd'  # Browser'da böyle kullanılıyor
        }
        
        if include_auth:
            token = self.auth_manager.get_access_token()
            if token:
                # Token'ı temizle (başında/sonunda boşluk varsa kaldır)
                token = token.strip()
                headers['Authorization'] = f'Bearer {token}'
        
        return headers
    
    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        include_auth: bool = True
    ) -> Optional[Dict[str, Any]]:
        """API isteği yapar"""
        url = f"{self.base_url}{endpoint}"
        headers = self._get_headers(include_auth=include_auth)
        
        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data,
                params=params,
                headers=headers,
                timeout=self.timeout
            )
            
            # Rate limiting hatası
            if response.status_code == 429:
                retry_after = response.headers.get('Retry-After', '120')
                wait_time = int(retry_after) if retry_after.isdigit() else 120
                logger.warning(f"Rate limit - {wait_time} saniye beklemek gerekiyor")
                logger.warning("⚠️ Getir API rate limit'e takıldı. Lütfen birkaç dakika bekleyin veya browser'dan token alın.")
                time.sleep(wait_time)
                return None
            
            # Unauthorized hatası - token yenileme gerekebilir
            if response.status_code == 401:
                error_data = None
                try:
                    error_data = response.json()
                except:
                    pass
                
                if error_data and error_data.get('error') == 'InvalidFranchiseUserToken':
                    logger.error("❌ Token geçersiz! Extension'dan yeni token bekleniyor...")
                    logger.error("💡 Lütfen Getir sitesine gidin ve extension'ın token gönderdiğinden emin olun")
                else:
                    logger.warning("Unauthorized - Token geçersiz olabilir")
                
                # Token yenileme dene
                logger.warning("🔄 401 hatası - Token yenileme deneniyor...")
                if self.auth_manager.check_and_refresh_token():
                    logger.info("✅ Token yenilendi, istek tekrar deneniyor...")
                    # İsteği tekrar dene
                    headers = self._get_headers(include_auth=include_auth)
                    response = self.session.request(
                        method=method,
                        url=url,
                        json=data,
                        params=params,
                        headers=headers,
                        timeout=self.timeout
                    )
                    if response.status_code == 200:
                        return response.json()
                
                return None
            
            # Forbidden hatası - token geçersiz veya yetkisiz olabilir
            if response.status_code == 403:
                logger.error("❌ 403 Forbidden - Token geçersiz veya yetkisiz olabilir")
                
                # Token'ı decode edip detayları logla
                token = None
                try:
                    import base64
                    import json
                    token = self.auth_manager.get_access_token()
                    logger.error(f"🔍 get_access_token() sonucu: {type(token)}, None mu: {token is None}")
                    
                    if token:
                        token = token.strip()  # Token'ı temizle
                        logger.error(f"🔍 Token uzunluğu (strip sonrası): {len(token)}")
                        logger.error(f"🔍 Token başlangıcı: {token[:50]}...")
                        logger.error(f"🔍 Token sonu: ...{token[-50:]}")
                        
                        parts = token.split('.')
                        logger.error(f"🔍 Token parts sayısı: {len(parts)}")
                        
                        if len(parts) == 3:
                            payload = parts[1]
                            padding = 4 - len(payload) % 4
                            if padding != 4:
                                payload += '=' * padding
                            decoded = base64.urlsafe_b64decode(payload)
                            payload_data = json.loads(decoded)
                            logger.error(f"🔍 Token payload: {json.dumps(payload_data, indent=2)}")
                            
                            # Token tipini kontrol et
                            if 'scope' not in payload_data and 'aud' not in payload_data:
                                logger.error("⚠️ ⚠️ ⚠️ UYARI: Bu token Keycloak token'ı değil, internal token!")
                                logger.error("⚠️ Browser'da çalışıyor ama bot'ta çalışmıyor - API gateway token formatını kontrol et!")
                                logger.error("⚠️ Belki de Authorization header formatı yanlış? (Bearer token)")
                        else:
                            logger.error(f"⚠️ Token formatı yanlış! Parts sayısı: {len(parts)} (beklenen: 3)")
                    else:
                        logger.error("⚠️ Token None veya boş!")
                except Exception as e:
                    logger.error(f"❌ Token decode hatası: {e}", exc_info=True)
                
                # Authorization header'ını logla (token'ı gizleyerek)
                try:
                    headers = self._get_headers(include_auth=include_auth)
                    auth_header = headers.get('Authorization', '')
                    logger.error(f"🔍 Authorization header var mı: {bool(auth_header)}")
                    
                    if auth_header:
                        logger.error(f"🔍 Authorization header: {auth_header[:20]}... (uzunluk: {len(auth_header)})")
                        logger.error(f"🔍 Authorization header formatı doğru mu? (Bearer token)")
                        # Token'ın tam olarak ne olduğunu göster
                        if auth_header.startswith('Bearer '):
                            token_in_header = auth_header[7:].strip()
                            logger.error(f"🔍 Header'daki token uzunluğu: {len(token_in_header)}")
                            logger.error(f"🔍 Header'daki token başlangıcı: {token_in_header[:50]}...")
                            logger.error(f"🔍 Header'daki token sonu: ...{token_in_header[-50:]}")
                            # Token'ları karşılaştır
                            if token and token.strip() == token_in_header:
                                logger.error("✅ Token'lar eşleşiyor")
                            else:
                                logger.error("❌ Token'lar eşleşmiyor!")
                                logger.error(f"   AuthManager token: {token[:50] if token else 'None'}...")
                                logger.error(f"   Header token: {token_in_header[:50]}...")
                        else:
                            logger.error(f"⚠️ Authorization header 'Bearer ' ile başlamıyor! Header: {auth_header[:50]}...")
                    else:
                        logger.error("⚠️ Authorization header yok!")
                except Exception as e:
                    logger.error(f"❌ Header log hatası: {e}", exc_info=True)
                
                # Response body'yi de logla
                try:
                    error_data = response.json()
                    logger.error(f"🔍 API Error Response: {json.dumps(error_data, indent=2)}")
                except:
                    logger.error(f"🔍 API Error Response (text): {response.text[:500]}")
                
                logger.error("💡 Extension'dan yeni token bekleniyor...")
                logger.error("💡 Lütfen Getir sitesine gidin ve extension'ın token gönderdiğinden emin olun")
                
                # 403 hatası geldiğinde refresh token ile yenileme deneme
                # Çünkü 176 karakterlik refresh token geçersiz ve client_id yanlış
                # Extension'dan yeni token beklemek daha iyi
                
                # Extension'dan yeni token gelmiş olabilir, session'ı yeniden yükle
                self.auth_manager.load_session()
                if self.auth_manager.is_token_valid() and self.auth_manager.access_token:
                    # Yeni token var, tekrar dene
                    logger.info("🔄 Extension'dan yeni token yüklendi, istek tekrar deneniyor...")
                    headers = self._get_headers(include_auth=include_auth)
                    response = self.session.request(
                        method=method,
                        url=url,
                        json=data,
                        params=params,
                        headers=headers,
                        timeout=self.timeout
                    )
                    if response.status_code == 200:
                        return response.json()
                    elif response.status_code == 403:
                        logger.error("❌ 403 hatası devam ediyor - Token hala geçersiz")
                        logger.error("💡 Extension'dan geçerli bir token (200+ karakter) gönderilmesi gerekiyor")
                
                return None
            
            response.raise_for_status()
            return response.json()
        
        except requests.exceptions.Timeout:
            logger.error(f"API isteği timeout: {endpoint}")
            return None
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Bağlantı hatası: {e}")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"API isteği hatası: {e}")
            return None
    
    def login(self, captcha_token: Optional[str] = None) -> bool:
        """Getir'e giriş yapar"""
        if not self.username or not self.password:
            logger.error("Kullanıcı adı veya şifre bulunamadı")
            return False
        
        # reCAPTCHA token yoksa boş string gönder (bazen gerekmiyor)
        captcha_key = captcha_token or ""
        
        login_data = {
            'username': self.username,
            'password': self.password,
            'captchaKey': captcha_key
        }
        
        logger.info("Giriş yapılıyor...")
        response = self._make_request(
            method='POST',
            endpoint='/auth/login',
            data=login_data,
            include_auth=False
        )
        
        if not response:
            logger.error("Login response alınamadı")
            return False
        
        logger.debug(f"Login response: {list(response.keys()) if isinstance(response, dict) else type(response)}")
        
        # Response formatını kontrol et
        access_token = None
        if 'accessToken' in response:
            access_token = response['accessToken']
        elif 'access_token' in response:
            access_token = response['access_token']
        elif 'token' in response:
            access_token = response['token']
        elif 'data' in response and isinstance(response['data'], dict):
            if 'accessToken' in response['data']:
                access_token = response['data']['accessToken']
        
        if access_token:
            # Token expire süresi genellikle 1 saat
            expires_in = response.get('expiresIn') or response.get('expires_in') or response.get('expires') or 3600
            if isinstance(expires_in, str):
                expires_in = 3600
            
            self.auth_manager.save_session(access_token, expires_in)
            logger.info("Giriş başarılı")
            return True
        else:
            logger.error(f"Giriş başarısız - Response: {response}")
            return False
    
    def refresh_token(self) -> bool:
        """Token'ı yeniler"""
        logger.info("Token yenileniyor...")
        response = self._make_request(
            method='POST',
            endpoint='/auth/token/refresh',
            include_auth=True
        )
        
        if response and 'accessToken' in response:
            access_token = response['accessToken']
            expires_in = response.get('expiresIn', 3600)
            self.auth_manager.save_session(access_token, expires_in)
            logger.info("Token başarıyla yenilendi")
            return True
        
        logger.warning("Token yenileme başarısız, yeniden giriş gerekebilir")
        return False
    
    def ensure_authenticated(self) -> bool:
        """Authenticated olduğundan emin olur"""
        # Token geçerli mi kontrol et, geçersizse refresh et
        if self.auth_manager.check_and_refresh_token():
            logger.info("✅ Token geçerli veya başarıyla yenilendi")
            return True
        
        # Extension'dan token gelmiş olabilir, tekrar kontrol et
        self.auth_manager.load_session()
        if self.auth_manager.is_token_valid():
            logger.info("✅ Extension'dan yeni token yüklendi")
            return True
        
        # Refresh token ile yenileme başarısız oldu
        logger.warning("❌ Token geçersiz ve refresh token ile yenilenemedi")
            logger.warning("💡 Lütfen Getir sitesine gidin ve extension'ın token gönderdiğinden emin olun")
        
        # Token yoksa login yap (ama rate limit riski var)
        if not self.auth_manager.access_token:
        logger.info("Token yok, yeniden giriş yapılıyor...")
        time.sleep(5)  # Rate limiting için daha uzun bekleme
        return self.login()
        
        return False
    
    def search_stocks(self, keyword: str, limit: int = 100, offset: int = 0) -> Optional[List[Dict[str, Any]]]:
        """Stok araması yapar (keyword ile) - hem ürün hem stok bilgilerini döndürür"""
        if not self.ensure_authenticated():
            logger.error("Authentication başarısız")
            return None
        
        params = {
            'limit': limit,
            'offset': offset
        }
        
        warehouse_id = os.getenv('GETIR_WAREHOUSE_ID', '5dcafe6ae2c61b1e52cf1704')
        
        # Browser'da görülen gerçek format (keyword ile arama)
        data = {
            'warehouseId': warehouse_id,  # Tek değer olarak (keyword aramasında)
            'searchFilterOptions': {
                'fullName': True,
                'barcodes': True,
                'supplier': True,
                'brandName': True,
                'manufacturerName': True,
                'masterCategoryName': True
            },
            'language': 'tr',
            'countryCode': 'TR',
            'keyword': keyword
        }
        
        logger.info(f"Stok araması yapılıyor: '{keyword}'")
        response = self._make_request(
            method='POST',
            endpoint='/stocks',
            data=data,
            params=params
        )
        
        if not response:
            logger.error("Stock search response alınamadı")
            return None
        
        logger.debug(f"Stock search response keys: {list(response.keys()) if isinstance(response, dict) else type(response)}")
        
        # Response formatını kontrol et
        stocks = None
        if 'data' in response:
            if isinstance(response['data'], list):
                stocks = response['data']
            elif isinstance(response['data'], dict) and 'data' in response['data']:
                stocks = response['data']['data']
        
        if stocks:
            logger.info(f"{len(stocks)} ürün bulundu (stok araması: '{keyword}')")
            return stocks
        
        logger.warning(f"Stok araması sonuç vermedi: '{keyword}' - Response: {response}")
        return None
    
    def get_stocks(self, limit: int = 100, offset: int = 0, product_ids: Optional[List[str]] = None, filters: Optional[Dict[str, Any]] = None) -> Optional[List[Dict[str, Any]]]:
        """Stok listesini getirir
        
        Args:
            limit: Sayfa başına ürün sayısı
            offset: Başlangıç offset'i
            product_ids: Belirli ürün ID'lerinin stok bilgilerini almak için (opsiyonel)
            filters: Filtre parametreleri (productId, categoryId, vb.)
        """
        if not self.ensure_authenticated():
            logger.error("Authentication başarısız")
            return None
        
        params = {
            'limit': limit,
            'offset': offset
        }
        
        warehouse_id = os.getenv('GETIR_WAREHOUSE_ID', '5dcafe6ae2c61b1e52cf1704')
        
        # Browser'da görülen format: productIds array olarak gönderiliyor
        if product_ids:
            # Ürün ID'leri varsa, browser'da görülen formatı kullan
            data = {
                'warehouseIds': [warehouse_id],  # Array olarak gönder
                'productIds': product_ids,  # Array olarak gönder
                'sort': {'available': 1}  # Browser'da görülen sort formatı
            }
        else:
            # Ürün ID'leri yoksa, genel stok listesi için
            data = {
                'warehouseIds': [warehouse_id],
                'sort': {'available': 1}
            }
        
        # Diğer filtreleri ekle
        if filters:
            data.update(filters)
        
        logger.info(f"Stok verileri çekiliyor (limit={limit}, offset={offset}, product_ids={len(product_ids) if product_ids else 0})...")
        response = self._make_request(
            method='POST',
            endpoint='/stocks',
            data=data,
            params=params
        )
        
        if not response:
            logger.error("Stock response alınamadı")
            return None
        
        logger.debug(f"Stock response keys: {list(response.keys()) if isinstance(response, dict) else type(response)}")
        
        # Response formatını kontrol et - browser'da data.data formatında geldi
        stocks = None
        if isinstance(response, list):
            # Direkt liste olarak geldi
            stocks = response
        elif isinstance(response, dict):
            if 'data' in response:
                if isinstance(response['data'], list):
                    stocks = response['data']
                elif isinstance(response['data'], dict) and 'data' in response['data']:
                    stocks = response['data']['data']
                elif isinstance(response['data'], dict) and 'items' in response['data']:
                    stocks = response['data']['items']
        
        if stocks:
            logger.info(f"{len(stocks)} ürün bulundu")
            return stocks
        
        logger.error(f"Stok verileri alınamadı - Response type: {type(response)}, keys: {list(response.keys()) if isinstance(response, dict) else 'N/A'}")
        return None
    
    def get_stock_by_product_id(self, product_id: str) -> Optional[Dict[str, Any]]:
        """Belirli bir ürünün stok bilgisini getirir"""
        stocks = self.get_stocks(limit=100, offset=0, product_ids=[product_id])
        if stocks and len(stocks) > 0:
            return stocks[0]
        return None
    
    def search_products(self, search_term: str, limit: int = 100) -> Optional[List[Dict[str, Any]]]:
        """Ürün araması yapar (hızlı arama için)"""
        if not self.ensure_authenticated():
            logger.error("Authentication başarısız")
            return None
        
        params = {
            'limit': limit,
            'offset': 0
        }
        
        # Warehouse ID'yi auth manager'dan al veya default kullan
        # Şimdilik hardcode, sonra auth manager'dan alabiliriz
        warehouse_id = os.getenv('GETIR_WAREHOUSE_ID', '5dcafe6ae2c61b1e52cf1704')
        
        # Browser'da görülen gerçek format
        data = {
            'warehouseId': warehouse_id,
            'searchFilterOptions': {
                'fullName': True,
                'barcodes': True,
                'supplier': True,
                'brandName': True,
                'manufacturerName': True,
                'masterCategoryName': True
            },
            'language': 'tr',
            'countryCode': 'TR',
            'keyword': search_term
        }
        
        logger.info(f"Ürün araması yapılıyor: '{search_term}'")
        response = self._make_request(
            method='POST',
            endpoint='/products',
            data=data,
            params=params
        )
        
        if not response:
            logger.error("Product search response alınamadı")
            return None
        
        logger.debug(f"Product search response keys: {list(response.keys()) if isinstance(response, dict) else type(response)}")
        
        # Response formatını kontrol et
        products = None
        if 'data' in response:
            if isinstance(response['data'], list):
                products = response['data']
            elif isinstance(response['data'], dict):
                if 'data' in response['data']:
                    products = response['data']['data']
                elif 'products' in response['data']:
                    products = response['data']['products']
                elif 'items' in response['data']:
                    products = response['data']['items']
        
        if products:
            logger.info(f"{len(products)} ürün bulundu (arama: '{search_term}')")
            return products
        
        logger.warning(f"Ürün araması sonuç vermedi: '{search_term}' - Response: {response}")
        return None
    
    def get_all_stocks(self) -> List[Dict[str, Any]]:
        """Tüm stok verilerini getirir (pagination ile)"""
        all_stocks = []
        offset = 0
        limit = 100
        max_pages = 200  # 8000+ ürün için yeterli (100 * 200 = 20000)
        page_count = 0
        
        while page_count < max_pages:
            stocks = self.get_stocks(limit=limit, offset=offset)
            
            if not stocks or len(stocks) == 0:
                break
            
            all_stocks.extend(stocks)
            page_count += 1
            
            logger.info(f"📊 Sayfa {page_count}: {len(stocks)} ürün alındı, toplam: {len(all_stocks)}")
            
            # Eğer dönen veri limit'ten azsa, son sayfadayız
            if len(stocks) < limit:
                break
            
            offset += limit
            time.sleep(1)  # Rate limiting için bekleme (2 saniyeden 1 saniyeye düşürüldü)
        
        if page_count >= max_pages:
            logger.warning(f"⚠️ Maksimum sayfa sayısına ulaşıldı ({max_pages}) - Daha fazla ürün olabilir")
        
        logger.info(f"✅ Toplam {len(all_stocks)} ürün bulundu ({page_count} sayfa)")
        return all_stocks

