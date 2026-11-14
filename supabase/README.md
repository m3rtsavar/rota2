# Supabase kurulumu

1. Supabase Dashboard'da **SQL Editor** aç, `schema.sql` dosyasının tamamını çalıştır. Yeni özellikler için dosyanın güncel halini yeniden çalıştır; tablolar, erişim kuralları ve özel `student-media` fotoğraf deposu burada kurulur.
2. Yerel deneme için **Authentication > URL Configuration** bölümünde Site URL değerini `http://127.0.0.1:5500` yap ve Redirect URLs listesine `http://127.0.0.1:5500/**` ekle. Yayında gerçek HTTPS alan adını Site URL olarak ayarla ve yalnızca gerekli yayın adresleri için Redirect URL ekle.
3. E-posta sağlayıcısını etkinleştir. E-posta doğrulaması açıksa kayıt sonrası gelen doğrulama bağlantısını kullan.
4. Projeyi yerelde `python dev-server.py` komutuyla çalıştır ve `http://127.0.0.1:5500` adresini aç. iOS ana ekran kurulumu için site HTTPS üzerinden yayınlanmalı; Safari'de Paylaş > Ana Ekrana Ekle adımlarını izle.

İstemci yalnızca publishable anahtarı kullanır. `service_role` veya secret anahtarını tarayıcıya ekleme. RLS ve tablo izinleri `schema.sql` içinde tanımlıdır; SQL dosyası Supabase'e uygulanmadan kayıt sonrası profil ve panel verileri çalışmaz.

Öğrenciler hata sorularını ve kitap kapaklarını en fazla 10 MB JPG, PNG veya WebP fotoğrafı olarak yükleyebilir. Dosyalar özel depoda tutulur; yalnızca öğrenci ve bağlı koçu imzalı bağlantıyla görüntüleyebilir. Deneme neti her ders için `doğru - yanlış / 4` formülüyle hesaplanır.

Koçun programa aynı gün birden fazla çalışma ekleyebilir ve öğrenci için her gün tekrarlanan alışkanlıklar tanımlayabilir. Öğrencinin her çalışma için girdiği doğru, yanlış ve boş sayıları `daily_task_results` tablosunda tarih ve ders bazında saklanır.