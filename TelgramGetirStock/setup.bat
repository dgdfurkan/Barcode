@echo off
chcp 65001 >nul
echo.
echo Getir Stock Bot - Otomatik Kurulum Baslatiyor...
echo.

REM 1. Python kontrolu
echo ADIM 1: Python kontrol ediliyor...
:CHECK_PYTHON
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Python bulunamadi!
    echo.
    echo Python'u kurmak icin:
    echo   1. https://www.python.org/downloads/ adresine gidin
    echo   2. Download Python butonuna tiklayin
    echo   3. Kurulum sirasinda Add Python to PATH kutusunu isaretleyin!
    echo   4. Kurulumdan sonra bu pencereyi kapatip yeniden acin
    echo.
    echo Python'u yukledikten sonra bu pencereyi kapatip setup.bat'i tekrar calistirin.
    echo.
    pause
    exit /b 1
)

REM Python versiyonunu kontrol et (daha güvenli yöntem)
python -c "import sys; result = 'OK' if sys.version_info >= (3, 9) else 'FAIL'; print(result)" >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Python versiyon kontrolu basarisiz!
    python --version
    echo.
    echo Python 3.9+ gerekiyor!
    echo Python 3.9 veya uzerini kurmaniz gerekiyor:
    echo   1. https://www.python.org/downloads/ adresine gidin
    echo   2. Python 3.9 veya uzerini indirin ve kurun
    echo   3. Kurulum sirasinda Add Python to PATH kutusunu isaretleyin!
    echo   4. Kurulumdan sonra bu pencereyi kapatip yeniden acin
    echo.
    echo Python'u yukledikten sonra bu pencereyi kapatip setup.bat'i tekrar calistirin.
    echo.
    pause
    exit /b 1
)

REM Versiyon kontrolü (ikinci kontrol)
python -c "import sys; exit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Python 3.9+ gerekiyor!
    python --version
    echo.
    echo Python 3.9 veya uzerini kurmaniz gerekiyor:
    echo   1. https://www.python.org/downloads/ adresine gidin
    echo   2. Python 3.9 veya uzerini indirin ve kurun
    echo   3. Kurulum sirasinda Add Python to PATH kutusunu isaretleyin!
    echo   4. Kurulumdan sonra bu pencereyi kapatip yeniden acin
    echo.
    echo Python'u yukledikten sonra bu pencereyi kapatip setup.bat'i tekrar calistirin.
    echo.
    pause
    exit /b 1
)

python --version
echo [OK] Python bulundu!
echo.

REM 2. Proje klasorunu bul
set "SCRIPT_DIR=%~dp0"
echo Proje klasoru: %SCRIPT_DIR%
cd /d "%SCRIPT_DIR%"

REM 3. Virtual environment olustur
echo.
echo ADIM 2: Virtual environment olusturuluyor...
if exist "venv" (
    echo [UYARI] venv klasoru zaten var. Yeniden olusturuluyor...
    rmdir /s /q venv
)

python -m venv venv
if %errorlevel% neq 0 (
    echo [HATA] Virtual environment olusturulamadi!
    echo.
    echo Sorun giderme:
    echo   1. Python'un dogru kuruldugundan emin olun: python --version
    echo   2. venv modulunun kurulu oldugundan emin olun
    echo   3. python -m ensurepip --upgrade komutunu calistirin
    pause
    exit /b 1
)
echo [OK] Virtual environment olusturuldu
echo.

REM 4. Virtual environment'i aktiflestir
echo ADIM 3: Virtual environment aktiflestiriliyor...
call venv\Scripts\activate.bat

REM 5. pip'i guncelle
echo.
echo ADIM 4: pip guncelleniyor...
python -m pip install --upgrade pip --quiet
if %errorlevel% neq 0 (
    echo [UYARI] pip guncellenemedi, devam ediliyor...
)

REM 6. Bagimliliklari yukle
echo.
echo ADIM 5: Bagimlililar yukleniyor (bu biraz zaman alabilir)...
if exist "requirements.txt" (
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo [HATA] Bagimlililar yuklenemedi!
        echo.
        echo Sorun giderme:
        echo   1. Internet baglantinizi kontrol edin
        echo   2. pip'i guncelleyin: python -m pip install --upgrade pip
        echo   3. Manuel yuklemeyi deneyin: pip install python-telegram-bot requests python-dotenv
        pause
        exit /b 1
    )
    echo [OK] Bagimlililar yuklendi
) else (
    echo [HATA] requirements.txt bulunamadi!
    echo.
    echo Proje klasorunde requirements.txt dosyasi olmali!
    pause
    exit /b 1
)

REM 7. .env dosyasi kontrolu ve olusturma
echo.
echo ADIM 6: .env dosyasi kontrol ediliyor...

set NEED_BOT_TOKEN=1

if exist ".env" (
    REM .env dosyasi var, icerigini kontrol et
    findstr /C:"TELEGRAM_BOT_TOKEN=" .env >nul 2>&1
    if %errorlevel%==0 set NEED_BOT_TOKEN=0
    
    if %NEED_BOT_TOKEN%==0 (
        echo [OK] .env dosyasi zaten hazir! Bot Token mevcut.
        echo    Script devam ediyor...
        goto :ASK_GETIR_OPTIONAL
    ) else (
        echo [UYARI] .env dosyasi var ama Bot Token eksik.
        echo    Bot Token'i simdi girebilirsiniz...
        echo.
    )
) else (
    echo .env dosyasi bulunamadi. Olusturuluyor...
)

REM Bot Token'i kullanicidan al (zorunlu)
:ASK_BOT_TOKEN
echo.
echo ================================================================
echo Telegram Bot Token'inizi girin:
echo ================================================================
echo.
echo Telegram Bot Token'inizi girin:
echo    BotFather'dan aldigini token, ornek: 1234567890:ABC...
echo    BotFather: https://t.me/BotFather
set /p BOT_TOKEN="Bot Token: "
if "%BOT_TOKEN%"=="" (
    echo [HATA] Bot Token bos olamaz!
    goto :ASK_BOT_TOKEN
)

REM Getir bilgilerini sor (opsiyonel)
:ASK_GETIR_OPTIONAL
echo.
echo ================================================================
echo Getir bilgilerinizi girin (opsiyonel):
echo ================================================================
echo.
echo Not: Getir kullanici adi ve sifresi opsiyoneldir.
echo    Extension ile token'lar otomatik alinacaktir.
echo    Bos birakmak icin sadece Enter'a basin.
echo.
set /p GETIR_USERNAME="Getir kullanici adinizi girin (bos birakabilirsiniz): "
set /p GETIR_PASSWORD="Getir sifrenizi girin (bos birakabilirsiniz): "
echo.

REM .env dosyasina yaz
echo # Telegram Bot Token > .env
echo TELEGRAM_BOT_TOKEN=%BOT_TOKEN% >> .env
echo. >> .env

REM Getir bilgilerini ekle (varsa)
if not "%GETIR_USERNAME%"=="" (
    echo # Getir Credentials (opsiyonel) >> .env
    echo GETIR_USERNAME=%GETIR_USERNAME% >> .env
    if not "%GETIR_PASSWORD%"=="" (
        echo GETIR_PASSWORD=%GETIR_PASSWORD% >> .env
    )
    echo. >> .env
)

echo # Getir API >> .env
echo GETIR_API_BASE_URL=https://franchise-api-gateway.getirapi.com >> .env
echo GETIR_RECAPTCHA_SITE_KEY=6LfRdRobAAAAAGtQPnhju9dtpIU0eeMuJ_4ogcGa >> .env

echo.
echo [OK] .env dosyasi guncellendi ve bilgileriniz kaydedildi!
echo.
echo .env dosyasi icerigi:
type .env
echo.

:ENV_DONE

REM 8. Kurulum tamamlandi
echo.
echo ================================================================
echo KURULUM TAMAMLANDI!
echo ================================================================
echo.
echo Simdi yapmaniz gerekenler:
echo.
echo 1. Chrome Extension'ini yukleyin:
echo    - chrome://extensions/ adresine gidin
echo    - Developer mode'u acin
echo    - Load unpacked butonuna tiklayin
echo    - extension klasorunu secin
echo.
echo 2. Token'lari aktiflestirin:
echo    - franchise.getir.com adresine gidin ve sayfayi yenileyin (F5)
echo    - warehouse.getir.com adresine gidin ve hard refresh yapin (Ctrl+Shift+R)
echo.
echo 3. Bot baslatiliyor...
echo.
echo ================================================================
echo BOT BASLATILIYOR...
echo ================================================================
echo.
echo Bot'u durdurmak icin Ctrl+C tuslarina basin
echo.

REM Bot'u baslat
call venv\Scripts\activate.bat

REM Bot'u baslat (hata yakalama ile)
echo.
echo Bot baslatiliyor...
python main.py
set BOT_EXIT_CODE=%errorlevel%

if %BOT_EXIT_CODE% neq 0 (
    echo.
    echo [HATA] Bot baslatilamadi veya hata olustu!
    echo.
    echo Sorun giderme:
    echo   1. .env dosyasinin dogru oldugundan emin olun
    echo   2. Bot token'inin gecerli oldugundan emin olun
    echo   3. Internet baglantinizi kontrol edin
    echo   4. Bot loglarini kontrol edin: type bot.log
    echo.
    echo Bot'u manuel baslatmak icin:
    echo   venv\Scripts\activate
    echo   python main.py
    echo.
    pause
    exit /b 1
)

REM Bot kapandiginda
echo.
echo Bot durduruldu.
pause
