"""Kullanıcı ayarları yönetimi"""
import json
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class SettingsManager:
    """Kullanıcı ayarlarını yönetir"""
    
    def __init__(self):
        from src.utils import get_project_root
        data_dir = get_project_root() / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        self.settings_file = data_dir / "settings.json"
        self._settings: Dict[int, Dict[str, Any]] = {}
        self._load_settings()
    
    def _load_settings(self):
        """Ayarları dosyadan yükler"""
        if self.settings_file.exists():
            try:
                with open(self.settings_file, 'r', encoding='utf-8') as f:
                    self._settings = json.load(f)
                    # String key'leri int'e çevir (JSON'da key'ler string olarak saklanır)
                    self._settings = {int(k): v for k, v in self._settings.items()}
                logger.info(f"Ayarlar yüklendi: {len(self._settings)} kullanıcı")
            except Exception as e:
                logger.error(f"Ayarlar yüklenirken hata: {e}", exc_info=True)
                self._settings = {}
        else:
            self._settings = {}
            logger.info("Ayarlar dosyası bulunamadı, yeni oluşturulacak")
    
    def _save_settings(self):
        """Ayarları dosyaya kaydeder"""
        try:
            with open(self.settings_file, 'w', encoding='utf-8') as f:
                json.dump(self._settings, f, indent=2, ensure_ascii=False)
            logger.debug(f"Ayarlar kaydedildi: {len(self._settings)} kullanıcı")
        except Exception as e:
            logger.error(f"Ayarlar kaydedilirken hata: {e}", exc_info=True)
    
    def get_setting(self, user_id: int, key: str, default: Any = None) -> Any:
        """Kullanıcı ayarını alır"""
        user_settings = self._settings.get(user_id, {})
        return user_settings.get(key, default)
    
    def set_setting(self, user_id: int, key: str, value: Any):
        """Kullanıcı ayarını ayarlar"""
        if user_id not in self._settings:
            self._settings[user_id] = {}
        
        self._settings[user_id][key] = value
        self._save_settings()
        logger.info(f"Kullanıcı {user_id} için ayar güncellendi: {key} = {value}")
    
    def get_user_settings(self, user_id: int) -> Dict[str, Any]:
        """Kullanıcının tüm ayarlarını alır"""
        return self._settings.get(user_id, {}).copy()
    
    def is_skt_enabled(self, user_id: int) -> bool:
        """Kullanıcının SKT özelliğinin aktif olup olmadığını kontrol eder"""
        return self.get_setting(user_id, 'skt_enabled', False)
    
    def enable_skt(self, user_id: int):
        """SKT özelliğini aktifleştirir"""
        self.set_setting(user_id, 'skt_enabled', True)
    
    def disable_skt(self, user_id: int):
        """SKT özelliğini devre dışı bırakır"""
        self.set_setting(user_id, 'skt_enabled', False)

    def get_all_users(self) -> list:
        """Tüm kullanıcı ID'lerini döndürür"""
        return list(self._settings.keys())