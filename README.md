# 👑 King Puan ve Ceza Hesaplama Sistemi

Geleneksel Türk King (Rıfkı / Barbu) iskambil oyunu için profesyonel, modern, bağımsız skor ve çetele hesaplama uygulaması.

Tamamen **salt kendi başına (standalone)** çalışacak şekilde kurgulanmıştır; hiçbir harici framework, veritabanı veya paket bağımlılığı gerektirmez.

---

## 🚀 Hızlı Başlangıç

Bu projeyi 3 farklı şekilde kullanabilirsiniz:

### 1. En Basit Yol (Çift Tıklama)
Klasör içindeki **[`index.html`](file:///Users/selim/Documents/Codex/2026-09-27/chatgpt-ads-manager-plugin-ads-manager-4/outputs/Anki-Hocam-ChatGPT-Antigravity/anki-hocam/king-puan-ve-ceza-hesaplama/index.html)** dosyasına çift tıklayarak doğrudan herhangi bir tarayıcıda (Chrome, Safari, Edge) açabilirsiniz.

### 2. macOS Tek Tıkla Başlatıcı
**[`start.command`](file:///Users/selim/Documents/Codex/2026-09-27/chatgpt-ads-manager-plugin-ads-manager-4/outputs/Anki-Hocam-ChatGPT-Antigravity/anki-hocam/king-puan-ve-ceza-hesaplama/start.command)** dosyasına çift tıklayın. Otomatik olarak yerel sunucuyu başlatır ve tarayıcınızı açar.

### 3. Masadaki Telefon / Tablet ile Canlı Takip (Yerel Ağ)
Masadaki tüm oyuncuların (iPad, iPhone, Android) skoru canlı takip etmesi için terminalden:
```bash
python3 server.py
```
Komutu çalıştırın. Konsolda gösterilen yerel IP adresini (örneğin `http://192.168.1.x:8888`) masadaki arkadaşlarınızla paylaşın.

---

## 🃏 Oyun Kuralları ve Çetele Mantığı

King oyunu **4 kişiyle** oynanan bir koz ve ceza oyunudur. Toplam **20 el** sürer:

- Her oyuncu oyun boyunca **2 Koz** ve **3 Ceza** söylemek zorundadır.
- Toplam **8 Koz eli** ve **12 Ceza eli** oynanır.
- Her ceza türü tüm oyun boyunca **en fazla 2 kez** oynanabilir. Bir ceza 2 kez oynandıktan sonra kilitlenir.

### 📊 Ceza ve Koz Puan Tablosu

| Oyun Türü | Birim Puan | Toplam Adet | Toplam Puan | Açıklama |
| :--- | :---: | :---: | :---: | :--- |
| **👑 Koz** | `+50 P` | 13 El | **+650 P** | Alınan her el +50 puan kazandırır. (8 koz x 650 = +5200 P) |
| **✋ El Almaz** | `-50 P` | 13 El | **-650 P** | Alınan her el ceza yazılır. |
| **♥️ Kupa Almaz** | `-30 P` | 13 Kupa | **-390 P** | Alınan her kupa kağıdı ceza yazılır. |
| **👸 Kız Almaz** | `-100 P` | 4 Kız | **-400 P** | Dört Kız (Q) kartını alanlara ceza yazılır. |
| **🤴 Erkek Almaz** | `-60 P` | 8 Erkek | **-480 P** | Vale (J) ve Papaz (K) kartlarını alanlara ceza yazılır. |
| **🗡️ Rıfkı** | `-320 P` | 1 Kart | **-320 P** | Kupa Papazını alan oyuncu tek seferde -320 puan yer. |
| **⏳ Son İki** | `-180 P` | 2 El | **-360 P** | 12. ve 13. elleri alanlara her el için -180 puan ceza yazılır. |

> **Toplam Ceza Havuzu (1 Tur):** `-2600 P`  
> **Toplam Ceza Havuzu (2 Tur / 12 Ceza):** `-5200 P`  
> **Toplam Koz Havuzu (8 Koz):** `+5200 P`  
> **Sıfır Toplamlı Denge:** Koz (+5200) + Ceza (-5200) = **0 Puan!**

---

## ✨ Uygulama Özellikleri

1. **İnteraktif 20 El Çetele Matrisi:** Kim hangi oyunu oynamış, hangi hakları kalmış anlık gösterilir; tükenen haklar otomatik kilitlenir.
2. **Akıllı Dağılım ve Doğrulama:** Örneğin Kız Almaz'da toplam 4 kız, Kupa Almaz'da 13 kupa tam girilmeden el kaydedilemez; "Kalanı Ata" butonlarıyla tek tıkla tamamlanabilir.
3. **Puanlama Modelleri:**
   - **Standart Türk King**
   - **Sıfır Toplamlı King (Zero-Sum):** Oyun sonunda puanlar tam sıfırlanır.
   - **Kanlı King:** Cezayı söyleyen kendisi ceza yerse puanı iki katı yazılır.
4. **Geri Al (Undo):** Yanlış girilen son eli puanları ve hakları bozmadan anında geri alma.
5. **Kalıcı Bellek (Local Storage):** Sayfa yenilense veya tarayıcı kapansa bile oyun asla kaybolmaz.
6. **Yazdır / PDF ve Panoya Kopyalama:** Çeteleyi tek tıkla panoya veya kağıda dökebilme.
7. **Premium Tasarım:** Zümrüt yeşili, gece mavisi ve altın vurgularla şık iskambil kulübü teması.

---

## 🧪 Kural Motoru Testleri

Kural motorunun matematiksel doğruluğunu test etmek için:
```bash
python3 king_engine.py
```
çıktısı:
```
🧪 King Kural & Skor Motoru Testleri Çalıştırılıyor...
  ✓ 6 Ceza Oyununun Toplam Puanı Doğrulandı: -2600 P
  ✓ 12 Ceza Eli Toplam Ceza Havuzu: -5200 P
  ✓ 8 Koz Eli Toplam Kazanç Havuzu: +5200 P
  ✓ Sıfır Toplamlı Denge Doğrulandı: Koz (+5200) + Ceza (-5200) = 0 Puan
  ✓ Koz eli dağılım ve puanlama testi başarılı.
  ✓ Rıfkı ceza eli testi başarılı.

✅ TÜM TESTLER BAŞARIYLA TAMAMLANDI!
```
