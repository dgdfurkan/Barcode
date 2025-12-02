"""Extension token test"""
import requests
import json

# Extension'dan token almak için test
print("Extension token test:")
print("1. Browser'da Getir sitesine gidin: https://franchise.getir.com")
print("2. F12'ye basın ve Console sekmesine gidin")
print("3. Şunu yazın: localStorage.getItem('accessToken')")
print("4. Çıkan token'ı kopyalayın ve buraya yapıştırın")
print("\nVeya extension popup'a tıklayıp durumu kontrol edin")
print("\nŞu anki token durumu:")
try:
    response = requests.get('http://localhost:8765/status', timeout=2)
    if response.ok:
        data = response.json()
        print(json.dumps(data, indent=2, ensure_ascii=False))
    else:
        print("Bot server yanıt vermiyor")
except Exception as e:
    print(f"Hata: {e}")
