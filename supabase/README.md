# Supabase kurulumu

1. Supabase Dashboard'da **SQL Editor** aç, `schema.sql` dosyasının tamamını çalıştır.
2. **Authentication > URL Configuration** bölümünde Site URL değerini `http://127.0.0.1:5500` yap ve Redirect URLs listesine `http://127.0.0.1:5500/**` ekle.
3. E-posta sağlayıcısını etkinleştir. E-posta doğrulaması açıksa kayıt sonrası gelen doğrulama bağlantısını kullan.
4. Projeyi yerelde `python -m http.server 5500` komutuyla çalıştır ve `http://127.0.0.1:5500` adresini aç.

İstemci yalnızca publishable anahtarı kullanır. `service_role` veya secret anahtarını tarayıcıya ekleme. RLS ve tablo izinleri `schema.sql` içinde tanımlıdır; SQL dosyası Supabase'e uygulanmadan kayıt sonrası profil ve panel verileri çalışmaz.