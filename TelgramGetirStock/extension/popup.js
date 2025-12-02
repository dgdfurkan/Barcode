const LOG_PREFIX = '🤖';
const BOT_SERVER_URL = 'http://localhost:8765';

document.addEventListener('DOMContentLoaded', () => {
  // Tab değiştirme
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      
      // Tüm tab'ları ve içerikleri deaktif et
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));
      
      // Seçilen tab'ı aktif et
      tab.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
    });
  });
  
  const statusDiv = document.getElementById('status');
  const checkBtn = document.getElementById('checkBtn');
  const tokenInput = document.getElementById('tokenInput');
  const sendTokenBtn = document.getElementById('sendTokenBtn');
  const tokenStatus = document.getElementById('tokenStatus');
  const botTokenInput = document.getElementById('botTokenInput');
  const saveBotTokenBtn = document.getElementById('saveBotTokenBtn');
  const botTokenStatus = document.getElementById('botTokenStatus');
  const sktToggle = document.getElementById('sktToggle');
  const sktStatusMsg = document.getElementById('sktStatusMsg');
  const botInfo = document.getElementById('botInfo');
  const botTokenDisplay = document.getElementById('botTokenDisplay');
  const franchiseTokenStatus = document.getElementById('franchiseTokenStatus');
  const sktStatus = document.getElementById('sktStatus');

  // Storage'dan bot token'ı yükle
  chrome.storage.local.get(['botToken'], (result) => {
    if (result.botToken) {
      botTokenInput.value = result.botToken;
    }
  });

  // Bot durumu kontrolü
  async function checkBotStatus() {
    statusDiv.textContent = 'Kontrol ediliyor...';
    statusDiv.className = 'status info';
    botInfo.style.display = 'none';
    
    try {
      const response = await fetch(`${BOT_SERVER_URL}/status`);
      if (response.ok) {
        const data = await response.json();
        statusDiv.textContent = `✅ Bot çalışıyor`;
        statusDiv.className = 'status success';
        
        // Bot bilgilerini göster
        botInfo.style.display = 'block';
        botTokenDisplay.textContent = data.bot_token || 'Yükleniyor...';
        franchiseTokenStatus.textContent = data.token_status === 'geçerli' ? '✅ Geçerli' : '❌ Geçersiz';
        sktStatus.textContent = data.skt_enabled ? '✅ Açık' : '❌ Kapalı';
        
        // SKT toggle durumunu güncelle
        if (data.skt_enabled) {
          sktToggle.classList.add('active');
          sktStatusMsg.textContent = 'SKT bilgisi gösteriliyor';
          sktStatusMsg.style.color = '#155724';
        } else {
          sktToggle.classList.remove('active');
          sktStatusMsg.textContent = 'SKT bilgisi gizleniyor';
          sktStatusMsg.style.color = '#721c24';
        }
      } else {
        throw new Error('Bot yanıt vermedi');
      }
    } catch (error) {
      statusDiv.textContent = '❌ Bot çalışmıyor veya erişilemiyor';
      statusDiv.className = 'status error';
      botInfo.style.display = 'none';
      
      // SKT toggle'ı devre dışı bırak
      sktToggle.classList.remove('active');
      sktStatusMsg.textContent = 'Bot çalışmıyor - ayarlar kullanılamıyor';
      sktStatusMsg.style.color = '#721c24';
    }
  }

  // Bot token kaydetme
  saveBotTokenBtn.addEventListener('click', async () => {
    const botToken = botTokenInput.value.trim();
    
    if (!botToken) {
      botTokenStatus.innerHTML = '<div class="status error">⚠️ Lütfen bot token girin</div>';
      return;
    }
    
    // Bot token formatını kontrol et (sayı:harf formatı)
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) {
      botTokenStatus.innerHTML = '<div class="status error">⚠️ Bot token formatı geçersiz. Format: 1234567890:ABC...</div>';
      return;
    }
    
    saveBotTokenBtn.disabled = true;
    saveBotTokenBtn.textContent = 'Kaydediliyor...';
    
    try {
      // Chrome storage'a kaydet
      await chrome.storage.local.set({ botToken: botToken });
      
      // Bot çalışıyorsa .env dosyasını otomatik güncelle
      try {
        const response = await fetch(`${BOT_SERVER_URL}/update-env`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bot_token: botToken
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          botTokenStatus.innerHTML = '<div class="status success">✅ Bot token kaydedildi ve .env dosyası güncellendi!</div>';
          botTokenStatus.innerHTML += '<div class="status warning" style="margin-top: 5px;">⚠️ Bot\'u yeniden başlatmanız gerekiyor. Terminal\'de Ctrl+C ile durdurun, sonra tekrar başlatın.</div>';
        } else {
          // Bot çalışmıyor, sadece storage'a kaydet
          botTokenStatus.innerHTML = '<div class="status success">✅ Bot token kaydedildi (Chrome storage)</div>';
          botTokenStatus.innerHTML += '<div class="status warning" style="margin-top: 5px;">⚠️ Bot çalışmıyor. Bot\'u başlattıktan sonra .env dosyası otomatik güncellenecek.</div>';
          botTokenStatus.innerHTML += `
            <div class="instructions" style="margin-top: 10px;">
              <strong>📝 Veya manuel olarak .env dosyasını güncelleyin:</strong><br>
              <code style="background: #f0f0f0; padding: 2px 5px; border-radius: 3px;">TELEGRAM_BOT_TOKEN=${botToken}</code>
            </div>
          `;
        }
      } catch (error) {
        // Bot çalışmıyor
        botTokenStatus.innerHTML = '<div class="status success">✅ Bot token kaydedildi (Chrome storage)</div>';
        botTokenStatus.innerHTML += '<div class="status warning" style="margin-top: 5px;">⚠️ Bot çalışmıyor. Bot\'u başlattıktan sonra .env dosyası otomatik güncellenecek.</div>';
        botTokenStatus.innerHTML += `
          <div class="instructions" style="margin-top: 10px;">
            <strong>📝 Veya manuel olarak .env dosyasını güncelleyin:</strong><br>
            <code style="background: #f0f0f0; padding: 2px 5px; border-radius: 3px;">TELEGRAM_BOT_TOKEN=${botToken}</code>
          </div>
        `;
      }
    } catch (error) {
      botTokenStatus.innerHTML = `<div class="status error">❌ Hata: ${error.message}</div>`;
    } finally {
      saveBotTokenBtn.disabled = false;
      saveBotTokenBtn.textContent = '💾 Bot Token\'ı Kaydet';
    }
  });

  // SKT toggle
  sktToggle.addEventListener('click', async () => {
    try {
      const response = await fetch(`${BOT_SERVER_URL}/skt-toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.skt_enabled) {
          sktToggle.classList.add('active');
          sktStatusMsg.textContent = '✅ SKT bilgisi açıldı';
          sktStatusMsg.style.color = '#155724';
        } else {
          sktToggle.classList.remove('active');
          sktStatusMsg.textContent = '❌ SKT bilgisi kapatıldı';
          sktStatusMsg.style.color = '#721c24';
        }
        
        // Bot durumunu yenile
        setTimeout(checkBotStatus, 500);
      } else {
        throw new Error('SKT ayarı güncellenemedi');
      }
    } catch (error) {
      sktStatusMsg.textContent = `❌ Hata: ${error.message}`;
      sktStatusMsg.style.color = '#721c24';
    }
  });

  // Durum kontrolü butonu
  checkBtn.addEventListener('click', checkBotStatus);

  // Token gönderme (manuel)
  sendTokenBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    
    if (!token) {
      tokenStatus.innerHTML = '<div class="status error">⚠️ Lütfen token girin</div>';
      return;
    }
    
    if (!token.startsWith('eyJ')) {
      tokenStatus.innerHTML = '<div class="status error">⚠️ Token formatı geçersiz. JWT token\'lar "eyJ" ile başlar.</div>';
      return;
    }
    
    sendTokenBtn.disabled = true;
    sendTokenBtn.textContent = 'Gönderiliyor...';
    tokenStatus.innerHTML = '<div class="status info">Token gönderiliyor...</div>';
    
    try {
      const response = await fetch(`${BOT_SERVER_URL}/update-keycloak-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: token,
          timestamp: Date.now()
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        tokenStatus.innerHTML = '<div class="status success">✅ Token başarıyla bot\'a gönderildi!</div>';
        tokenInput.value = '';
        // Durumu yenile
        setTimeout(checkBotStatus, 500);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Bilinmeyen hata' }));
        tokenStatus.innerHTML = `<div class="status error">❌ Hata: ${errorData.error || response.statusText}</div>`;
      }
    } catch (error) {
      tokenStatus.innerHTML = `<div class="status error">❌ Bot\'a bağlanılamadı. Bot çalışıyor mu kontrol edin.</div>`;
    } finally {
      sendTokenBtn.disabled = false;
      sendTokenBtn.textContent = '📤 Token\'ı Bot\'a Gönder';
    }
  });

  // Enter tuşu ile token gönder
  tokenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      sendTokenBtn.click();
    }
  });

  // İlk durum kontrolü
  checkBotStatus();
  
  // Her 10 saniyede bir durumu güncelle
  setInterval(checkBotStatus, 10000);
  
  // ============================================
  // KURULUM SİHİRBZI
  // ============================================
  const setupBotTokenInput = document.getElementById('setupBotToken');
  const startSetupBtn = document.getElementById('startSetupBtn');
  const setupInstructions = document.getElementById('setupInstructions');
  const setupInstructionsContent = document.getElementById('setupInstructionsContent');
  const setupProgress = document.getElementById('setupProgress');
  const setupProgressText = document.getElementById('setupProgressText');
  
  // Kurulumu başlat
  startSetupBtn.addEventListener('click', async () => {
    const botToken = setupBotTokenInput.value.trim();
    
    if (!botToken) {
      setupProgress.style.display = 'block';
      setupProgress.style.borderLeftColor = '#dc3545';
      setupProgressText.textContent = '⚠️ Lütfen bot token girin!';
      return;
    }
    
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) {
      setupProgress.style.display = 'block';
      setupProgress.style.borderLeftColor = '#dc3545';
      setupProgressText.textContent = '⚠️ Bot token formatı geçersiz! Format: 1234567890:ABC...';
      return;
    }
    
    startSetupBtn.disabled = true;
    startSetupBtn.textContent = 'Kurulum yapılıyor...';
    setupProgress.style.display = 'block';
    setupProgress.style.borderLeftColor = '#28a745';
    setupProgressText.textContent = 'Bot\'a bilgiler gönderiliyor...';
    
    try {
      // Bot'a .env bilgilerini gönder (bot kendi klasörünü kullanacak)
      const response = await fetch(`${BOT_SERVER_URL}/update-env`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bot_token: botToken
        })
      });
      
      if (response.ok) {
        setupProgressText.textContent = '✅ .env dosyası ve setup script\'leri oluşturuldu!';
        
        // Bot'un klasör yolunu al
        let projectPath = 'bot klasörü';
        try {
          const pathResponse = await fetch(`${BOT_SERVER_URL}/project-path`);
          if (pathResponse.ok) {
            const pathData = await pathResponse.json();
            projectPath = pathData.project_path || 'bot klasörü';
          }
        } catch (e) {
          console.log('Klasör yolu alınamadı:', e);
        }
        
        // Platform tespiti
        const isWindows = navigator.platform.toLowerCase().includes('win');
        const scriptFile = isWindows ? 'setup.bat' : 'setup.sh';
        
        setupInstructions.style.display = 'block';
        setupInstructionsContent.innerHTML = `
          <div style="margin-bottom: 10px;">
            <strong>✅ Kurulum hazır!</strong><br>
            Bot klasöründe <code>${scriptFile}</code> dosyası oluşturuldu.
          </div>
          
          <div style="margin-bottom: 10px;">
            <strong>📁 Script'i çalıştırın:</strong><br>
            Terminal/Command Prompt'u açın ve şunu yazın:<br>
            <code style="background: #f0f0f0; padding: 8px 12px; border-radius: 4px; display: block; margin-top: 8px; margin-bottom: 8px; font-size: 11px; font-family: monospace; white-space: pre-wrap; line-height: 1.6;">
cd "${projectPath}"
${isWindows ? scriptFile : `bash ${scriptFile}`}
            </code>
          </div>
          
          <div style="background-color: #fff3cd; padding: 10px; border-radius: 5px; border-left: 4px solid #ffc107;">
            <strong>💡 Script ne yapar?</strong><br>
            ✅ Python kontrolü<br>
            ✅ Virtual environment oluşturma<br>
            ✅ Bağımlılıkları yükleme<br>
            ✅ Bot'u otomatik başlatma
          </div>
        `;
        
        // Chrome storage'a bot token'ı kaydet
        await chrome.storage.local.set({ botToken: botToken });
        
        startSetupBtn.textContent = '✅ Tamamlandı!';
        startSetupBtn.style.backgroundColor = '#28a745';
      } else {
        let errorMessage = 'Bilinmeyen hata';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || response.statusText || 'Bilinmeyen hata';
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        setupProgressText.textContent = `❌ Hata: ${errorMessage}`;
        setupProgress.style.borderLeftColor = '#dc3545';
        startSetupBtn.disabled = false;
        startSetupBtn.textContent = '🚀 Kurulumu Başlat';
      }
    } catch (error) {
      setupProgressText.textContent = '❌ HTTP server\'a bağlanılamadı!';
      setupProgress.style.borderLeftColor = '#dc3545';
      setupInstructions.style.display = 'block';
      setupInstructionsContent.innerHTML = `
        <div style="color: #dc3545;">
          <strong>⚠️ Bot HTTP server çalışmıyor!</strong><br><br>
          <strong>📝 ADIM 1: Bot'u başlatın (token olmadan bile çalışır):</strong><br>
          Terminal'de bot klasörüne gidin ve şunu yazın:<br>
          <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 3px; display: inline-block; margin-top: 5px;">
            python${navigator.platform.toLowerCase().includes('win') ? '' : '3'} main.py
          </code><br><br>
          Bot token yoksa bile HTTP server başlayacak ve extension'dan token girebileceksiniz.<br><br>
          <strong>📝 ADIM 2: Token'ı girin</strong><br>
          Bot başladıktan sonra buradan tekrar "Kurulumu Başlat" butonuna tıklayın.
        </div>
      `;
      startSetupBtn.disabled = false;
      startSetupBtn.textContent = '🚀 Kurulumu Başlat';
    }
  });
  
  // Enter tuşu ile kurulumu başlat
  setupBotTokenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      startSetupBtn.click();
    }
  });
  
  // Kurulum script'leri bölümünü güncelle (bot klasör yolunu göster)
  async function updateSetupScriptsInstructions() {
    const setupScriptsContent = document.getElementById('setupScriptsContent');
    if (!setupScriptsContent) return;
    
    let projectPath = '';
    
    // Bot'tan klasör yolunu almaya çalış
    try {
      const pathResponse = await fetch(`${BOT_SERVER_URL}/project-path`);
      if (pathResponse.ok) {
        const pathData = await pathResponse.json();
        projectPath = pathData.project_path || '';
      }
    } catch (e) {
      // Bot çalışmıyor, devam et
    }
    
    // Bot çalışmıyorsa veya yol alınamadıysa, extension'ın kurulu olduğu klasörü göster
    // Extension genelde bot klasörüne yüklenir: chrome://extensions/ -> Detaylar -> Yükleme klasörü
    if (!projectPath) {
      // Örnek klasör yolu göster (kullanıcı kendi yolunu kullanacak)
      const examplePathMac = '/Users/kullaniciadi/CursorProjects/TelgramGetirStock';
      const examplePathWindows = 'C:\\Users\\kullaniciadi\\CursorProjects\\TelgramGetirStock';
      const isWindows = navigator.platform.toLowerCase().includes('win');
      const examplePath = isWindows ? examplePathWindows : examplePathMac;
      
      setupScriptsContent.innerHTML = `
        <div style="margin-bottom: 15px; padding: 10px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
          <strong>📁 Extension klasörünü bulun:</strong><br>
          Chrome'da <code>chrome://extensions/</code> adresine gidin<br>
          Extension'ın yanındaki <strong>"Detaylar"</strong> butonuna tıklayın<br>
          <strong>"Yükleme klasörü"</strong> kısmından extension klasörünün yolunu görebilirsiniz<br>
          Extension klasörünün <strong>parent klasörü</strong> bot klasörüdür<br><br>
          <strong>Örnek:</strong> Extension klasörü <code>/Users/kullaniciadi/CursorProjects/TelgramGetirStock/extension</code> ise<br>
          Bot klasörü: <code>/Users/kullaniciadi/CursorProjects/TelgramGetirStock</code>
        </div>
        
        <strong>🍎 Mac/Linux:</strong><br>
        Terminal'de şunu yazın (kendi klasör yolunuzu kullanın):<br>
        <code style="background: #f0f0f0; padding: 8px 12px; border-radius: 4px; display: block; margin-top: 8px; margin-bottom: 8px; font-family: monospace; white-space: pre-wrap; line-height: 1.6; cursor: text; user-select: all;">
cd "${examplePath}"
bash setup.sh
        </code>
        <small style="color: #666; display: block; margin-top: 5px;">💡 Yukarıdaki <code>${examplePath}</code> kısmını kendi bot klasör yolunuzla değiştirin</small>
        
        <strong>🪟 Windows:</strong><br>
        Command Prompt'u açın ve şunu yazın (kendi klasör yolunuzu kullanın):<br>
        <code style="background: #f0f0f0; padding: 8px 12px; border-radius: 4px; display: block; margin-top: 8px; margin-bottom: 8px; font-family: monospace; white-space: pre-wrap; line-height: 1.6; cursor: text; user-select: all;">
cd "${examplePathWindows}"
setup.bat
        </code>
        <small style="color: #666; display: block; margin-top: 5px;">💡 Yukarıdaki <code>${examplePathWindows}</code> kısmını kendi bot klasör yolunuzla değiştirin</small>
        
        <div class="note" style="margin-top: 15px;">
          <strong>💡 Script ne yapar?</strong><br>
          ✅ Python kontrolü<br>
          ✅ Virtual environment oluşturma<br>
          ✅ Bağımlılıkları yükleme<br>
          ✅ Bot'u otomatik başlatma
        </div>
      `;
      return;
    }
    
    setupScriptsContent.innerHTML = `
      <strong>🍎 Mac/Linux:</strong><br>
      Terminal'de şunu yazın:<br>
      <code style="background: #f0f0f0; padding: 8px 12px; border-radius: 4px; display: block; margin-top: 8px; margin-bottom: 8px; font-family: monospace; white-space: pre-wrap; line-height: 1.6; cursor: text; user-select: all;">
cd "${projectPath}"
bash setup.sh
      </code>
      
      <strong>🪟 Windows:</strong><br>
      Command Prompt'u açın ve şunu yazın:<br>
      <code style="background: #f0f0f0; padding: 8px 12px; border-radius: 4px; display: block; margin-top: 8px; margin-bottom: 8px; font-family: monospace; white-space: pre-wrap; line-height: 1.6; cursor: text; user-select: all;">
cd "${projectPath}"
setup.bat
      </code>
      
      <div class="note" style="margin-top: 15px;">
        <strong>💡 Script ne yapar?</strong><br>
        ✅ Python kontrolü<br>
        ✅ Virtual environment oluşturma<br>
        ✅ Bağımlılıkları yükleme<br>
        ✅ Bot'u otomatik başlatma
      </div>
    `;
  }
  
  // Sayfa yüklendiğinde kurulum talimatlarını güncelle
  updateSetupScriptsInstructions();
});
