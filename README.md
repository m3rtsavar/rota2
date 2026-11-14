# Rota

YKS öğrencileri ve koçları için çalışma planı, deneme takibi ve görev paylaşımı arayüzü.

## Özellikler

- E-posta ile öğrenci veya koç hesabı oluşturma ve giriş
- Otomatik oluşturulan koç koduyla öğrenci-koç bağlantısı
- Koç panelinde bağlı öğrencilerin profil ve deneme sonuçları
- Öğrenciye görev ve ders programı atama
- Öğrencinin deneme neti eklemesi ve görevleri takip etmesi
- Supabase RLS ile kullanıcı ve koç-öğrenci erişim sınırları

## Yerel çalıştırma

Proje statik HTML/CSS/JavaScript kullanır. E-posta yönlendirmeleri `file://` ile çalışmadığından yerel HTTP sunucusu kullan:

```powershell
python dev-server.py
```

Ardından `http://127.0.0.1:5500` adresini aç.

## iOS ve ana ekran kurulumu

Site HTTPS üzerinden yayınlandığında PWA olarak kurulabilir. iPhone veya iPad'de Safari'de siteyi aç, **Paylaş > Ana Ekrana Ekle** adımlarını izle. Android ve destekleyen masaüstü tarayıcılarda karşılama sayfasındaki **Ana ekrana ekle** düğmesini kullan.

Uygulama kabuğu Service Worker ile önbelleğe alınır; giriş ve Supabase verileri çevrimdışı kullanılmaz. `file://` adresinde veya HTTPS olmayan bir ağ adresinde PWA kurulumu kullanılamaz. Yayın adresini Supabase **Authentication > URL Configuration** bölümünde Site URL ve Redirect URLs listesine ekle.

## Supabase kurulumu

Kurulum, Auth URL yapılandırması ve veritabanı şemasını çalıştırma adımları [`supabase/README.md`](supabase/README.md) dosyasındadır. Önce [`supabase/schema.sql`](supabase/schema.sql) içeriğini Supabase SQL Editor'da çalıştır.

Uygulamadaki Supabase URL ve publishable key tarayıcı istemcisi için kullanılır. `service_role`, `sb_secret` veya SMTP kimlik bilgilerini istemciye ekleme.