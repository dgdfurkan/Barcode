#!/usr/bin/env python3
"""Manuel login scripti - Browser'dan token alıp session'a kaydetmek için"""
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

from src.auth_manager import AuthManager

load_dotenv()

def main():
    """Manuel token girişi"""
    print("=" * 60)
    print("Manuel Token Girişi")
    print("=" * 60)
    print("\nBrowser'dan token almak için:")
    print("1. https://franchise.getir.com/login adresine gidin")
    print("2. Giriş yapın")
    print("3. Browser Console'u açın (F12)")
    print("4. Şu komutu çalıştırın:")
    print("   localStorage.getItem('accessToken')")
    print("\nVeya:")
    print("5. Application > Local Storage > franchise.getir.com")
    print("6. 'accessToken' key'ini bulun ve değerini kopyalayın")
    print("\n" + "=" * 60)
    
    token = input("\nAccess Token'ı yapıştırın (veya Enter'a basın çıkmak için): ").strip()
    
    if not token:
        print("İptal edildi.")
        return
    
    # Token'ı kaydet
    auth_manager = AuthManager()
    auth_manager.save_session(token, expires_in=3600)
    
    print(f"\n✅ Token başarıyla kaydedildi!")
    print(f"Token: {token[:50]}...")
    print("\nŞimdi bot'u çalıştırabilirsiniz: python main.py")

if __name__ == '__main__':
    main()

