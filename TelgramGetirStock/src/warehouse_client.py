"""Warehouse API Client - SKT bilgisi için"""
import logging
import os
import json
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)


class WarehouseClient:
    """Warehouse API client sınıfı - SKT bilgisi için"""
    
    def __init__(self, bot_token: Optional[str] = None):
        self.base_url = os.getenv('WAREHOUSE_API_BASE_URL', 'https://warehouse-panel-api-gateway.getirapi.com')
        self.warehouse_id = os.getenv('GETIR_WAREHOUSE_ID', '5dcafe6ae2c61b1e52cf1704')
        self.bot_token = bot_token
        
        # Token dosyası yolunu bot token'a göre oluştur
        from src.utils import get_keycloak_token_file_path, get_keycloak_refresh_token_file_path
        self.token_file = get_keycloak_token_file_path(bot_token)
        self.refresh_token_file = get_keycloak_refresh_token_file_path(bot_token)
        self.token_file.parent.mkdir(parents=True, exist_ok=True)
        
        self.keycloak_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.bot_instance = None  # Bot instance referansı (Telegram uyarıları için)
        self._load_token()
        self._load_refresh_token()
        
        # Token yükleme sonucunu logla
        if self.keycloak_token:
            logger.info(f"✅ WarehouseClient başlatıldı - Token yüklendi (uzunluk: {len(self.keycloak_token)})")
        else:
            logger.warning(f"⚠️ WarehouseClient başlatıldı - Token yüklenemedi (dosya: {self.token_file}, var mı: {self.token_file.exists()})")
        
        # Session oluştur
        self.session = requests.Session()
        # Retry'i kaldırdık - direkt hatayı görmek için
        # retry_strategy = Retry(
        #     total=2,
        #     backoff_factor=2,
        #     status_forcelist=[500, 502, 503, 504],
        #     allowed_methods=["GET", "POST"]
        # )
        # adapter = HTTPAdapter(max_retries=retry_strategy)
        # self.session.mount("http://", adapter)
        # self.session.mount("https://", adapter)
        
        self.timeout = 60  # SKT bilgisi için daha uzun timeout
    
    def _load_token(self):
        """Token'ı dosyadan yükler ve expire durumunu kontrol eder"""
        if self.token_file.exists():
            try:
                with open(self.token_file, 'r', encoding='utf-8') as f:
                    token = f.read().strip()
                    if token and token.startswith('eyJ'):
                        # Token'ın expire durumunu kontrol et
                        if self._is_token_valid(token):
                            self.keycloak_token = token
                            logger.info(f"✅ Keycloak token dosyadan yüklendi (ilk 50 karakter): {token[:50]}...")
                        else:
                            logger.warning("⚠️ Token dosyasındaki token expire olmuş! Yeni token gönderin.")
                            self.keycloak_token = None
                    else:
                        logger.warning("Token dosyasında geçersiz token")
            except Exception as e:
                logger.error(f"Token yüklenirken hata: {e}")
        else:
            logger.info("Token dosyası bulunamadı")
    
    def _is_token_valid(self, token: str) -> bool:
        """Token'ın expire olup olmadığını kontrol eder"""
        try:
            import base64
            import json
            import datetime
            
            parts = token.split('.')
            if len(parts) < 2:
                return False
            
            payload = parts[1]
            # Base64 padding ekle
            payload += '=' * (4 - len(payload) % 4)
            decoded = base64.urlsafe_b64decode(payload)
            data = json.loads(decoded)
            
            exp_timestamp = data.get('exp', 0)
            if exp_timestamp == 0:
                return True  # Expire bilgisi yoksa geçerli kabul et
            
            exp_date = datetime.datetime.fromtimestamp(exp_timestamp)
            now = datetime.datetime.now()
            
            # 5 dakika buffer ekle (token expire olmadan önce yenile)
            buffer = datetime.timedelta(minutes=5)
            return exp_date > (now + buffer)
        except Exception as e:
            logger.warning(f"Token expire kontrolü yapılamadı: {e}")
            return True  # Hata durumunda geçerli kabul et
    
    def _save_token(self, token: str):
        """Token'ı dosyaya kaydeder"""
        try:
            # Dosya dizinini oluştur
            self.token_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Token'ı dosyaya yaz
            with open(self.token_file, 'w', encoding='utf-8') as f:
                f.write(token.strip())
            
            # Dosyanın oluştuğunu kontrol et
            if self.token_file.exists():
                logger.info(f"✅ Keycloak token dosyaya kaydedildi: {self.token_file}")
                logger.info(f"Token dosyası boyutu: {self.token_file.stat().st_size} byte")
            else:
                logger.error(f"❌ Token dosyası oluşturulamadı: {self.token_file}")
        except Exception as e:
            logger.error(f"❌ Token kaydedilirken hata: {e}", exc_info=True)
    
    def set_keycloak_token(self, token: str):
        """Keycloak token'ı ayarlar ve dosyaya kaydeder"""
        self.keycloak_token = token
        self._save_token(token)
        logger.info(f"✅ Keycloak token ayarlandı (ilk 50 karakter): {token[:50]}...")
        logger.info(f"Token uzunluğu: {len(token)} karakter")
    
    def set_refresh_token(self, refresh_token: str):
        """Keycloak refresh token'ı ayarlar ve dosyaya kaydeder"""
        self.refresh_token = refresh_token
        self._save_refresh_token(refresh_token)
        logger.info(f"✅ Keycloak refresh token ayarlandı (ilk 50 karakter): {refresh_token[:50]}...")
        logger.info(f"Refresh token uzunluğu: {len(refresh_token)} karakter")
    
    def _load_refresh_token(self):
        """Refresh token'ı dosyadan yükler"""
        if self.refresh_token_file.exists():
            try:
                with open(self.refresh_token_file, 'r', encoding='utf-8') as f:
                    refresh_token = f.read().strip()
                    if refresh_token and refresh_token.startswith('eyJ'):
                        self.refresh_token = refresh_token
                        logger.info(f"✅ Keycloak refresh token dosyadan yüklendi (ilk 50 karakter): {refresh_token[:50]}...")
                    else:
                        logger.warning("Refresh token dosyasında geçersiz token")
            except Exception as e:
                logger.error(f"Refresh token yüklenirken hata: {e}")
        else:
            logger.info("Refresh token dosyası bulunamadı")
    
    def _save_refresh_token(self, refresh_token: str):
        """Refresh token'ı dosyaya kaydeder"""
        try:
            self.refresh_token_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.refresh_token_file, 'w', encoding='utf-8') as f:
                f.write(refresh_token.strip())
            if self.refresh_token_file.exists():
                logger.info(f"✅ Keycloak refresh token dosyaya kaydedildi: {self.refresh_token_file}")
            else:
                logger.error(f"❌ Refresh token dosyası oluşturulamadı: {self.refresh_token_file}")
        except Exception as e:
            logger.error(f"❌ Refresh token kaydedilirken hata: {e}", exc_info=True)

    def _decode_token_expiration(self, token: Optional[str]) -> Optional[datetime]:
        """JWT token içindeki expire bilgisini döndürür"""
        if not token:
            return None
        try:
            import base64
            parts = token.split('.')
            if len(parts) < 2:
                return None
            payload = parts[1]
            payload += '=' * (4 - len(payload) % 4)
            decoded = base64.urlsafe_b64decode(payload)
            data = json.loads(decoded)
            exp_timestamp = data.get('exp', 0)
            if exp_timestamp == 0:
                return None
            return datetime.fromtimestamp(exp_timestamp)
        except Exception as e:
            logger.warning(f"Token expire bilgisi çözülemedi: {e}")
            return None

    def get_token_expiry_info(self) -> Dict[str, Dict[str, Any]]:
        """Access ve refresh token'ların expire bilgilerini döndürür"""
        info: Dict[str, Dict[str, Any]] = {}
        now = datetime.now()

        access_exp = self._decode_token_expiration(self.keycloak_token)
        if access_exp:
            seconds_left = max(int((access_exp - now).total_seconds()), 0)
            info['access'] = {
                'expires_at': access_exp,
                'seconds_left': seconds_left,
                'is_valid': seconds_left > 0
            }
        else:
            info['access'] = {
                'expires_at': None,
                'seconds_left': None,
                'is_valid': False
            }

        refresh_exp = self._decode_token_expiration(self.refresh_token)
        if refresh_exp:
            seconds_left = max(int((refresh_exp - now).total_seconds()), 0)
            info['refresh'] = {
                'expires_at': refresh_exp,
                'seconds_left': seconds_left,
                'is_valid': seconds_left > 0
            }
        else:
            info['refresh'] = {
                'expires_at': None,
                'seconds_left': None,
                'is_valid': False
            }

        return info
    
    def _get_headers(self) -> Dict[str, str]:
        """Request headers'ı oluşturur"""
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://warehouse.getir.com',
            'Referer': f'https://warehouse.getir.com/r/{self.warehouse_id}/stock/stock-management/product/expiration/list',
            'x-requester-client': 'warehouse-panel-frontend',
            'language': 'tr',
            'countryCode': 'TR',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        
        if self.keycloak_token:
            headers['Authorization'] = f'Bearer {self.keycloak_token}'
        
        return headers
    
    def get_expiring_products(self, product_ids: List[str]) -> Optional[Dict[str, Any]]:
        """Ürünlerin SKT bilgisini yeni warehouse endpoint'inden alır.
        
        Args:
            product_ids: Ürün ID listesi
            
        Returns:
            API response dict'i (data/result) veya None
        """
        # Token'ı kontrol et ve gerekirse yenile
        if not self.check_and_refresh_token():
            logger.error("Keycloak token bulunamadı veya yenilenemedi")
            return None
        
        if not product_ids:
            logger.warning("Product IDs boş")
            return None
        
        # Tarih aralığı: removeFromSaleDateRange parametresi bekleniyor
        # Browser isteğinde tarih aralığı yerel (TR) saatine göre hesaplanıp UTC'ye çevriliyor
        tz_offset_hours = int(os.getenv('WAREHOUSE_TZ_OFFSET', '3'))
        tz_offset = timedelta(hours=tz_offset_hours)
        
        now_utc = datetime.utcnow()
        now_local = now_utc + tz_offset
        local_start = datetime(
            year=now_local.year,
            month=now_local.month,
            day=now_local.day,
            hour=0,
            minute=0,
            second=0,
            microsecond=0
        )
        start_date = local_start - tz_offset
        
        local_end = datetime(2029, 12, 31, 23, 59, 59, 999000)
        end_date = local_end - tz_offset
        
        endpoint = f'/warehouse/{self.warehouse_id}/get-expiring-products'
        url = f'{self.base_url}{endpoint}'
        
        payload = {
            "removeFromSaleDateRange": {
                "startDate": start_date.isoformat() + 'Z',
                "endDate": end_date.isoformat() + 'Z'
            },
            "productIds": product_ids
        }
        
        logger.info(
            "SKT request hazırlanıyor | url=%s | payload=%s | product_count=%s",
            url,
            payload,
            len(product_ids)
        )
        
        try:
            response = self.session.post(
                url,
                headers=self._get_headers(),
                json=payload,
                timeout=self.timeout
            )
            logger.info("SKT response status: %s", response.status_code)
            
            if response.status_code != 200:
                logger.error("❌ SKT endpoint HTTP %s döndürdü", response.status_code)
                logger.error("Response text (ilk 2000): %s", response.text[:2000])
                return None
            
                result = response.json()
            # Beklenen format: {"data":{"items":[...]}, "result": {...}}
            data_section = None
            if isinstance(result, dict):
                data_section = result.get('data')
                if isinstance(data_section, dict) and 'items' in data_section:
                    items = data_section.get('items', [])
                    logger.info("SKT bilgisi alındı: %s kayıt", len(items))
                elif isinstance(result.get('data'), list):
                    logger.info("SKT bilgisi alındı: %s kayıt", len(result.get('data', [])))
                else:
                    logger.warning("Beklenmeyen SKT data formatı: %s", type(data_section))
            else:
                logger.warning("Beklenmeyen SKT response formatı: %s", type(result))
            
            if data_section:
                return result
            
            return result  # Liste vs. olsa bile döndür
                
        except Exception as e:
            logger.error("SKT bilgisi alınırken hata: %s", e, exc_info=True)
            return None
    
    def search_products(self, keyword: str) -> Optional[List[Dict[str, Any]]]:
        """Warehouse API'sinde ürün araması yapar
        
        Args:
            keyword: Arama kelimesi (ürün adı)
            
        Returns:
            Ürün listesi veya None (hata durumunda)
        """
        if not self.keycloak_token:
            logger.error("Keycloak token bulunamadı")
            return None
        
        # Browser'da görülen endpoint: /v3/products/filter?offset=0&limit=10
        # offset ve limit query parametreleri URL'de gönderiliyor!
        endpoint = '/v3/products/filter'
        url = f'{self.base_url}{endpoint}?offset=0&limit=50'
        
        # Browser'da görülen gerçek format - filter endpoint'i için
        # offset ve limit URL'de, diğerleri body'de
        data = {
            "fields": "_id barcodes picURL fullName",
            "includeDefaultFields": False,
            "status": [0, 1, 2, 3, 4],
            "searchFilterOptions": {
                "fullName": True,
                "barcodes": True,
                "id": True
            },
            "keyword": keyword,
            "language": "tr"
        }
        
        logger.info(f"🏭 WAREHOUSE API ürün araması: keyword='{keyword}'")
        logger.info(f"🏭 WAREHOUSE API endpoint: {endpoint}")
        logger.info(f"🏭 WAREHOUSE API URL: {url}")
        logger.info(f"🏭 WAREHOUSE API request data: {data}")
        
        try:
            response = self.session.post(
                url,
                json=data,
                headers=self._get_headers(),
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.debug(f"Warehouse product search response: {result}")
                
                # Response formatı: {"data": {"products": [...], "total": 1}, "result": {...}}
                if isinstance(result, dict) and 'data' in result:
                    data_dict = result.get('data', {})
                    if isinstance(data_dict, dict) and 'products' in data_dict:
                        products = data_dict.get('products', [])
                        logger.info(f"Warehouse ürün araması: {len(products)} ürün bulundu")
                        return products
                
                logger.warning(f"Beklenmeyen response formatı: {type(result)}, response: {result}")
                return None
            else:
                logger.error(f"Warehouse ürün araması başarısız: {response.status_code}")
                logger.error(f"Response text: {response.text[:500]}")
                return None
                
        except Exception as e:
            logger.error(f"Warehouse ürün araması sırasında hata: {e}", exc_info=True)
            return None
    
    def refresh_access_token(self) -> bool:
        """Refresh token kullanarak yeni access token alır
        
        Returns:
            True if successful, False otherwise
        """
        if not self.refresh_token:
            logger.error("❌ Refresh token bulunamadı, token yenilenemiyor")
            return False
        
        # Keycloak token endpoint URL'i
        keycloak_url = "https://stockid.getirapi.com/realms/getir-prod/protocol/openid-connect/token"
        
        # Refresh token ile yeni access token al
        payload = {
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token,
            "client_id": "warehouse-panel-frontend"  # Browser'dan görülen client_id
        }
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
        }
        
        try:
            logger.info("🔄 Refresh token ile yeni access token alınıyor...")
            response = self.session.post(
                keycloak_url,
                data=payload,
                headers=headers,
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                data = response.json()
                new_access_token = data.get('access_token')
                new_refresh_token = data.get('refresh_token')
                
                if new_access_token:
                    self.set_keycloak_token(new_access_token)
                    logger.info("✅ Access token başarıyla yenilendi")
                    
                    # Yeni refresh token varsa onu da kaydet
                    if new_refresh_token:
                        self.set_refresh_token(new_refresh_token)
                        logger.info("✅ Refresh token da güncellendi")
                    
                    return True
                else:
                    logger.error("❌ Token yenileme response'unda access_token bulunamadı")
                    return False
            else:
                logger.error(f"❌ Token yenileme başarısız: HTTP {response.status_code}")
                logger.error(f"Response: {response.text[:500]}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Token yenileme sırasında hata: {e}", exc_info=True)
            return False
    
    def check_and_refresh_token(self) -> bool:
        """Token'ın expire olup olmadığını kontrol eder ve gerekirse yeniler
        
        Returns:
            True if token is valid or successfully refreshed, False otherwise
        """
        if not self.keycloak_token:
            logger.warning("⚠️ Access token yok, refresh token ile yenileme deneniyor...")
            return self.refresh_access_token()
        
        # Token expire kontrolü (1-2 dakika kala yenile)
        if not self._is_token_valid(self.keycloak_token):
            logger.warning("⚠️ Access token expire olmak üzere, refresh token ile yenileme deneniyor...")
            return self.refresh_access_token()
        
        return True
    
    def check_refresh_token_expire_warning(self) -> Optional[datetime]:
        """Refresh token'ın expire olup olmadığını kontrol eder ve 10 dakika kala uyarı gönderir
        
        Returns:
            Refresh token expire tarihi veya None
        """
        if not self.refresh_token:
            return None
        
        try:
            import base64
            
            parts = self.refresh_token.split('.')
            if len(parts) < 2:
                return None
            
            payload = parts[1]
            payload += '=' * (4 - len(payload) % 4)
            decoded = base64.urlsafe_b64decode(payload)
            data = json.loads(decoded)
            
            exp_timestamp = data.get('exp', 0)
            if exp_timestamp == 0:
                return None
            
            exp_date = datetime.fromtimestamp(exp_timestamp)
            now = datetime.now()
            
            # 10 dakika kala uyarı gönder
            warning_threshold = timedelta(minutes=10)
            time_until_expire = exp_date - now
            
            if warning_threshold >= time_until_expire > timedelta(0):
                # 10 dakika veya daha az kaldı, uyarı gönder
                if self.bot_instance:
                    try:
                        # Tüm aktif kullanıcılara uyarı gönder
                        from src.settings_manager import SettingsManager
                        settings_manager = SettingsManager()
                        active_users = settings_manager.get_all_users()
                        
                        warning_message = (
                            "⚠️ *Keycloak Refresh Token Uyarısı*\n\n"
                            f"🕐 Refresh token'ın expire olmasına {int(time_until_expire.total_seconds() / 60)} dakika kaldı.\n\n"
                            "📝 Lütfen warehouse.getir.com sayfasında tekrar giriş yapın veya sayfayı yenileyin.\n\n"
                            "💡 Bu işlem yapılmazsa SKT özelliği çalışmayabilir."
                        )
                        
                        # Uyarı gönderme işlemini bot instance'a bırak (async context'te)
                        # Bu fonksiyon sync olduğu için, bot instance'a bir flag set edelim
                        # Bot instance periyodik kontrol sırasında bu flag'i kontrol edip uyarı gönderecek
                        logger.warning(
                            f"⚠️ ⚠️ ⚠️ REFRESH TOKEN EXPIRE UYARISI: "
                            f"{int(time_until_expire.total_seconds() / 60)} dakika kaldı!"
                        )
                        # Bot instance'a uyarı mesajını kaydet (bot.py'de periyodik kontrol sırasında gönderilecek)
                        if not hasattr(self.bot_instance, '_pending_refresh_token_warning'):
                            self.bot_instance._pending_refresh_token_warning = []
                        self.bot_instance._pending_refresh_token_warning.append({
                            'message': warning_message,
                            'users': active_users,
                            'expire_date': exp_date
                        })
                    except Exception as e:
                        logger.error(f"❌ Refresh token uyarısı gönderilirken hata: {e}", exc_info=True)
                
                return exp_date
            
            return exp_date
            
        except Exception as e:
            logger.warning(f"Refresh token expire kontrolü yapılamadı: {e}")
            return None

