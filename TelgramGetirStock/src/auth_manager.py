"""Authentication ve session yönetimi"""
import json
import logging
import time
import base64
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

from src.utils import get_session_file_path, get_franchise_refresh_token_file_path

logger = logging.getLogger(__name__)


class AuthManager:
    """Getir authentication ve session yönetimi"""
    
    def __init__(self, bot_token: Optional[str] = None):
        self.bot_token = bot_token
        self.session_file = get_session_file_path(bot_token)
        self.refresh_token_file = get_franchise_refresh_token_file_path(bot_token)
        self.access_token: Optional[str] = None
        self.token_expires_at: Optional[datetime] = None
        self.refresh_token: Optional[str] = None
        self.load_session()
        self._load_refresh_token()
    
    def load_session(self) -> bool:
        """Kaydedilmiş session'ı yükler"""
        try:
            if not self.session_file.exists():
                logger.info("Session dosyası bulunamadı")
                return False
            
            with open(self.session_file, 'r', encoding='utf-8') as f:
                session_data = json.load(f)
            
            self.access_token = session_data.get('access_token')
            expires_at_str = session_data.get('expires_at')
            
            if self.access_token and expires_at_str:
                # datetime.fromisoformat Python 3.7+ için var, ama güvenli fallback ekle
                try:
                    self.token_expires_at = datetime.fromisoformat(expires_at_str)
                except (ValueError, AttributeError):
                    # Fallback: Manuel parse et
                    try:
                        # ISO format: 2024-01-01T00:00:00 veya 2024-01-01T00:00:00.000000
                        if 'T' in expires_at_str:
                            date_part, time_part = expires_at_str.split('T')
                            time_part = time_part.split('.')[0]  # Mikrosaniyeleri kaldır
                            year, month, day = date_part.split('-')
                            hour, minute, second = time_part.split(':')
                            self.token_expires_at = datetime(int(year), int(month), int(day), int(hour), int(minute), int(second))
                        else:
                            # Sadece tarih: 2024-01-01
                            year, month, day = expires_at_str.split('-')
                            self.token_expires_at = datetime(int(year), int(month), int(day))
                    except Exception as e:
                        logger.error(f"Tarih parse edilemedi: {expires_at_str}, Hata: {e}")
                        self.token_expires_at = None
                
                # Token'ın hala geçerli olup olmadığını kontrol et
                is_valid = self.is_token_valid()
                logger.info(f"Session yüklendi - Token: {self.access_token[:30]}..., Expires: {self.token_expires_at}, Geçerli: {is_valid}, Şu an: {datetime.now()}")
                
                if is_valid:
                    logger.info("Session başarıyla yüklendi - Token geçerli")
                    return True
                else:
                    logger.warning(f"Token süresi dolmuş veya yakında dolacak - Expires: {self.token_expires_at}, Şu an: {datetime.now()}")
                    # Token'ı silme, sadece geçersiz olarak işaretle (refresh denenebilir)
                    # self.access_token = None
                    # self.token_expires_at = None
            
            return False
        except Exception as e:
            logger.error(f"Session yükleme hatası: {e}")
            return False
    
    def _decode_jwt_exp(self, token: str) -> Optional[int]:
        """JWT token'ından expire süresini çıkarır"""
        try:
            # JWT formatı: header.payload.signature
            parts = token.split('.')
            if len(parts) != 3:
                return None
            
            # Payload'ı decode et
            payload = parts[1]
            # Base64 padding ekle
            padding = 4 - len(payload) % 4
            if padding != 4:
                payload += '=' * padding
            
            decoded = base64.urlsafe_b64decode(payload)
            payload_data = json.loads(decoded)
            
            # exp (expiration time) Unix timestamp olarak gelir
            exp = payload_data.get('exp')
            if exp:
                return exp
            
            return None
        except Exception as e:
            logger.debug(f"JWT decode hatası: {e}")
            return None
    
    def save_session(self, access_token: str, expires_in: int = 3600):
        """Session'ı kaydeder"""
        try:
            # Token'ı temizle (başında/sonunda boşluk varsa kaldır)
            access_token = access_token.strip()
            
            # JWT'den expire süresini çıkar
            exp_timestamp = self._decode_jwt_exp(access_token)
            
            if exp_timestamp:
                # Unix timestamp'i datetime'a çevir
                expires_at = datetime.fromtimestamp(exp_timestamp)
                logger.info(f"Token expire süresi JWT'den alındı: {expires_at}")
            else:
                # JWT'den alınamazsa expires_in kullan
                expires_at = datetime.now() + timedelta(seconds=expires_in)
                logger.info(f"Token expire süresi varsayılan olarak ayarlandı: {expires_in} saniye")
            
            session_data = {
                'access_token': access_token,
                'expires_at': expires_at.isoformat(),
                'saved_at': datetime.now().isoformat()
            }
            
            with open(self.session_file, 'w', encoding='utf-8') as f:
                json.dump(session_data, f, indent=2, ensure_ascii=False)
            
            self.access_token = access_token
            self.token_expires_at = expires_at
            
            logger.info(f"Session başarıyla kaydedildi - Expires at: {expires_at}")
        except Exception as e:
            logger.error(f"Session kaydetme hatası: {e}")
    
    def is_token_valid(self) -> bool:
        """Token'ın geçerli olup olmadığını kontrol eder"""
        if not self.access_token or not self.token_expires_at:
            return False
        
        # Buffer kaldırıldı - sadece gerçekten expire olmuş mu kontrol et
        # 30 saniye buffer ekle (çok küçük, sadece zaman farkı için)
        buffer_time = timedelta(seconds=30)
        is_valid = datetime.now() < (self.token_expires_at - buffer_time)
        
        if not is_valid:
            time_diff = (self.token_expires_at - datetime.now()).total_seconds()
            logger.warning(f"Token expire kontrolü - Expires: {self.token_expires_at}, Şu an: {datetime.now()}, Fark: {time_diff:.0f} saniye")
        
        return is_valid
    
    def get_access_token(self) -> Optional[str]:
        """Geçerli access token'ı döndürür, geçersizse refresh eder"""
        # Token geçerli mi kontrol et, geçersizse refresh et
        if not self.is_token_valid():
            logger.warning("⚠️ Access token geçersiz, refresh token ile yenileniyor...")
            if not self.check_and_refresh_token():
                logger.error("❌ Access token yenilenemedi")
                return None
        
        # Token geçerliyse veya başarıyla yenilendiyse döndür
            return self.access_token
    
    def clear_session(self):
        """Session'ı temizler"""
        self.access_token = None
        self.token_expires_at = None
        try:
            if self.session_file.exists():
                self.session_file.unlink()
                logger.info("Session temizlendi")
        except Exception as e:
            logger.error(f"Session temizleme hatası: {e}")
    
    def _load_refresh_token(self):
        """Refresh token'ı dosyadan yükler"""
        if self.refresh_token_file.exists():
            try:
                with open(self.refresh_token_file, 'r', encoding='utf-8') as f:
                    refresh_token = f.read().strip()
                    if refresh_token and refresh_token.startswith('eyJ'):
                        self.refresh_token = refresh_token
                        logger.info(f"✅ Franchise refresh token dosyadan yüklendi (ilk 50 karakter): {refresh_token[:50]}...")
                    else:
                        logger.warning("Franchise refresh token dosyasında geçersiz token")
            except Exception as e:
                logger.error(f"Franchise refresh token yüklenirken hata: {e}")
        else:
            logger.info("Franchise refresh token dosyası bulunamadı")
    
    def set_refresh_token(self, refresh_token: str):
        """Franchise refresh token'ı ayarlar ve dosyaya kaydeder"""
        self.refresh_token = refresh_token
        self._save_refresh_token(refresh_token)
        logger.info(f"✅ Franchise refresh token ayarlandı (ilk 50 karakter): {refresh_token[:50]}...")
        logger.info(f"Refresh token uzunluğu: {len(refresh_token)} karakter")
    
    def _save_refresh_token(self, refresh_token: str):
        """Refresh token'ı dosyaya kaydeder"""
        try:
            self.refresh_token_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.refresh_token_file, 'w', encoding='utf-8') as f:
                f.write(refresh_token.strip())
            if self.refresh_token_file.exists():
                logger.info(f"✅ Franchise refresh token dosyaya kaydedildi: {self.refresh_token_file}")
            else:
                logger.error(f"❌ Franchise refresh token dosyası oluşturulamadı: {self.refresh_token_file}")
        except Exception as e:
            logger.error(f"❌ Franchise refresh token kaydedilirken hata: {e}", exc_info=True)
    
    def _decode_token_expiration(self, token: Optional[str]) -> Optional[datetime]:
        """JWT token içindeki expire bilgisini döndürür"""
        if not token:
            return None
        try:
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
    
    def refresh_access_token(self) -> bool:
        """Refresh token kullanarak yeni access token alır
        
        Returns:
            True if successful, False otherwise
        """
        if not self.refresh_token:
            logger.error("❌ Franchise refresh token bulunamadı, token yenilenemiyor")
            return False
        
        # Franchise API /auth/token/refresh endpoint'i kullan
        # Browser Network sekmesinde görüldü: POST https://franchise-api-gateway.getirapi.com/auth/token/refresh
        refresh_url = "https://franchise-api-gateway.getirapi.com/auth/token/refresh"
        
        # Refresh token ile yeni access token al
        import requests
        
        # Mevcut access token'ı Authorization header'ında gönder (browser'da böyle yapılıyor)
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Origin": "https://franchise.getir.com",
            "Referer": "https://franchise.getir.com/",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        # Mevcut access token varsa Authorization header'ına ekle
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        
        # Payload: refreshToken (camelCase)
        payload = {
            "refreshToken": self.refresh_token
        }
        
        logger.info(f"🔄 🔄 🔄 Franchise access token yenileniyor (/auth/token/refresh endpoint'i ile)...")
        logger.info(f"🔄 Refresh token uzunluğu: {len(self.refresh_token)}")
        logger.info(f"🔄 Refresh URL: {refresh_url}")
        logger.info(f"🔄 Mevcut access token var mı: {bool(self.access_token)}")
        if self.access_token:
            logger.info(f"🔄 Mevcut access token uzunluğu: {len(self.access_token)}")
        
        try:
            logger.info(f"🔄 POST isteği gönderiliyor: {refresh_url}")
            response = requests.post(refresh_url, json=payload, headers=headers, timeout=10)
            logger.info(f"🔄 Response status code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                new_access_token = data.get('accessToken')  # camelCase
                new_refresh_token = data.get('refreshToken')  # camelCase
                
                if new_access_token:
                    # Token expire süresini JWT'den al
                    expires_at = self._decode_token_expiration(new_access_token)
                    if expires_at:
                        expires_in = int((expires_at - datetime.now()).total_seconds())
                        logger.info(f"✅ Token expire süresi JWT'den alındı: {expires_at}, kalan süre: {expires_in} saniye")
                    else:
                        expires_in = 1800  # Varsayılan 30 dakika
                        logger.warning(f"⚠️ Token expire süresi JWT'den alınamadı, varsayılan kullanılıyor: {expires_in} saniye")
                    
                    # Yeni access token'ı kaydet
                    self.save_session(new_access_token, expires_in)
                    logger.info("✅ ✅ ✅ Franchise access token başarıyla yenilendi (/auth/token/refresh)")
                    
                    # Yeni refresh token varsa onu da kaydet
                    if new_refresh_token:
                        self.set_refresh_token(new_refresh_token)
                        logger.info("✅ Franchise refresh token da güncellendi")
                    
                    return True
                else:
                    logger.error("❌ Franchise token yenileme yanıtında accessToken bulunamadı")
                    logger.error(f"❌ Response: {response.text[:500]}")
                    return False
            else:
                logger.error(f"❌ ❌ ❌ Franchise token yenileme hatası: {response.status_code}")
                logger.error(f"❌ Response text (ilk 500 karakter): {response.text[:500]}")
                try:
                    error_data = response.json()
                    logger.error(f"❌ Response JSON: {error_data}")
                except:
                    pass
                return False
        except Exception as e:
            logger.error(f"❌ ❌ ❌ Franchise token yenileme exception hatası: {e}", exc_info=True)
            return False
    
    def check_and_refresh_token(self) -> bool:
        """Token'ın geçerli olup olmadığını kontrol eder, geçersizse refresh eder
        
        Returns:
            True if token is valid or successfully refreshed, False otherwise
        """
        if self.is_token_valid():
            logger.debug("✅ Franchise access token geçerli, refresh gerekmiyor")
            return True
        
        # Token geçersiz, refresh et
        logger.warning("⚠️ ⚠️ ⚠️ Franchise access token geçersiz, refresh token ile yenileniyor...")
        logger.info(f"🔄 Refresh token mevcut mu: {bool(self.refresh_token)}")
        if self.refresh_token:
            logger.info(f"🔄 Refresh token uzunluğu: {len(self.refresh_token)} karakter")
            logger.info(f"🔄 Refresh token başlangıcı: {self.refresh_token[:50]}...")
        else:
            logger.error("❌ ❌ ❌ Refresh token bulunamadı! Extension'dan refresh token gönderilmesi gerekiyor.")
            return False
        
        result = self.refresh_access_token()
        if result:
            logger.info("✅ ✅ ✅ Franchise token başarıyla yenilendi")
        else:
            logger.error("❌ ❌ ❌ Franchise token yenilenemedi - refresh_access_token() False döndü")
        return result
    
    def get_token_expiry_info(self) -> Dict[str, Any]:
        """Token expire bilgilerini döndürür (access ve refresh token)"""
        now = datetime.now()
        info: Dict[str, Any] = {}
        
        # Access token bilgisi
        if not self.access_token or not self.token_expires_at:
            info['access'] = {
                'expires_at': None,
                'seconds_left': None,
                'is_valid': False
            }
        else:
            seconds_left = max(int((self.token_expires_at - now).total_seconds()), 0)
            info['access'] = {
                'expires_at': self.token_expires_at,
                'seconds_left': seconds_left,
                'is_valid': seconds_left > 0
            }
        
        # Refresh token bilgisi
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

