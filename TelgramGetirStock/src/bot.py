"""Telegram Bot Ana Dosyası"""
import logging
import os
import time
import threading
from collections import defaultdict
from typing import List, Optional, Dict, Any
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import requests

from telegram import Update, InputMediaPhoto
from telegram.error import BadRequest
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes
)

from src.stock_service import StockService
from src.utils import format_stock_message, get_product_image_url, get_barcode_image_for_product
from src.settings_manager import SettingsManager
from src.warehouse_client import WarehouseClient

logger = logging.getLogger(__name__)

# Rate limiting için
_user_requests = defaultdict(list)
RATE_LIMIT_REQUESTS = 10  # Dakikada maksimum istek sayısı
RATE_LIMIT_WINDOW = 60  # Saniye cinsinden pencere


# Global bot instance referansı (Keycloak token için)
_global_bot_instance = None

class TokenUpdateHandler(BaseHTTPRequestHandler):
    """HTTP server handler - Extension'dan token alır"""
    
    def _send_cors_headers(self):
        """CORS header'larını gönderir"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '3600')
    
    def do_OPTIONS(self):
        """CORS preflight request'i handle eder"""
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()
    
    def do_POST(self):
        global _global_bot_instance
        
        # Path'i normalize et (query string'i kaldır)
        path = self.path.split('?')[0]
        logger.info(f"📥 POST isteği alındı: {self.path} (normalize: {path})")
        
        if path == '/update-keycloak-token':
            # Keycloak token güncellemesi (warehouse.getir.com için)
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                token = data.get('token')
                
                if token and token.startswith('eyJ'):
                    # WAREHOUSE TOKEN - WarehouseClient'a kaydet (warehouse API için)
                    if _global_bot_instance:
                        logger.info(f"✅ ✅ ✅ WAREHOUSE Keycloak token alındı (warehouse API için) - İlk 50 karakter: {token[:50]}...")
                        logger.info(f"📏 WAREHOUSE token uzunluğu: {len(token)} karakter")
                        _global_bot_instance.warehouse_client.set_keycloak_token(token)
                        logger.info(f"✅ ✅ ✅ WAREHOUSE Keycloak token warehouse client'a set edildi ve kaydedildi")
                        logger.info(f"🔍 WAREHOUSE token dosyası kontrolü: {_global_bot_instance.warehouse_client.token_file.exists()}")
                    else:
                        logger.warning("❌ Global bot instance bulunamadı - WAREHOUSE token set edilemedi")
                    
                    self._send_cors_headers()
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': True, 'message': 'Warehouse Keycloak token updated', 'type': 'warehouse'}).encode())
                else:
                    self._send_cors_headers()
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': False, 'error': 'Invalid token format'}).encode())
            except Exception as e:
                logger.error(f"Keycloak token update hatası: {e}")
                self._send_cors_headers()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode())
        
        elif path == '/update-keycloak-refresh-token':
            # Keycloak refresh token güncellemesi (warehouse.getir.com için)
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                refresh_token = data.get('refreshToken')
                
                if refresh_token and refresh_token.startswith('eyJ'):
                    # WAREHOUSE REFRESH TOKEN - WarehouseClient'a kaydet
                    if _global_bot_instance:
                        logger.info(f"✅ ✅ ✅ WAREHOUSE Keycloak refresh token alındı - İlk 50 karakter: {refresh_token[:50]}...")
                        logger.info(f"📏 WAREHOUSE refresh token uzunluğu: {len(refresh_token)} karakter")
                        _global_bot_instance.warehouse_client.set_refresh_token(refresh_token)
                        logger.info(f"✅ ✅ ✅ WAREHOUSE Keycloak refresh token warehouse client'a set edildi ve kaydedildi")
                    else:
                        logger.warning("❌ Global bot instance bulunamadı - WAREHOUSE refresh token set edilemedi")
                    
                    self._send_cors_headers()
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': True, 'message': 'Warehouse Keycloak refresh token updated', 'type': 'warehouse'}).encode())
                else:
                    self._send_cors_headers()
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': False, 'error': 'Invalid refresh token format'}).encode())
            except Exception as e:
                logger.error(f"Keycloak refresh token update hatası: {e}")
                self._send_cors_headers()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode())
        
        elif path == '/update-token':
            # FRANCHISE TOKEN ENDPOINT - franchise.getir.com için
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_response(400)
                self._send_cors_headers()
                self.end_headers()
                return
            
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                token = data.get('token')
                
                if token:
                    # Token'ı temizle (başında/sonunda boşluk varsa kaldır)
                    token = token.strip()
                    
                    # Token format kontrolü - JWT token'lar eyJ ile başlar
                    # Uzunluk kontrolü kaldırıldı - franchise token'ları 176 karakter olabilir (normal)
                    # Önemli olan token'ın geçerli olması, uzunluğu değil
                    token_length = len(token)
                    if token_length < 100:
                        logger.warning(f"⚠️ FRANCHISE ACCESS token çok kısa: {token_length} karakter (minimum: 100)")
                        self.send_response(400)
                        self.send_header('Content-Type', 'application/json')
                        self._send_cors_headers()
                        self.end_headers()
                        self.wfile.write(json.dumps({
                            'error': f'Access token çok kısa: {token_length} karakter (minimum: 100)',
                            'token_length': token_length
                        }).encode())
                        return
                    
                    # Token format kontrolü - JWT token'lar eyJ ile başlar
                    if not token.startswith('eyJ'):
                        logger.warning(f"⚠️ FRANCHISE token geçersiz format: {token[:50]}")
                        self.send_response(400)
                        self.send_header('Content-Type', 'application/json')
                        self._send_cors_headers()
                        self.end_headers()
                        self.wfile.write(json.dumps({'error': 'Token geçersiz format (JWT token eyJ ile başlamalı)'}).encode())
                        return
                    
                    # FRANCHISE TOKEN - AuthManager'a kaydet (franchise API için)
                    # Bot token'ı global instance'dan al (her bot kendi token dosyasını kullanacak)
                    bot_token = _global_bot_instance.token if _global_bot_instance else None
                    
                    from src.auth_manager import AuthManager
                    auth_manager = AuthManager(bot_token=bot_token)
                    
                    # Token'ın expire süresini JWT'den al
                    exp_timestamp = auth_manager._decode_jwt_exp(token)
                    if exp_timestamp:
                        expires_at = datetime.fromtimestamp(exp_timestamp)
                        expires_in = int((expires_at - datetime.now()).total_seconds())
                        logger.info(f"🔍 Token expire süresi JWT'den alındı: {expires_at}, kalan süre: {expires_in} saniye")
                        if expires_in <= 0:
                            logger.warning(f"⚠️ Token zaten expire olmuş! Expires: {expires_at}, Şu an: {datetime.now()}")
                    else:
                        expires_in = 3600  # Varsayılan 1 saat
                        logger.warning(f"⚠️ Token expire süresi JWT'den alınamadı, varsayılan kullanılıyor: {expires_in} saniye")
                    
                    auth_manager.save_session(token, expires_in)
                    # Session'ı yeniden yükle (yeni token'ı kullanmak için)
                    auth_manager.load_session()
                    
                    # StockService'in client'ını da güncelle (cache'i temizlemek için)
                    if _global_bot_instance:
                        _global_bot_instance.stock_service.client.auth_manager = auth_manager
                    
                    logger.info(f"✅ ✅ ✅ FRANCHISE ACCESS token alındı ve kaydedildi (franchise API için) - Geçerli: {auth_manager.is_token_valid()}")
                    logger.info(f"🔍 FRANCHISE ACCESS token uzunluğu: {len(token)} karakter")
                    
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': True, 'type': 'franchise'}).encode())
                else:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'Franchise token bulunamadı'}).encode())
            except Exception as e:
                logger.error(f"FRANCHISE token güncelleme hatası: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
        
        elif path == '/update-franchise-refresh-token':
            # FRANCHISE REFRESH TOKEN ENDPOINT
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_response(400)
                self._send_cors_headers()
                self.end_headers()
                return
            
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                refresh_token = data.get('refreshToken')
                
                # Refresh token uzunluk kontrolü - 176 karakter çok kısa, muhtemelen geçersiz
                if refresh_token and isinstance(refresh_token, str) and refresh_token.startswith('eyJ') and len(refresh_token) >= 150:
                    if len(refresh_token) < 180:
                        logger.warning(f"⚠️ FRANCHISE refresh token çok kısa: {len(refresh_token)} karakter (beklenen: 200+)")
                        logger.warning(f"⚠️ Bu muhtemelen geçersiz bir refresh token, ama kaydediliyor...")
                    
                    # Bot token'ı global instance'dan al
                    bot_token = _global_bot_instance.token if _global_bot_instance else None
                    
                    from src.auth_manager import AuthManager
                    auth_manager = AuthManager(bot_token=bot_token)
                    auth_manager.set_refresh_token(refresh_token)
                    
                    # StockService'in client'ını da güncelle
                    if _global_bot_instance:
                        _global_bot_instance.stock_service.client.auth_manager = auth_manager
                    
                    logger.info(f"✅ ✅ ✅ FRANCHISE refresh token alındı ve kaydedildi (uzunluk: {len(refresh_token)})")
                    
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': True, 'message': 'Franchise refresh token updated', 'type': 'franchise'}).encode())
                else:
                    self._send_cors_headers()
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': False, 'error': 'Invalid refresh token format'}).encode())
            except Exception as e:
                logger.error(f"Franchise refresh token update hatası: {e}")
                self._send_cors_headers()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode())
        
        elif path == '/settings':
            # Ayarları kaydet
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_response(400)
                self._send_cors_headers()
                self.end_headers()
                return
            
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                skt_enabled = data.get('skt_enabled', False)
                
                if not _global_bot_instance:
                    self.send_response(500)
                    self._send_cors_headers()
                    self.end_headers()
                    return
                
                # Tüm kullanıcılar için SKT ayarını güncelle
                settings = _global_bot_instance.settings_manager.settings
                for user_id in settings.keys():
                    _global_bot_instance.settings_manager.set_skt_enabled(user_id, skt_enabled)
                
                logger.info(f"✅ SKT ayarı güncellendi: {skt_enabled}")
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'skt_enabled': skt_enabled}).encode())
            except Exception as e:
                logger.error(f"Ayar kaydetme hatası: {e}")
                self.send_response(500)
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
        
        elif path == '/skt-toggle':
            # SKT aç/kapa (hızlı toggle)
            if not _global_bot_instance:
                self.send_response(500)
                self._send_cors_headers()
                self.end_headers()
                return
            
            settings = _global_bot_instance.settings_manager.settings
            if not settings:
                self.send_response(400)
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Kullanıcı bulunamadı'}).encode())
                return
            
            # İlk kullanıcının mevcut ayarını al ve tersine çevir
            first_user_id = list(settings.keys())[0]
            current_status = _global_bot_instance.settings_manager.is_skt_enabled(first_user_id)
            new_status = not current_status
            
            # Tüm kullanıcılar için güncelle
            for user_id in settings.keys():
                _global_bot_instance.settings_manager.set_skt_enabled(user_id, new_status)
            
            logger.info(f"✅ SKT durumu değiştirildi: {current_status} → {new_status}")
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'skt_enabled': new_status}).encode())
        
        elif path == '/update-env':
            # .env dosyasını güncelle
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_response(400)
                self._send_cors_headers()
                self.end_headers()
                return
            
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                bot_token = data.get('bot_token')
                
                if not bot_token:
                    self.send_response(400)
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'Bot token gerekli'}).encode())
                    return
                
                # Bot'un kendi klasörünü kullan (get_project_root)
                from src.utils import get_project_root
                project_root = get_project_root()
                
                # .env dosyasını oluştur
                env_file = project_root / '.env'
                with open(env_file, 'w', encoding='utf-8') as f:
                    f.write('# Telegram Bot Token\n')
                    f.write(f'TELEGRAM_BOT_TOKEN={bot_token}\n')
                    f.write('\n')
                    f.write('# Getir API\n')
                    f.write('GETIR_API_BASE_URL=https://franchise-api-gateway.getirapi.com\n')
                    f.write('GETIR_RECAPTCHA_SITE_KEY=6LfRdRobAAAAAGtQPnhju9dtpIU0eeMuJ_4ogcGa\n')
                
                # Setup script'lerini oluştur/güncelle
                self._create_setup_scripts(project_root, bot_token)
                
                logger.info(f"✅ .env dosyası ve setup script'leri oluşturuldu: {project_root}")
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'message': '.env dosyası güncellendi. Bot\'u yeniden başlatmanız gerekiyor.'
                }).encode())
            except Exception as e:
                logger.error(f".env güncelleme hatası: {e}")
                self.send_response(500)
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
        
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()
    
    def _create_setup_scripts(self, project_root, bot_token):
        """Setup script'lerini oluşturur (setup.sh ve setup.bat)"""
        import platform
        
        # setup.sh (Mac/Linux)
        setup_sh_content = f'''#!/bin/bash

# Getir Stock Bot - Otomatik Kurulum Script'i
echo "🚀 Getir Stock Bot - Kurulum Başlatılıyor..."

# Python kontrolü
if ! command -v python3 &> /dev/null; then
    echo "❌ Python bulunamadı! Lütfen Python 3.9+ kurun."
    exit 1
fi

# Virtual environment oluştur
if [ -d "venv" ]; then
    rm -rf venv
fi
python3 -m venv venv
source venv/bin/activate

# Bağımlılıkları yükle
pip install --upgrade pip --quiet
pip install -r requirements.txt

# Bot'u başlat
echo ""
echo "✅ Kurulum tamamlandı! Bot başlatılıyor..."
python3 main.py
'''
        
        # setup.bat (Windows)
        setup_bat_content = f'''@echo off
chcp 65001 >nul
echo.
echo 🚀 Getir Stock Bot - Kurulum Başlatılıyor...

REM Python kontrolü
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python bulunamadı! Lütfen Python 3.9+ kurun.
    pause
    exit /b 1
)

REM Virtual environment oluştur
if exist "venv" rmdir /s /q venv
python -m venv venv
call venv\\Scripts\\activate.bat

REM Bağımlılıkları yükle
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt

REM Bot'u başlat
echo.
echo ✅ Kurulum tamamlandı! Bot başlatılıyor...
python main.py
pause
'''
        
        # Script'leri yaz
        setup_sh_path = project_root / 'setup.sh'
        setup_bat_path = project_root / 'setup.bat'
        
        with open(setup_sh_path, 'w', encoding='utf-8') as f:
            f.write(setup_sh_content)
        
        with open(setup_bat_path, 'w', encoding='utf-8') as f:
            f.write(setup_bat_content)
        
        # Mac/Linux için çalıştırma izni ver
        if platform.system() != 'Windows':
            import os
            os.chmod(setup_sh_path, 0o755)
        
        logger.info(f"✅ Setup script'leri oluşturuldu: {setup_sh_path}, {setup_bat_path}")
    
    def do_GET(self):
        global _global_bot_instance
        
        # Path'i normalize et (query string'i kaldır)
        path = self.path.split('?')[0]
        logger.info(f"📥 GET isteği alındı: {self.path} (normalize: {path})")
        
        if path == '/status':
            from src.auth_manager import AuthManager
            # Bot token'ı global instance'dan al
            bot_token = _global_bot_instance.token if _global_bot_instance else None
            auth_manager = AuthManager(bot_token=bot_token)
            
            token_status = 'geçerli' if auth_manager.is_token_valid() else 'geçersiz'
            last_update = None
            if auth_manager.token_expires_at:
                last_update = int(auth_manager.token_expires_at.timestamp() * 1000)
            
            # SKT ayarını kontrol et (varsayılan kullanıcı için)
            skt_enabled = False
            if _global_bot_instance:
                # İlk kullanıcının ayarını kontrol et (örnek)
                settings = _global_bot_instance.settings_manager.settings
                if settings:
                    first_user_id = list(settings.keys())[0]
                    skt_enabled = _global_bot_instance.settings_manager.is_skt_enabled(first_user_id)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'running',
                'token_status': token_status,
                'last_update': last_update,
                'bot_token': bot_token[:20] + '...' if bot_token else None,
                'skt_enabled': skt_enabled
            }).encode())
        elif path == '/settings':
            # Ayarları getir
            if not _global_bot_instance:
                self.send_response(500)
                self._send_cors_headers()
                self.end_headers()
                return
            
            # İlk kullanıcının ayarlarını döndür (örnek)
            settings = _global_bot_instance.settings_manager.settings
            first_user_id = list(settings.keys())[0] if settings else None
            
            result = {
                'skt_enabled': _global_bot_instance.settings_manager.is_skt_enabled(first_user_id) if first_user_id else False
            }
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        elif path == '/project-path':
            # Proje klasör yolunu döndür
            from src.utils import get_project_root
            project_root = get_project_root()
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({
                'project_path': str(project_root)
            }).encode())
        else:
            if path == '/shutdown':
                self._send_cors_headers()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'shutting down'}).encode())
                
                def shutdown_server():
                    time.sleep(0.5)
                    logger.info("Token server shutdown isteği alındı, kapanıyor...")
                    self.server.shutdown()
                threading.Thread(target=shutdown_server, daemon=True).start()
                return
            
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()
    
    def log_message(self, format, *args):
        # HTTP loglarını azalt
        pass


class GetirStockBot:
    """Getir Stok Telegram Bot"""
    
    def __init__(self, token: str):
        global _global_bot_instance
        _global_bot_instance = self  # Global referansı set et
        
        self.token = token
        self.warehouse_id = os.getenv('GETIR_WAREHOUSE_ID', '5dcafe6ae2c61b1e52cf1704')
        self.warehouse_name = os.getenv('GETIR_WAREHOUSE_NAME', 'Getir Deposu')
        # Bot token'ı tüm servislere geç (her bot kendi token dosyalarını kullanacak)
        self.stock_service = StockService(bot_token=token)
        self.settings_manager = SettingsManager()
        self.warehouse_client = WarehouseClient(bot_token=token)
        # Bot instance referansını ver (Telegram uyarıları için)
        self.warehouse_client.bot_instance = self
        
        # Token'ın yüklendiğini kontrol et
        if self.warehouse_client.keycloak_token:
            logger.info(f"✅ Bot başlatıldı - Keycloak token yüklendi (uzunluk: {len(self.warehouse_client.keycloak_token)})")
        else:
            logger.warning("⚠️ Bot başlatıldı - Keycloak token yüklenemedi")
        
        self.application = Application.builder().token(token).build()
        self._setup_handlers()
        self._start_token_server()
    
    def _start_token_server(self):
        """Extension'dan token almak için HTTP server başlatır"""
        def _stop_existing_server():
            try:
                response = requests.get('http://localhost:8765/status', timeout=1)
                if response.ok:
                    logger.info("🛑 Mevcut token server bulundu, kapanması isteniyor...")
                    try:
                        requests.post('http://localhost:8765/shutdown', timeout=1)
                        time.sleep(1)
                        logger.info("✅ Eski token server kapandı")
                    except requests.RequestException:
                        logger.warning("Eski token server kapanma isteğine yanıt vermedi")
            except requests.RequestException:
                # Port açık değil ya da server cevap vermiyor
                pass
        
        _stop_existing_server()
        
        def run_server():
            try:
                server = HTTPServer(('localhost', 8765), TokenUpdateHandler)
            except OSError as e:
                logger.error(f"Token server başlatılamadı (port 8765): {e}")
                logger.error("Bir başka süreç portu kullanıyor. Gerekirse `start_http_server.py`'yi kapatın.")
                return
            
            logger.info("Token update server başlatıldı: http://localhost:8765")
            server.serve_forever()
        
        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()
        logger.info("Extension token server thread başlatıldı")
    
    def _check_rate_limit(self, user_id: int) -> bool:
        """Rate limiting kontrolü"""
        now = time.time()
        user_requests = _user_requests[user_id]
        
        # Eski istekleri temizle
        user_requests[:] = [req_time for req_time in user_requests if now - req_time < RATE_LIMIT_WINDOW]
        
        # Rate limit kontrolü
        if len(user_requests) >= RATE_LIMIT_REQUESTS:
            return False
        
        # Yeni isteği ekle
        user_requests.append(now)
        return True
    
    def _setup_handlers(self):
        """Bot handler'larını kurar"""
        # Komutlar
        self.application.add_handler(CommandHandler("start", self.start_command))
        self.application.add_handler(CommandHandler("help", self.help_command))
        self.application.add_handler(CommandHandler("search", self.search_command))
        self.application.add_handler(CommandHandler("refresh", self.refresh_command))
        self.application.add_handler(CommandHandler("settings", self.settings_command))
        self.application.add_handler(CommandHandler("expire_tokens", self.expire_tokens_command))
        self.application.add_handler(CommandHandler("skt_on", self.skt_on_command))
        self.application.add_handler(CommandHandler("skt_off", self.skt_off_command))
        self.application.add_handler(CommandHandler("set_keycloak_token", self.set_keycloak_token_command))
        self.application.add_handler(CommandHandler("set_keycloak_refresh_token", self.set_keycloak_refresh_token_command))
        self.application.add_handler(CommandHandler("stoklar", self.stoklar_excel_command))
        
        # Mesaj handler (ürün araması için)
        self.application.add_handler(
            MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message)
        )
        
        # Genel hata handler'ı
        self.application.add_error_handler(self._error_handler)
    
    async def _error_handler(self, update: object, context: ContextTypes.DEFAULT_TYPE):
        """Telegram kaynaklı hataları yakalar ve loglar"""
        error = context.error
        error_text = str(error) if error else "Bilinmeyen hata"
        exc_info = (type(error), error, error.__traceback__) if error else None
        
        logger.error("Telegram hata handler tetiklendi: %s", error_text, exc_info=exc_info)
        
        if isinstance(error, BadRequest) and "logged out" in error_text.lower():
            logger.error("❌ Telegram 'Logged out' hatası tespit edildi")
            logger.error("➡️ TELEGRAM_BOT_TOKEN büyük olasılıkla BotFather tarafından sıfırlandı")
            logger.error("🛠️ Çözüm: BotFather üzerinden yeni token alın, .env dosyasını güncelleyin ve bot'u yeniden başlatın")
            
            try:
                await context.application.stop()
                logger.info("Telegram Application durduruldu - yeni token ile yeniden başlatılmalı")
            except Exception as stop_error:
                logger.error("Application.stop() çağrılırken hata: %s", stop_error)
        else:
            logger.warning("Telegram hatası otomatik olarak handle edilemedi; bot çalışmaya devam edecek")
    
    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """/start komutu"""
        warehouse_name = self.warehouse_name or "Getir Deposu"
        warehouse_id = self.warehouse_id or "Bilinmiyor"
        welcome_message = (
            f"👋 *{warehouse_name}* botuna hoş geldin!\n"
            f"🏭 Depo ID: `{warehouse_id}`\n\n"
            "Bu bot ile deponuzdaki ürünlerin stok ve SKT bilgilerini tek mesajda görebilirsin.\n\n"
            "📝 *Kullanım:*\n"
            "• Ürün adı veya barkod yazarak arama yapabilirsiniz\n"
            "• Örnek: `Coca Cola` veya `1234567890`\n\n"
            "🔍 *Komutlar:*\n"
            "• `/search <ürün>` - Ürün ara\n"
            "• `/refresh` - Stok cache'ini yenile\n"
            "• `/help` - Yardım mesajı\n"
            "• `/settings` - Depo komutları ve özellikler\n\n"
            "Başlamak için bir ürün adı veya barkod yazman yeter! 🚀"
        )
        await update.message.reply_text(
            welcome_message,
            parse_mode='Markdown'
        )
    
    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """/help komutu"""
        help_message = (
            "📖 *Yardım*\n\n"
            "🔍 *Arama Yapma:*\n"
            "• Ürün adı yazabilirsiniz: `Coca Cola`\n"
            "• Barkod yazabilirsiniz: `000000000001013727`\n"
            "• Komut kullanabilirsiniz: `/search Coca Cola`\n\n"
            "⚙️ *Komutlar:*\n"
            "• `/start` - Bot'u başlat\n"
            "• `/search <ürün>` - Ürün ara\n"
            "• `/refresh` - Stok verilerini yenile\n"
            "• `/settings` - Ayarları göster\n"
            "• `/skt_on` - SKT gösterimini aç\n"
            "• `/skt_off` - SKT gösterimini kapat\n"
            "• `/stoklar` - Tüm stokları Excel dosyası olarak indir\n"
            "• `/set_keycloak_refresh_token <token>` - Warehouse refresh token'ı set et\n"
            "• `/set_keycloak_token <token>` - Keycloak token'ı manuel set et\n"
            "• `/help` - Bu yardım mesajı\n\n"
            "💡 *İpucu:* Ürün adının bir kısmını yazmanız yeterli!"
        )
        await update.message.reply_text(
            help_message,
            parse_mode='Markdown'
        )
    
    async def search_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """/search komutu"""
        if not context.args:
            await update.message.reply_text(
                "❌ Lütfen arama terimi girin.\n"
                "Örnek: `/search Coca Cola`",
                parse_mode='Markdown'
            )
            return
        
        search_term = ' '.join(context.args)
        await self._perform_search(update, search_term)
    
    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Gelen mesajları işler"""
        search_term = update.message.text.strip()
        
        if not search_term:
            return
        
        # Hata mesajı olup olmadığını kontrol et (önceki hata mesajı tekrar gönderilmiş olabilir)
        if search_term.startswith("❌") or "sonuç bulunamadı" in search_term.lower():
            await update.message.reply_text(
                "⚠️ Lütfen geçerli bir ürün adı veya barkod girin.\n\n"
                "Örnek: `banvit köfte` veya `8690451709908`",
                parse_mode='Markdown'
            )
            return
        
        await self._perform_search(update, search_term)
    
    async def _perform_search(self, update: Update, search_term: str):
        """Arama işlemini gerçekleştirir"""
        user_id = update.effective_user.id
        
        logger.info(f"Kullanıcı {user_id} arama yapıyor: {search_term}")
        
        # Rate limiting kontrolü
        if not self._check_rate_limit(user_id):
            await update.message.reply_text(
                "⏳ Çok fazla istek gönderdiniz. Lütfen bir dakika bekleyin."
            )
            return
        
        await update.message.reply_text(f"🔍 Aranıyor: `{search_term}`...", parse_mode='Markdown')
        
        try:
            logger.info(f"Arama başlatılıyor: {search_term}")
            
            # Token kontrolü yap - önce session'ı yeniden yükle (extension'dan yeni token gelmiş olabilir)
            from src.auth_manager import AuthManager
            # Bot token'ı kullan (her bot kendi token dosyasını kullanacak)
            auth_manager = AuthManager(bot_token=self.token)
            auth_manager.load_session()  # Yeni token'ı yükle
            
            # Token kontrolü - eğer geçersizse, bir kez daha API'yi denemeden önce kontrol et
            if not auth_manager.is_token_valid():
                # Bir kez daha session'ı yükle (extension'dan yeni token gelmiş olabilir)
                import time
                time.sleep(1)  # Kısa bir bekleme
                auth_manager.load_session()
                
                if not auth_manager.is_token_valid():
                    expires_at = auth_manager.token_expires_at
                    now = datetime.now()
                    time_diff = (expires_at - now).total_seconds() if expires_at else 0
                    
                    await update.message.reply_text(
                        f"⚠️ *Token süresi dolmuş!*\n\n"
                        f"⏰ Token expire zamanı: `{expires_at.strftime('%H:%M:%S') if expires_at else 'Bilinmiyor'}`\n"
                        f"🕐 Şu an: `{now.strftime('%H:%M:%S')}`\n"
                        f"⏱️ Fark: `{time_diff:.0f} saniye`\n\n"
                        "🔧 *Çözüm:*\n"
                        "1. Browser'da Getir sitesine gidin: `https://franchise.getir.com/stock/current`\n"
                        "2. Sayfayı yenileyin (F5 veya Cmd+R)\n"
                        "3. Extension'ın token gönderdiğinden emin olun (Console'da 'Token başarıyla gönderildi' yazmalı)\n"
                        "4. 5-10 saniye bekleyin ve tekrar deneyin\n\n"
                        "💡 Extension popup'ını açarak token durumunu kontrol edebilirsiniz.",
                        parse_mode='Markdown'
                    )
                    return
            
            results = self.stock_service.search(search_term)
            logger.info(f"Arama tamamlandı: {len(results)} sonuç bulundu")
            
            if not results:
                await update.message.reply_text(
                    f"❌ '{search_term}' için sonuç bulunamadı.\n\n"
                    "💡 *İpucu:*\n"
                    "• Ürün adının bir kısmını yazmayı deneyin\n"
                    "• Barkod doğru mu kontrol edin",
                    parse_mode='Markdown'
                )
                return
            
            # Sonuçları gönder
            if len(results) == 1:
                # Tek sonuç - detaylı göster
                # SKT bilgisini al (eğer aktifse ve hata olursa sessizce atla)
                # SKT bilgisi almak zaman alabilir, bu yüzden önce stok mesajını gönder
                skt_info = None
                
                # SKT özelliğinin aktif olup olmadığını kontrol et
                is_skt_enabled = self.settings_manager.is_skt_enabled(user_id)
                logger.info(f"🔍 SKT özelliği kontrolü - Kullanıcı {user_id}: {'✅ Aktif' if is_skt_enabled else '❌ Pasif'}")
                
                if is_skt_enabled:
                    try:
                        logger.info(f"📅 SKT bilgisi alınıyor: product_id={results[0].get('_id') or results[0].get('id')}, search_term='{search_term}'")
                        logger.info(f"🔑 Warehouse client token durumu: {self.warehouse_client.keycloak_token is not None}")
                        
                        if self.warehouse_client.keycloak_token:
                            logger.info(f"✅ Warehouse client token mevcut (ilk 50 karakter): {self.warehouse_client.keycloak_token[:50]}...")
                            logger.info(f"📏 Token uzunluğu: {len(self.warehouse_client.keycloak_token)}")
                        else:
                            logger.error("❌ ❌ ❌ Warehouse client'ta Keycloak token YOK!")
                            logger.error("💡 Çözüm: warehouse.getir.com sitesine gidin ve sayfayı yenileyin")
                        
                        logger.info(f"🔍 _get_skt_info fonksiyonu çağrılıyor...")
                        skt_info = self._get_skt_info(results[0], search_term=search_term)
                        
                        if skt_info:
                            logger.info(f"✅ ✅ ✅ SKT bilgisi başarıyla alındı: {skt_info}")
                        else:
                            logger.warning("⚠️ SKT bilgisi bulunamadı (boş response veya hata)")
                            logger.warning("💡 Olası nedenler:")
                            logger.warning("   1. Warehouse API'sinde ürün bulunamadı")
                            logger.warning("   2. Ürün için SKT bilgisi yok")
                            logger.warning("   3. API hatası")
                    except Exception as e:
                        logger.error(f"❌ SKT bilgisi alınırken hata: {e}", exc_info=True)
                        skt_info = None
                else:
                    logger.info(f"⏭️ SKT özelliği pasif, SKT bilgisi alınmayacak")
                
                message = format_stock_message(results[0], skt_info=skt_info)
                
                # Görselleri hazırla
                barcode_image = get_barcode_image_for_product(results[0])
                product_image_url = get_product_image_url(results[0])
                
                if product_image_url and barcode_image:
                    logger.info("🖼️ Ürün fotoğrafı ve barkod birlikte gönderiliyor (media group)")
                    barcode_image.seek(0)
                    barcode_image.name = "barcode.png"
                    
                    media_group = [
                        InputMediaPhoto(
                            media=product_image_url,
                            caption=message,
                            parse_mode='Markdown'
                        ),
                        InputMediaPhoto(
                            media=barcode_image,
                        )
                    ]
                    
                    await update.message.reply_media_group(media_group)
                elif product_image_url:
                    logger.info("🖼️ Sadece ürün fotoğrafı gönderiliyor (barcode yok)")
                    await update.message.reply_photo(
                        photo=product_image_url,
                        caption=message,
                        parse_mode='Markdown'
                    )
                elif barcode_image:
                    logger.info("🖼️ Sadece barkod görseli gönderiliyor (ürün fotoğrafı yok)")
                    await update.message.reply_photo(
                        photo=barcode_image,
                        caption=message,
                        parse_mode='Markdown'
                    )
                else:
                    logger.info("🖼️ Görsel bulunamadı, sadece metin gönderiliyor")
                    await update.message.reply_text(message, parse_mode='Markdown')
            else:
                # Birden fazla sonuç - özet göster
                message = f"✅ *{len(results)} sonuç bulundu:*\n\n"
                
                # İlk 10 sonucu göster
                for i, product in enumerate(results[:10], 1):
                    # Önce fullName'i kontrol et, yoksa name.tr kullan
                    name = product.get('fullName', '') or product.get('name', {}).get('tr', 'Bilinmeyen')
                    # Eğer fullName dict ise, tr değerini al
                    if isinstance(name, dict):
                        name = name.get('tr', 'Bilinmeyen')
                    # Boşlukları temizle ama parantez içindeki bilgileri koru
                    name = name.strip()
                    
                    # None kontrolü yaparak güvenli şekilde al
                    available_raw = product.get('available')
                    
                    # "Sayımda" durumunu kontrol et - available = -1 ise "Sayımda"
                    is_counting = False
                    if available_raw == -1:
                        is_counting = True
                        available = "Sayımda"
                    elif isinstance(available_raw, str) and ('sayım' in available_raw.lower() or 'counting' in available_raw.lower()):
                        is_counting = True
                        available = "Sayımda"
                    elif available_raw is None:
                        # available null ve reserve/total da null ise sayımda
                        reserve_raw = product.get('reserve')
                        total_raw = product.get('total')
                        if reserve_raw is None and total_raw is None:
                            is_counting = True
                            available = "Sayımda"
                        else:
                            available = 0
                    else:
                        try:
                            available = int(available_raw)
                        except (ValueError, TypeError):
                            available = 0
                    
                    reserve = product.get('reserve')
                    if reserve is None:
                        reserve = 0
                    else:
                        try:
                            reserve = int(reserve)
                        except (ValueError, TypeError):
                            reserve = 0
                    
                    # Raf etiketlerini (barcodes) al
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
                        # Sadece ilk barkodu göster (kullanıcı istedi)
                        barcode_text = f"Raf: `{barcodes[0]}`"
                    else:
                        barcode_text = "Raf: Bulunamadı"
                    
                    message += f"{i}. *{name}*\n"
                    if is_counting:
                        message += f"   Stok: `Sayımda` | Rezerve: `{reserve}` | {barcode_text}\n\n"
                    else:
                        message += f"   Stok: `{available}` | Rezerve: `{reserve}` | {barcode_text}\n\n"
                
                if len(results) > 10:
                    message += f"... ve {len(results) - 10} sonuç daha"
                
                await update.message.reply_text(message, parse_mode='Markdown')
        
        except Exception as e:
            logger.error(f"Arama hatası: {e}", exc_info=True)
            error_msg = f"❌ Bir hata oluştu: {str(e)}"
            logger.error(f"Hata detayı: {error_msg}")
            await update.message.reply_text(
                "❌ Bir hata oluştu. Lütfen daha sonra tekrar deneyin.\n"
                f"Detay: {str(e)[:100]}"
            )
    
    async def refresh_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """/refresh komutu - cache'i temizler"""
        await update.message.reply_text("🔄 Stok verileri yenileniyor...")
        
        try:
            self.stock_service.clear_cache()
            # Cache temizlendi, bir sonraki aramada yeniden yüklenecek
            await update.message.reply_text("✅ Stok cache'i temizlendi. Bir sonraki aramada güncel veriler yüklenecek.")
        except Exception as e:
            logger.error(f"Refresh hatası: {e}", exc_info=True)
            await update.message.reply_text("❌ Cache temizlenirken bir hata oluştu.")

    async def expire_tokens_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """/expire_tokens komutu - token expire sürelerini gösterir"""
        def format_entry(name: str, entry: Dict[str, Any]) -> str:
            expires_at = entry.get('expires_at')
            seconds_left = entry.get('seconds_left')
            is_valid = entry.get('is_valid')
            
            if not expires_at or seconds_left is None:
                return f"{name}: ❌ Mevcut değil"
            
            # Saat, dakika, saniye formatına çevir
            hours = seconds_left // 3600
            minutes = (seconds_left % 3600) // 60
            seconds = seconds_left % 60
            
            status = "✅ Geçerli" if is_valid else "⚠️ Expire olmak üzere"
            expires_str = expires_at.strftime('%d.%m.%Y %H:%M:%S')
            
            # Süre formatını oluştur
            if hours > 0:
                time_str = f"{hours} sa {minutes} dk {seconds} sn"
            elif minutes > 0:
                time_str = f"{minutes} dk {seconds} sn"
            else:
                time_str = f"{seconds} sn"
            
            return (
                f"{name}: {status}\n"
                f"   • Kalan süre: {time_str}\n"
                f"   • Bitiş: {expires_str}"
            )
        
        message = "⏳ *Token Expire Durumu*\n\n"
        
        # Franchise Token Bilgisi
        message += "🏪 *FRANCHISE API*\n"
        if self.stock_service and self.stock_service.client and self.stock_service.client.auth_manager:
            franchise_info = self.stock_service.client.auth_manager.get_token_expiry_info()
            message += format_entry("🔑 Access Token", franchise_info.get('access', {})) + "\n\n"
            message += format_entry("♻️ Refresh Token", franchise_info.get('refresh', {})) + "\n\n"
        else:
            message += "🔑 Access Token: ❌ Mevcut değil\n"
            message += "♻️ Refresh Token: ❌ Mevcut değil\n\n"
        
        # Warehouse Token Bilgisi
        message += "🏭 *WAREHOUSE API*\n"
        if self.warehouse_client:
            warehouse_info = self.warehouse_client.get_token_expiry_info()
            message += format_entry("🔑 Access Token", warehouse_info.get('access', {})) + "\n\n"
            message += format_entry("♻️ Refresh Token", warehouse_info.get('refresh', {}))
        else:
            message += "🔑 Access Token: ❌ Mevcut değil\n"
            message += "♻️ Refresh Token: ❌ Mevcut değil"
        
        await update.message.reply_text(message, parse_mode='Markdown')
    
    async def settings_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """/settings komutu - kullanıcı ayarlarını gösterir"""
        user_id = update.effective_user.id
        settings = self.settings_manager.get_user_settings(user_id)
        
        skt_status = "✅ Aktif" if self.settings_manager.is_skt_enabled(user_id) else "❌ Pasif"
        
        commands = [
            ("`/start`", "Depo bilgilerini ve kullanımı gösterir"),
            ("`/help`", "Kısa yardım metni"),
            ("`/settings`", "Bu ekran"),
            ("`/search <ürün>`", "Ürün adı veya barkod ile arama"),
            ("`/refresh`", "Stok cache'ini temizler"),
            ("`/expire_tokens`", "Franchise & Warehouse token sürelerini gösterir"),
            ("`/skt_on`", "SKT verisini açar"),
            ("`/skt_off`", "SKT verisini kapatır"),
            ("`/stoklar`", "Tüm stokları Excel olarak gönderir"),
            ("`/set_keycloak_token <token>`", "Warehouse access token'ını kaydeder"),
            ("`/set_keycloak_refresh_token <token>`", "Warehouse refresh token'ını kaydeder")
        ]
        commands_text = "\n".join([f"• {cmd} - {desc}" for cmd, desc in commands])
        
        message = (
            f"⚙️ *{self.warehouse_name} Ayarları*\n"
            f"🏭 Depo ID: `{self.warehouse_id}`\n\n"
            f"📅 SKT Gösterimi: {skt_status}\n"
            f"🗂️ Kaydedilen ayar sayısı: {len(settings.keys()) if settings else 0}\n\n"
            "🧰 *Komutlar:*\n"
            f"{commands_text}\n\n"
            "💡 Herhangi bir metin göndererek ürün araması yapabilirsin."
        )
        
        await update.message.reply_text(message, parse_mode='Markdown')
    
    async def skt_on_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """/skt_on komutu - SKT özelliğini aktifleştirir"""
        user_id = update.effective_user.id
        self.settings_manager.enable_skt(user_id)
        await update.message.reply_text(
            "✅ SKT gösterimi aktif edildi.\n\n"
            "📝 Artık ürün aramalarında SKT bilgisi de gösterilecek.\n\n"
            "⚠️ *Not:* SKT bilgisi alınamazsa veya bir hata oluşursa, stok bilgisi normal şekilde gösterilmeye devam edecek.",
            parse_mode='Markdown'
        )
    
    async def skt_off_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """/skt_off komutu - SKT özelliğini devre dışı bırakır"""
        user_id = update.effective_user.id
        self.settings_manager.disable_skt(user_id)
        await update.message.reply_text(
            "❌ SKT gösterimi devre dışı bırakıldı.\n\n"
            "📝 Artık ürün aramalarında SKT bilgisi gösterilmeyecek."
        )
    
    async def stoklar_excel_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Tüm stokları Excel dosyası olarak gönderir"""
        user_id = update.effective_user.id
        
        # İşlem başladı mesajı
        status_message = await update.message.reply_text(
            "📊 Tüm stoklar çekiliyor...\n"
            "⏳ Bu işlem birkaç dakika sürebilir (8000+ ürün)..."
        )
        
        try:
            # Tüm stokları çek
            logger.info(f"📊 Kullanıcı {user_id} tüm stokları Excel olarak istiyor")
            stocks = self.stock_service.client.get_all_stocks()
            
            if not stocks or len(stocks) == 0:
                await status_message.edit_text(
                    "❌ Stok verisi bulunamadı.\n\n"
                    "💡 Lütfen daha sonra tekrar deneyin."
                )
                return
            
            # İlerleme mesajı güncelle
            await status_message.edit_text(
                f"✅ {len(stocks)} ürün bulundu!\n"
                "📝 Excel dosyası oluşturuluyor..."
            )
            
            # Excel dosyası oluştur
            from src.excel_export import create_stocks_excel
            excel_path = create_stocks_excel(stocks)
            
            if not excel_path or not excel_path.exists():
                await status_message.edit_text(
                    "❌ Excel dosyası oluşturulamadı.\n\n"
                    "💡 Lütfen daha sonra tekrar deneyin."
                )
                return
            
            # Dosyayı Telegram'a gönder
            await status_message.edit_text(
                f"📤 Excel dosyası hazır!\n"
                f"📊 {len(stocks)} ürün\n"
                f"📁 Dosya gönderiliyor..."
            )
            
            with open(excel_path, 'rb') as excel_file:
                await update.message.reply_document(
                    document=excel_file,
                    filename=f"stoklar_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx",
                    caption=f"📊 Tüm Stoklar\n\n"
                           f"✅ {len(stocks)} ürün\n"
                           f"📅 Oluşturulma: {datetime.now().strftime('%d.%m.%Y %H:%M')}"
                )
            
            # Başarı mesajı
            await status_message.edit_text(
                f"✅ Excel dosyası başarıyla gönderildi!\n\n"
                f"📊 {len(stocks)} ürün\n"
                f"📁 Dosya adı: stoklar_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
            )
            
            # Dosyayı sil (isteğe bağlı - disk alanı için)
            try:
                excel_path.unlink()
                logger.info(f"✅ Geçici Excel dosyası silindi: {excel_path}")
            except Exception as e:
                logger.warning(f"⚠️ Excel dosyası silinemedi: {e}")
            
        except Exception as e:
            logger.error(f"❌ Excel export hatası: {e}", exc_info=True)
            await status_message.edit_text(
                f"❌ Hata oluştu:\n\n"
                f"`{str(e)[:200]}`\n\n"
                f"💡 Lütfen daha sonra tekrar deneyin."
            )
    
    def _get_skt_info(self, product: dict, search_term: Optional[str] = None) -> Optional[dict]:
        """Ürün için SKT ve satıştan kaldırılma bilgilerini alır
        
        Args:
            product: Ürün dict'i (franchise API'den gelen)
            search_term: Arama terimi (log için)
            
        Returns:
            {
                "expiry_summary": "6 adet: 12.12.2025, ...",
                "removal_summary": "6 adet: 09.12.2025, ..."
            } veya None
        """
        try:
            # Franchise API'den gelen product dict'inden direkt product_id'yi al
            # Product ID'yi farklı key'lerden dene
            product_id = product.get('_id') or product.get('id')
            
            if not product_id:
                logger.warning("❌ Product ID bulunamadı (franchise API'den gelen product dict'inde)")
                logger.warning(f"💡 Product dict keys: {list(product.keys())[:10]}")
                return None
            
            logger.info(f"✅ Franchise API'den product_id alındı: {product_id}")
            logger.info(f"📅 SKT bilgisi alınıyor (product_id: {product_id})...")
            
            # Warehouse client'tan SKT bilgisini al (direkt franchise API'den gelen product_id ile)
            skt_data = self.warehouse_client.get_expiring_products([product_id])
            
            if not skt_data:
                logger.warning("❌ SKT bilgisi boş döndü (skt_data is None)")
                return None
            
            logger.info(f"✅ SKT bilgisi alındı (tip: {type(skt_data)})")
            
            # Response formatı:
            # {
            #   "data": [
            #     {"expiryDate": "2025-11-22T00:00:00.000Z", "count": 32, ...},
            #     {"expiryDate": "2025-11-20T00:00:00.000Z", "count": 28, ...}
            #   ],
            #   "result": {...}
            # }
            
            # Response dict ise data key'ini kontrol et
            if isinstance(skt_data, dict):
                raw_data = skt_data.get('data', [])
                if isinstance(raw_data, dict) and 'items' in raw_data:
                    data = raw_data.get('items', [])
                    logger.info(f"📊 SKT response dict formatında, items: {len(data)} kayıt")
                else:
                    data = raw_data
                logger.info(f"📊 SKT response dict formatında, data key'i: {len(data) if isinstance(data, list) else 'bulunamadı'} kayıt")
            elif isinstance(skt_data, list):
                data = skt_data
                logger.info(f"📊 SKT response list formatında: {len(data)} kayıt")
            else:
                logger.warning(f"❌ Beklenmeyen SKT response formatı: {type(skt_data)}")
                return None
            
            if not data or len(data) == 0:
                logger.warning("❌ SKT data boş veya kayıt yok")
                logger.warning(f"💡 Bu ürün için SKT bilgisi olmayabilir veya tarih aralığı dışında olabilir")
                return None
            
            logger.info(f"✅ {len(data)} SKT kaydı bulundu, işleniyor...")
            
            # Aynı expiryDate'e sahip item'ları grupla ve topla
            expiry_groups = {}
            removal_groups = {}
            for item in data:
                exp_date = item.get('expiryDate') or item.get('expirationDate')
                count = item.get('count') or item.get('quantity') or 0
                remove_from_sale = item.get('removeFromSaleDate') or item.get('removeFromSaleDateTime')
                
                if exp_date and count:
                    # Tarihi normalize et (sadece tarih kısmını al)
                    date_key = exp_date.split('T')[0] if 'T' in exp_date else exp_date
                    expiry_groups[date_key] = expiry_groups.get(date_key, 0) + count
                
                if remove_from_sale and count:
                    remove_key = remove_from_sale.split('T')[0] if 'T' in remove_from_sale else remove_from_sale
                    removal_groups[remove_key] = removal_groups.get(remove_key, 0) + count
            
            if not expiry_groups and not removal_groups:
                return None
            
            expiry_parts = []
            for date_key in sorted(expiry_groups.keys()):
                formatted_date = self._format_date(date_key)
                expiry_parts.append(f"{expiry_groups[date_key]} adet: {formatted_date}")
            
            removal_parts = []
            for date_key in sorted(removal_groups.keys()):
                formatted_date = self._format_date(date_key)
                removal_parts.append(f"{removal_groups[date_key]} adet: {formatted_date}")
            
            # Her adet ve tarih bilgisini ayrı satırlarda göster (son satır hariç sonunda virgül)
            if expiry_parts:
                expiry_lines = []
                for i, part in enumerate(expiry_parts):
                    if i < len(expiry_parts) - 1:
                        expiry_lines.append(f"{part},")
                    else:
                        expiry_lines.append(part)
                expiry_summary = "\n".join(expiry_lines)
            else:
                expiry_summary = None
            
            if removal_parts:
                removal_lines = []
                for i, part in enumerate(removal_parts):
                    if i < len(removal_parts) - 1:
                        removal_lines.append(f"{part},")
                    else:
                        removal_lines.append(part)
                removal_summary = "\n".join(removal_lines)
            else:
                removal_summary = None
            
            if not expiry_summary and not removal_summary:
                return None
            
            summary = {
                "expiry_summary": expiry_summary,
                "removal_summary": removal_summary
            }
            
            logger.info(f"✅ ✅ ✅ SKT özetleri hazırlandı: {summary}")
            return summary
            
        except Exception as e:
            logger.warning(f"SKT bilgisi alınırken hata: {e}", exc_info=True)
            return None
    
    async def set_keycloak_token_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Keycloak token'ı manuel olarak set eder"""
        if not context.args:
            await update.message.reply_text(
                "❌ Lütfen Keycloak token'ını girin.\n\n"
                "📝 *Kullanım:*\n"
                "`/set_keycloak_token <token>`\n\n"
                "💡 *Token'ı Nasıl Bulurum?*\n"
                "1. warehouse.getir.com sitesine git\n"
                "2. F12 ile Developer Tools'u aç\n"
                "3. Network sekmesine git\n"
                "4. Herhangi bir API request'ine tıkla\n"
                "5. Headers sekmesinde 'Authorization' header'ını bul\n"
                "6. 'Bearer ' kısmından sonraki token'ı kopyala\n"
                "7. Bot'a gönder: `/set_keycloak_token <token>`\n\n"
                "Örnek: `/set_keycloak_token eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...`",
                parse_mode='Markdown'
            )
            return
        
        token = ' '.join(context.args).strip()
        
        # Token formatını kontrol et (JWT token'lar genellikle eyJ ile başlar)
        if not token.startswith('eyJ'):
            await update.message.reply_text(
                "⚠️ Token formatı geçersiz görünüyor.\n\n"
                "JWT token'lar genellikle 'eyJ' ile başlar.\n"
                "Lütfen token'ı tekrar kontrol edin."
            )
            return
        
        try:
            # Token'ı warehouse client'a set et
            self.warehouse_client.set_keycloak_token(token)
            logger.info(f"✅ Keycloak token manuel olarak set edildi: {token[:50]}...")
            
            # Token'ın kaydedilip kaydedilmediğini kontrol et
            token_saved = self.warehouse_client.keycloak_token is not None
            token_file_exists = self.warehouse_client.token_file.exists()
            
            await update.message.reply_text(
                f"✅ Keycloak token başarıyla kaydedildi!\n\n"
                f"Token: `{token[:50]}...`\n"
                f"Token uzunluğu: `{len(token)}` karakter\n"
                f"Token dosyası: `{'✅ Var' if token_file_exists else '❌ Yok'}`\n"
                f"Token yüklendi: `{'✅ Evet' if token_saved else '❌ Hayır'}`\n\n"
                f"Artık SKT bilgilerini görebilirsiniz. `/skt_on` komutu ile SKT gösterimini açabilirsiniz.\n\n"
                f"💡 *Not:* Token'ı Network sekmesinden Authorization header'ından alın (Bearer 'dan sonrası).",
                parse_mode='Markdown'
            )
        except Exception as e:
            logger.error(f"Keycloak token set etme hatası: {e}")
            await update.message.reply_text(
                f"❌ Token kaydedilirken hata oluştu: {e}\n\n"
                f"Lütfen token'ı tekrar kontrol edin."
            )
    
    async def set_keycloak_refresh_token_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Warehouse refresh token'ını manuel olarak set eder"""
        if not context.args:
            await update.message.reply_text(
                "❌ Lütfen refresh token'ı girin.\n\n"
                "📝 *Kullanım:*\n"
                "`/set_keycloak_refresh_token <token>`\n\n"
                "💡 *Token'ı Nasıl Bulurum?*\n"
                "1. warehouse.getir.com sitesine git\n"
                "2. F12 -> Network sekmesi\n"
                "3. `token` veya `protocol/openid-connect/token` isteğini bul\n"
                "4. Response body'deki `refresh_token` alanını kopyala\n"
                "5. Bot'a gönder: `/set_keycloak_refresh_token <token>`\n\n"
                "Örnek: `/set_keycloak_refresh_token eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...`",
                parse_mode='Markdown'
            )
            return
        
        token = ' '.join(context.args).strip()
        
        if not token.startswith('eyJ'):
            await update.message.reply_text(
                "⚠️ Token formatı geçersiz görünüyor.\n\n"
                "JWT refresh token'lar genellikle 'eyJ' ile başlar.\n"
                "Lütfen token'ı tekrar kontrol edin."
            )
            return
        
        try:
            self.warehouse_client.set_refresh_token(token)
            logger.info(f"✅ Warehouse refresh token manuel olarak set edildi: {token[:50]}...")
            
            token_saved = self.warehouse_client.refresh_token is not None
            token_file_exists = self.warehouse_client.refresh_token_file.exists()
            
            await update.message.reply_text(
                "✅ Warehouse refresh token başarıyla kaydedildi!\n\n"
                f"Token: `{token[:50]}...`\n"
                f"Token uzunluğu: `{len(token)}` karakter\n"
                f"Token dosyası: `{'✅ Var' if token_file_exists else '❌ Yok'}`\n"
                f"Token yüklendi: `{'✅ Evet' if token_saved else '❌ Hayır'}`\n\n"
                "💡 Bu token ile access token otomatik yenilenebilir.",
                parse_mode='Markdown'
            )
        except Exception as e:
            logger.error(f"Warehouse refresh token set etme hatası: {e}")
            await update.message.reply_text(
                f"❌ Refresh token kaydedilirken hata oluştu: {e}\n\n"
                "Lütfen token'ı tekrar kontrol edin."
            )
    
    def _format_date(self, date_str: str) -> str:
        """Tarih string'ini Türkçe formatına çevirir (2025-01-25 -> 25.01.2025)"""
        try:
            from datetime import datetime
            # ISO formatını parse et (2025-11-22T00:00:00.000Z veya 2025-11-22)
            date_str_clean = date_str.split('T')[0] if 'T' in date_str else date_str
            
            # Farklı formatları dene
            for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%d.%m.%Y', '%d/%m/%Y']:
                try:
                    dt = datetime.strptime(date_str_clean, fmt)
                    return dt.strftime('%d.%m.%Y')
                except ValueError:
                    continue
            return date_str_clean  # Formatlanamazsa olduğu gibi döndür
        except Exception:
            return date_str.split('T')[0] if 'T' in date_str else date_str
    
    async def _check_refresh_token_periodically(self, context: ContextTypes.DEFAULT_TYPE):
        """Periyodik olarak refresh token expire kontrolü yapar (her 5 dakikada bir)"""
        try:
            if self.warehouse_client:
                self.warehouse_client.check_refresh_token_expire_warning()
            
            # Bekleyen uyarıları gönder
            if hasattr(self, '_pending_refresh_token_warning') and self._pending_refresh_token_warning:
                warnings_to_send = self._pending_refresh_token_warning.copy()
                self._pending_refresh_token_warning.clear()
                
                for warning in warnings_to_send:
                    message = warning['message']
                    users = warning['users']
                    
                    for user_id in users:
                        try:
                            await self.application.bot.send_message(
                                chat_id=user_id,
                                text=message,
                                parse_mode='Markdown'
                            )
                            logger.info(f"✅ Refresh token expire uyarısı gönderildi: kullanıcı {user_id}")
                        except Exception as e:
                            logger.warning(f"⚠️ Kullanıcı {user_id} için uyarı gönderilemedi: {e}")
        except Exception as e:
            logger.error(f"❌ Refresh token kontrolü sırasında hata: {e}", exc_info=True)
    
    def run(self):
        """Bot'u çalıştırır"""
        logger.info("Bot başlatılıyor...")
        
        # Periyodik refresh token kontrolü başlat (her 5 dakikada bir)
        job_queue = self.application.job_queue
        if job_queue:
            job_queue.run_repeating(
                self._check_refresh_token_periodically,
                interval=300,  # 5 dakika
                first=60  # İlk kontrol 1 dakika sonra
            )
            logger.info("✅ Periyodik refresh token kontrolü başlatıldı (her 5 dakikada bir)")
        
        self.application.run_polling(allowed_updates=Update.ALL_TYPES)


def main():
    """Ana fonksiyon"""
    # Environment variables yükle
    from dotenv import load_dotenv
    load_dotenv()
    
    token = os.getenv('TELEGRAM_BOT_TOKEN')
    
    if not token:
        logger.warning("⚠️ TELEGRAM_BOT_TOKEN bulunamadı!")
        logger.info("📝 Extension'dan bot token'ını girebilirsiniz. HTTP server başlatılıyor...")
        
        # Token yoksa bile HTTP server'ı başlat (extension'dan token almak için)
        def run_server():
            try:
                server = HTTPServer(('localhost', 8765), TokenUpdateHandler)
                logger.info("✅ Extension token server başlatıldı: http://localhost:8765")
                logger.info("💡 Extension popup'tan bot token'ını girin, .env dosyası otomatik oluşturulacak.")
                logger.info("📝 .env dosyası oluşturulduktan sonra bot'u yeniden başlatın.")
                server.serve_forever()
            except OSError as e:
                logger.error(f"❌ Token server başlatılamadı (port 8765): {e}")
                logger.error("Bir başka süreç portu kullanıyor olabilir.")
                return
        
        run_server()
        return
    
    # Token varsa bot'u başlat
    bot = GetirStockBot(token)
    bot.run()


if __name__ == '__main__':
    main()
