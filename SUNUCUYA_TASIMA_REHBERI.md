# 👑 King Puan & Ceza Hesaplayıcı — Sunucuya Taşıma Rehberi

Bu uygulama sıfır dış kütüphaneye bağımlıdır (saf Python + Vanilla HTML/CSS/JS). Bu sayede herhangi bir sunucuda veya ücretsiz bulut platformunda **3 dakikada** kalıcı olarak yayına alınabilir.

---

## 🌟 Seçenek 1: Render.com (Tamamen Ücretsiz & En Kolayı - Tavsiye Edilen)

Render.com üzerinde bilgisayarınız kapalıyken bile 7/24 çalışacak kalıcı bir internet adresi (`https://king-hesaplama.onrender.com`) alabilirsiniz:

1. **GitHub'a Yükleyin:**
   * Proje klasörünüzü bir GitHub reposuna yükleyin (örneğin `king-puan-hesaplama`).
2. **Render'a Giriş Yapın:**
   * [Render.com](https://render.com) adresine gidin ve GitHub hesabınızla giriş yapın.
3. **Yeni Web Service Açın:**
   * **New +** ➔ **Web Service** seçin.
   * GitHub reponuzu seçin.
   * Ayarlar:
     * **Environment:** `Python 3`
     * **Build Command:** *(boş bırakın)*
     * **Start Command:** `python3 server.py --no-browser`
     * **Plan:** `Free` (Ücretsiz)
4. **Deploy:**
   * **Deploy Web Service** butonuna basın.
   * 1 dakika içinde size `https://king-xxx.onrender.com` şeklinde dünya çapında erişilebilir kalıcı bir bağlantı verir!
   * Artık arkadaşlarınız evlerinde veya kafede kendi hücresel verileriyle (4G/5G) bu linke girerek aynı masaya canlı bağlanabilir.

---

## 🌟 Seçenek 2: Railway.app (Alternatif Ücretsiz Bulut)

1. [railway.app](https://railway.app) adresine gidin.
2. **New Project** ➔ **Deploy from GitHub repo** deyin.
3. Klasörde hazır bulunan `Procfile` sayesinde Railway uygulamayı otomatik tanır ve yayına alır.

---

## 🌟 Seçenek 3: Kendi VPS / Linux Sunucunuz (DigitalOcean, Hetzner, AWS vs.)

Eğer kendinize ait bir Linux sunucunuz varsa:

1. Klasörü sunucuya kopyalayın:
   ```bash
   scp -r king-puan-ve-ceza-hesaplama user@sunucu-ip:/var/www/king
   ```
2. Sunucuda arka planda çalıştırın (systemd veya screen ile):
   ```bash
   PORT=80 python3 /var/www/king/server.py --no-browser
   ```
3. Veya Docker ile tek satırda ayağa kaldırın:
   ```bash
   docker build -t king-app .
   docker run -d -p 80:8888 --name king king-app
   ```

---

## 📊 Toplu Çıktı ve Arşiv Özellikleri

Sunucuya taşıdığınızda tüm özellikler aynen çalışır:
* **💾 Otomatik Arşiv:** Her "Yeni Oyun" başlatıldığında veya el bittiğinde eski oyun `games_archive.json` içine kaydedilir.
* **📂 Geçmiş Arşiv:** Arayüzdeki **"📂 Geçmiş Arşiv"** butonundan eski tüm oyunlar, tarihler, kazananlar ve çeteler listelenir.
* **📊 Excel / CSV İndir:** Tek tıkla o anki oyunun veya eski oyunların 20 elini Excel uyumlu CSV olarak bilgisayarınıza veya telefonunuza indirebilirsiniz.
* **🖨️ Yazdır / PDF:** Resmi King çetelesi formatında tek tıkla A4 çıktısı veya PDF alabilirsiniz.
