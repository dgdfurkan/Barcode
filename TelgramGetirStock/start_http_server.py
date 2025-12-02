"""Sadece HTTP Server - Token almak için"""
import logging
from http.server import HTTPServer
import sys
from pathlib import Path

# Add src directory to path
sys.path.append(str(Path(__file__).parent))

from src.bot import TokenUpdateHandler
from src.warehouse_client import WarehouseClient
from src.stock_service import StockService
from src.settings_manager import SettingsManager

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global bot instance (HTTP server için gerekli)
class SimpleBot:
    def __init__(self):
        self.warehouse_client = WarehouseClient()
        self.stock_service = StockService()
        self.settings_manager = SettingsManager()
        logger.info("✅ SimpleBot instance oluşturuldu")

# Global instance
import src.bot as bot_module
bot_module._global_bot_instance = SimpleBot()

# HTTP server'ı başlat
PORT = 8765
server = HTTPServer(('localhost', PORT), TokenUpdateHandler)
logger.info(f"✅ ✅ ✅ HTTP server başlatıldı: http://localhost:{PORT}")
logger.info("📥 Warehouse token'ları bekleniyor...")
logger.info("🔄 Warehouse sitesinde hard refresh yapın (Cmd+Shift+R)")

try:
    server.serve_forever()
except KeyboardInterrupt:
    logger.info("❌ HTTP server kapatılıyor...")
    server.shutdown()

