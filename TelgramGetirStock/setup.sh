#!/bin/bash

# Getir Stock Bot - Otomatik Kurulum Script'i (Mac/Linux)
# Bu script'i çalıştırmak için: bash setup.sh

echo "🚀 Getir Stock Bot - Otomatik Kurulum Başlatılıyor..."
echo ""

# Renk kodları
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Python kontrolü (döngü ile kontrol)
echo "📋 ADIM 1: Python kontrol ediliyor..."
PYTHON_FOUND=false

while [ "$PYTHON_FOUND" = false ]; do
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version 2>&1)
        
        # Python versiyonunu kontrol et (daha güvenli yöntem)
        PYTHON_CHECK=$(python3 -c "import sys; print('OK' if sys.version_info >= (3, 9) else 'FAIL')" 2>&1)
        
        if [ "$PYTHON_CHECK" = "OK" ]; then
            echo -e "${GREEN}✅ Python bulundu: $PYTHON_VERSION${NC}"
            PYTHON_FOUND=true
        else
            echo -e "${RED}❌ Python 3.9+ gerekiyor! Mevcut versiyon: $PYTHON_VERSION${NC}"
            echo ""
            echo "Python 3.9 veya üzerini kurmanız gerekiyor:"
            echo "  Mac: brew install python3"
            echo "  Linux: sudo apt install python3 python3-pip python3-venv"
            echo ""
            read -p "Python'u yükledikten sonra Enter'a basın (veya 'q' ile çıkış): " user_input
            if [ "$user_input" = "q" ]; then
                exit 1
            fi
        fi
    else
        echo -e "${RED}❌ Python bulunamadı!${NC}"
        echo ""
        echo "Python'u kurmak için:"
        echo "  Mac: brew install python3"
        echo "  Linux: sudo apt install python3 python3-pip python3-venv"
        echo ""
        read -p "Python'u yükledikten sonra Enter'a basın (veya 'q' ile çıkış): " user_input
        if [ "$user_input" = "q" ]; then
            exit 1
        fi
    fi
done

# 2. Proje klasörünü bul
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo ""
echo "📁 Proje klasörü: $SCRIPT_DIR"
cd "$SCRIPT_DIR"

# 3. Virtual environment oluştur
echo ""
echo "📋 ADIM 2: Virtual environment oluşturuluyor..."
if [ -d "venv" ]; then
    echo -e "${YELLOW}⚠️ venv klasörü zaten var. Yeniden oluşturuluyor...${NC}"
    rm -rf venv
fi

python3 -m venv venv
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Virtual environment oluşturulamadı!${NC}"
    echo ""
    echo "Sorun giderme:"
    echo "  1. Python'un doğru kurulduğundan emin olun: python3 --version"
    echo "  2. venv modülünün kurulu olduğundan emin olun"
    echo "  3. Mac: python3 -m ensurepip --upgrade"
    echo "  4. Linux: sudo apt install python3-venv"
    exit 1
fi
echo -e "${GREEN}✅ Virtual environment oluşturuldu${NC}"

# 4. Virtual environment'ı aktifleştir
echo ""
echo "📋 ADIM 3: Virtual environment aktifleştiriliyor..."
source venv/bin/activate

# 5. pip'i güncelle
echo ""
echo "📋 ADIM 4: pip güncelleniyor..."
pip install --upgrade pip --quiet
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️ pip güncellenemedi, devam ediliyor...${NC}"
fi

# 6. Bağımlılıkları yükle
echo ""
echo "📋 ADIM 5: Bağımlılıklar yükleniyor (bu biraz zaman alabilir)..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Bağımlılıklar yüklenemedi!${NC}"
        echo ""
        echo "Sorun giderme:"
        echo "  1. İnternet bağlantınızı kontrol edin"
        echo "  2. pip'i güncelleyin: pip install --upgrade pip"
        echo "  3. Manuel yüklemeyi deneyin: pip install python-telegram-bot requests python-dotenv"
        exit 1
    fi
    echo -e "${GREEN}✅ Bağımlılıklar yüklendi${NC}"
else
    echo -e "${RED}❌ requirements.txt bulunamadı!${NC}"
    echo ""
    echo "Proje klasöründe requirements.txt dosyası olmalı!"
    exit 1
fi

# 7. .env dosyası kontrolü ve oluşturma
echo ""
echo "📋 ADIM 6: .env dosyası kontrol ediliyor..."

NEED_BOT_TOKEN=true

if [ -f ".env" ]; then
    # .env dosyası var, içeriğini kontrol et
    if grep -q "^TELEGRAM_BOT_TOKEN=" .env 2>/dev/null; then
        NEED_BOT_TOKEN=false
    fi
    
    if [ "$NEED_BOT_TOKEN" = false ]; then
        echo -e "${GREEN}✅ .env dosyası zaten hazır! Bot Token mevcut.${NC}"
        echo "   Script devam ediyor..."
    else
        echo -e "${YELLOW}⚠️ .env dosyası var ama Bot Token eksik.${NC}"
        echo "   Bot Token'ı şimdi girebilirsiniz..."
        echo ""
    fi
else
    echo ".env dosyası bulunamadı. Oluşturuluyor..."
    touch .env
fi

# Bot Token'ı kullanıcıdan al (zorunlu)
if [ "$NEED_BOT_TOKEN" = true ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📝 Telegram Bot Token'ınızı girin:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🤖 Telegram Bot Token'ınızı girin:"
    echo "   (BotFather'dan aldığınız token, örnek: 1234567890:ABC...)"
    echo "   BotFather: https://t.me/BotFather"
    read -p "Bot Token: " BOT_TOKEN
    while [ -z "$BOT_TOKEN" ]; do
        echo -e "${RED}❌ Bot Token boş olamaz!${NC}"
        read -p "Bot Token: " BOT_TOKEN
    done
    echo ""
else
    BOT_TOKEN=$(grep "^TELEGRAM_BOT_TOKEN=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
fi

# Getir Username ve Password (opsiyonel)
if [ -f ".env" ]; then
    GETIR_USERNAME=$(grep "^GETIR_USERNAME=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")
    GETIR_PASSWORD=$(grep "^GETIR_PASSWORD=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")
else
    GETIR_USERNAME=""
    GETIR_PASSWORD=""
fi

# Opsiyonel: Getir bilgilerini sor
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Getir bilgilerinizi girin (opsiyonel):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Not: Getir kullanıcı adı ve şifresi opsiyoneldir."
echo "   Extension ile token'lar otomatik alınacaktır."
echo ""
read -p "👤 Getir kullanıcı adınızı girin (boş bırakabilirsiniz): " GETIR_USERNAME_INPUT
if [ ! -z "$GETIR_USERNAME_INPUT" ]; then
    GETIR_USERNAME="$GETIR_USERNAME_INPUT"
fi

read -s -p "🔒 Getir şifrenizi girin (boş bırakabilirsiniz): " GETIR_PASSWORD_INPUT
echo ""
if [ ! -z "$GETIR_PASSWORD_INPUT" ]; then
    GETIR_PASSWORD="$GETIR_PASSWORD_INPUT"
fi
echo ""
    
# .env dosyasına yaz (mevcut içeriği koruyarak)
if [ ! -f ".env" ] || [ ! -s ".env" ]; then
    # Yeni dosya oluştur
    {
        echo "# Telegram Bot Token"
        echo "TELEGRAM_BOT_TOKEN=$BOT_TOKEN"
        echo ""
        if [ ! -z "$GETIR_USERNAME" ]; then
            echo "# Getir Credentials (opsiyonel)"
            echo "GETIR_USERNAME=$GETIR_USERNAME"
            if [ ! -z "$GETIR_PASSWORD" ]; then
                echo "GETIR_PASSWORD=$GETIR_PASSWORD"
            fi
            echo ""
        fi
        echo "# Getir API"
        echo "GETIR_API_BASE_URL=https://franchise-api-gateway.getirapi.com"
        echo "GETIR_RECAPTCHA_SITE_KEY=6LfRdRobAAAAAGtQPnhju9dtpIU0eeMuJ_4ogcGa"
    } > .env
else
    # Mevcut dosyayı güncelle
    if [ "$NEED_BOT_TOKEN" = true ]; then
        if grep -q "^TELEGRAM_BOT_TOKEN=" .env; then
            sed -i.bak "s|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=$BOT_TOKEN|" .env
        else
            echo "TELEGRAM_BOT_TOKEN=$BOT_TOKEN" >> .env
        fi
    fi
    
    # Getir bilgilerini güncelle (varsa)
    if [ ! -z "$GETIR_USERNAME" ]; then
        if grep -q "^GETIR_USERNAME=" .env; then
            sed -i.bak "s|^GETIR_USERNAME=.*|GETIR_USERNAME=$GETIR_USERNAME|" .env
        else
            echo "GETIR_USERNAME=$GETIR_USERNAME" >> .env
        fi
        
        if [ ! -z "$GETIR_PASSWORD" ]; then
            if grep -q "^GETIR_PASSWORD=" .env; then
                sed -i.bak "s|^GETIR_PASSWORD=.*|GETIR_PASSWORD=$GETIR_PASSWORD|" .env
            else
                echo "GETIR_PASSWORD=$GETIR_PASSWORD" >> .env
            fi
        fi
    fi
    
    # API URL'leri yoksa ekle
    if ! grep -q "^GETIR_API_BASE_URL=" .env; then
        echo "" >> .env
        echo "# Getir API" >> .env
        echo "GETIR_API_BASE_URL=https://franchise-api-gateway.getirapi.com" >> .env
        echo "GETIR_RECAPTCHA_SITE_KEY=6LfRdRobAAAAAGtQPnhju9dtpIU0eeMuJ_4ogcGa" >> .env
    fi
    
    rm -f .env.bak 2>/dev/null
fi

echo ""
echo -e "${GREEN}✅ .env dosyası güncellendi ve bilgileriniz kaydedildi!${NC}"
echo ""
echo "📄 .env dosyası içeriği:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat .env
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 8. Kurulum tamamlandı
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ ✅ ✅ KURULUM TAMAMLANDI! ✅ ✅ ✅${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Şimdi yapmanız gerekenler:"
echo ""
echo "1️⃣  Chrome Extension'ını yükleyin:"
echo "   - chrome://extensions/ → Developer mode açın"
echo "   - 'Load unpacked' → extension klasörünü seçin"
echo ""
echo "2️⃣  Token'ları aktifleştirin:"
echo "   - franchise.getir.com → Sayfayı yenileyin"
echo "   - warehouse.getir.com → Sayfayı hard refresh yapın (Cmd+Shift+R)"
echo ""
echo "3️⃣  Bot başlatılıyor..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🚀 BOT BAŞLATILIYOR...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Bot'u durdurmak için Ctrl+C tuşlarına basın"
echo ""

# Bot'u başlat
source venv/bin/activate

# Bot'u başlat (hata yakalama ile)
echo ""
echo "Bot başlatılıyor..."
python3 main.py
BOT_EXIT_CODE=$?

if [ $BOT_EXIT_CODE -ne 0 ]; then
    echo ""
    echo -e "${RED}❌ Bot başlatılamadı veya hata oluştu!${NC}"
    echo ""
    echo "Sorun giderme:"
    echo "  1. .env dosyasının doğru olduğundan emin olun"
    echo "  2. Bot token'ının geçerli olduğundan emin olun"
    echo "  3. İnternet bağlantınızı kontrol edin"
    echo "  4. Bot loglarını kontrol edin: cat bot.log"
    echo ""
    echo "Bot'u manuel başlatmak için:"
    echo "  source venv/bin/activate"
    echo "  python3 main.py"
    echo ""
    exit 1
fi

# Bot kapandığında
echo ""
echo "Bot durduruldu."

