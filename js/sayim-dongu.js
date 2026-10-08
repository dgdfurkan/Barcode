/**
 * Sayım > Döngü
 * ============================================================================
 *
 * Sabit alt kategorilerin düzenli sayımı. Her alt kategori için durum
 * (gecikti, hiç sayılmadı, sürüyor, güncel), son sayım ve son ürün çekimi
 * görünür; seçilen alt kategorinin ürünleri tek dokunuşla Getir'den çekilip
 * sayım tablosuna yazılır.
 *
 * GETİR İSTEĞİ
 * Franchise panelinin "Mevcut stok" sayfasının attığı istekle aynı:
 * POST /stocks { subCategory, warehouseIds, sort: { available: -1 } }, 100'lük
 * sayfalar, sayfalar arası 350 ms. Jeton ve depo kimliği sayım sayfasının
 * zaten kullandığı yerden (eklentinin yakaladığı, hesapta saklanan oturum).
 * Jeton yalnız franchise-api-gateway.getirapi.com adresine gider.
 *
 * YANLIŞ ÜRÜN SÜZGECİ
 * Getir bir ürünü birden çok alt kategoriye koyabiliyor; subCategory süzgeci
 * listesinde o kategori geçen her ürünü döndürüyor (ör. "Fonksiyonel
 * İçecekler"de protein tozu, meyve suyu). Yalnız ASIL alt kategorisi
 * (row.subCategory._id) istenen olanlar tabloya giriyor.
 *
 * KİMLİKLER
 * Başlangıç kimlikleri GETIR_KATEGORILER.md'den. Her Getir yanıtında
 * ürünlerin asıl alt kategori adı ve kimliği geliyor; bunlar öğrenilip
 * hesapta saklanıyor. Kimliği bilinmeyen alt kategoride, tablodaki
 * ürünlerden tek istekle öğreniliyor. İlk çekimde kimlik doğrulanıyor:
 * asıl kategorisi tutan ürün yoksa sıradaki aday deneniyor.
 *
 * SENKRON
 * Ürünler sayım tablosuna (counting_items) yazılıyor; cihazlar arası senkron
 * sayım sayfasının kendi mekanizmasıyla. Döngü bilgisi (son çekim, ayar,
 * öğrenilen kimlikler) ve katalog dışı ürünler satır bazlı iki tabloda
 * (sql_files/sayim_dongu.sql): iki cihaz aynı anda yazsa da birbirini ezmez.
 * ============================================================================
 */
(function () {
    'use strict';

    /* Alt kategori -> [ana kategori, kategori görseli, Getir kimlik adayları] */
    var TOHUM = {
        "Ağız Bakım": ["Kişisel Bakım", "ee4681a3-e16d-42b4-ab28-18b11acf026f.png", ["564c6741d35e7d0c002bd250"]],
        "Ağda & Tüy Dökücü": ["Kişisel Bakım", "1754c1c7-231d-44ea-8a88-8635d9b5ca20.png", ["56e012018d5ef80300398987"]],
        "Ayran & Kefir": ["Süt Ürünleri", "", []],
        "Baharat": ["Temel Gıda", "4249a5ac-eff6-44b4-b42c-47124daf09ed.png", ["564c682cd35e7d0c002bd2ed"]],
        "Bakliyat": ["Temel Gıda", "467b196e-204e-4d8b-93bf-c1633e16a3bc.png", ["5d10af9806d6060001b1130f", "564c684ed35e7d0c002bd486"]],
        "Bal & Reçel": ["Kahvaltılık", "e38d68cb-bfa3-4714-af89-d5b3a8d01ff4.png", ["61a78fdde819f56f98631c6b"]],
        "Balık & Deniz Ürünleri": ["Et, Tavuk & Balık", "6982bd3d-5ed7-45e2-aa9d-a39964556c3a.png", ["5f2da9e2e8f9986bc1c9acdf"]],
        "Bar": ["Atıştırmalık", "", []],
        "Bebek Bakım": ["Bebek", "052b47dc-0b03-4ec9-8efb-36bf19fe4c31.png", ["564c68b0d35e7d0c002bd4c2"]],
        "Bebek Bezi": ["Bebek", "09c114d2-687a-4ba1-8eda-390cf59c3514.png", ["56e01283dc83940300af3f92"]],
        "Beyaz Et": ["Et, Tavuk & Balık", "e8f52f2c-e4ca-4adc-9802-e655aa584972.png", ["5d0154bb0193bb0001b22c7e"]],
        "Beyaz Peynir": ["Kahvaltılık", "", []],
        "Biberon & Emzik": ["Bebek", "39fb29f1-84d6-43b7-b091-f41f766e1fc1.png", ["56f26ebee14e220300d790ff"]],
        "Bisküvi": ["Atıştırmalık", "57a2d074-f207-4a88-89c0-9fadd3b18b2b.png", ["6426d4fab65c317d59cc85dd"]],
        "Böcek İlacı": ["Ev Bakım", "f98c2935-3d2c-4278-b4a1-12f58c0cb51d.png", ["564c6926d35e7d0c002bd515"]],
        "Bulaşık": ["Ev Bakım", "d4094391-b304-44d5-a944-df7a24aae880.png", ["564c6976d35e7d0c002bd55b"]],
        "Bulgur": ["Temel Gıda", "da88e09d-0875-4ade-a5dd-797c10766449.png", ["5d3878d1a48d7500018965f3"]],
        "Buz": ["Su & İçecek", "c5f20d69-100f-4f0c-b74f-d17482158958.png", ["58f73f4323923b0004f895c6"]],
        "Çamaşır": ["Ev Bakım", "a6a20db4-f639-46a4-ad21-f6224b0726ec.png", ["564c6a2dd35e7d0c002bd6d6"]],
        "Çay": ["Su & İçecek", "aef8d3ad-e334-4ab4-9970-6df4926be2f6.png", ["564c6a95d35e7d0c002bd713", "63b6e58b587c865c1476a711"]],
        "Çiğ Köfte & Meze": ["Pratik Yemek", "", []],
        "Çikolata Bar": ["Atıştırmalık", "", []],
        "Çocuklara Özel": ["Atıştırmalık", "b1bb88d5-ad16-4259-bf41-0430febd6bf7.png", ["621794fdf7aeab6d20c2a9b4"]],
        "Çorba": ["Temel Gıda", "e4ef88cd-d161-4e7c-9e7d-9e1e4e6bb059.png", ["56dfd0c33ff0d80300e2e1bc"]],
        "Çubuk": ["Dondurma", "0dca4937-6068-422b-883d-6c078d015950.png", ["5fbcd17a9b964c3e063b192a"]],
        "Çoklu": ["Dondurma", "9c109b52-3e6c-43f8-aed5-7f5e1fcec2f4.png", ["5fbcd197a7a1a37f48a863c9"]],
        "Cips": ["Atıştırmalık", "b64e0f06-3336-4aa8-9dc8-20f2fb027f80.png", ["564c69e9d35e7d0c002bd6a8"]],
        "Deodorant": ["Kişisel Bakım", "", []],
        "Dergi": ["Ev & Yaşam", "4a7cdf80-6ab2-4082-8407-5296b39df36a.png", ["5b06b0d7d5bff90004618fcc"]],
        "Diğer": ["Ev & Yaşam", "012db945-1a65-45d9-9348-eaebe0528a53.png", ["5b06b381b883b700044e41fc"]],
        "Donuk Et & Tavuk & Balık": ["Dondurulmuş", "", []],
        "Donuk Hazır Yemek & Atıştırmalık": ["Dondurulmuş", "", []],
        "Donuk Meyve Sebze": ["Dondurulmuş", "", []],
        "Donuk Pasta & Tatlı": ["Dondurulmuş", "", []],
        "Donuk Unlu Mamüller": ["Dondurulmuş", "", []],
        "Duş & Banyo": ["Kişisel Bakım", "39db40b0-e06a-4e21-9be8-6f48620ca955.png", ["56e011278d5ef803003988f2"]],
        "Elektrik & Aydınlatma": ["Ev & Yaşam", "bc0a9a0f-6946-477f-a7c6-9a06ccfc5716.png", ["5b06b215b883b700044e405f"]],
        "Enerji İçeceği": ["Su & İçecek", "27899f32-dcf9-48e8-91af-76cb8be8e192.png", ["56e00f3e8d5ef803003987aa"]],
        "Fit & Form": ["Atıştırmalık", "", []],
        "Fonksiyonel İçecekler": ["Su & İçecek", "02778057-b791-42c7-b171-4e2a8f54d7ca.png", ["575ac54012f03a0300e8001d"]],
        "Gazlı İçecek": ["Su & İçecek", "a1a27397-5aa4-4613-ab58-7c4bdf9ca147.png", ["56e00e558d5ef8030039872a"]],
        "Genel Sağlık": ["Kişisel Bakım", "69a79fe4-a62d-46ca-a38d-56a6ff981ca1.png", ["5cfe796dbb6504000119d993"]],
        "Giyim": ["Ev & Yaşam", "f9137d29-32c0-4133-942c-4a9eb9eea34b.png", ["61a790876da4e657199d3860"]],
        "Glutensiz": ["Temel Gıda", "", []],
        "Gofret": ["Atıştırmalık", "96d1933d-0d4e-4390-b3b3-a6ee1054f700.png", ["584fa72fe55b6600045080ac"]],
        "Hazır Yemek": ["Pratik Yemek", "", []],
        "Helva": ["Kahvaltılık", "b1b514b0-7a23-4d6f-9f07-7cb3098b25ea.png", ["62c57f25511c0e9c8f5f82a1"]],
        "Hijyenik Ped": ["Kişisel Bakım", "34ce6193-8c55-4ed8-9899-013549b92577.png", ["56e012318d5ef80300398999"]],
        "Islak Havlu": ["Kişisel Bakım", "27b4835b-7117-4794-b272-22d7af07d14f.png", ["59f24af7beda820004122be0"]],
        "İthal Peynir": ["Kahvaltılık", "", []],
        "Jel": ["Cinsel Sağlık", "28ae84be-b4bb-4bf4-aba7-ae9d351ac160.png", ["56e014a8dc83940300af410f"]],
        "Kağıt Ürünleri": ["Ev Bakım", "5c70727e-359f-4c09-997d-4fedf326e2c1.png", ["564dbab45854f10c00a9edb6"]],
        "Kahvaltılık Gevrek": ["Kahvaltılık", "8cd5de88-5c07-41f5-a41b-a200f77a3a81.png", ["61a78f7edc4783102978fe68"]],
        "Kahve": ["Su & İçecek", "cdb22b53-9a53-4d3d-9148-d4a1be3fec80.png", ["564c7e7c27652f0c00745684"]],
        "Kaşar & Tost Peyniri": ["Kahvaltılık", "", []],
        "Kedi": ["Evcil Hayvan", "7e221eb5-5520-4df6-9872-5055fca04e63.png", ["56e0139fdc83940300af403b"]],
        "Kek": ["Atıştırmalık", "0ca031f0-ff74-4f4c-8dbe-fb6ef0693c10.png", ["6426d4bf1631f0ea0b9b48ba"]],
        "Kırmızı Et": ["Et, Tavuk & Balık", "af755763-84c8-4474-9290-fc5094b5cec4.png", ["5d01544e7730a800019b0c9a"]],
        "Kırtasiye": ["Ev & Yaşam", "91d428b6-0b70-4302-b344-4ec297b23b03.png", ["5b06b1f9b883b700044e4045"]],
        "Kolonya": ["Kişisel Bakım", "91ef4dfc-6ac7-4d14-80a5-d29bac43f298.png", ["564c7efb27652f0c007456db"]],
        "Konserve": ["Temel Gıda", "c634ff74-6375-4158-9eef-31f525857129.png", ["5ece83aff0027b247dc2730e"]],
        "Köpek": ["Evcil Hayvan", "2312057d-68d8-4ee5-856f-d12d2e146b6f.png", ["56e013ac8d5ef80300398a8b"]],
        "Kozmetik": ["Kişisel Bakım", "659f71c5-fa8b-449f-91ad-43943cb1072e.png", ["56e011b1dc83940300af3f0c"]],
        "Kraker & Kurabiye": ["Atıştırmalık", "f71363a7-07d5-45cf-bc52-0d6f71fd4844.png", ["574eaea86221370300370742"]],
        "Krema & Kaymak": ["Süt Ürünleri", "3258f63a-aa52-4334-bb09-5af12f29c568.png", ["627ce84c92619a6be4a7073b"]],
        "Kuruyemiş": ["Atıştırmalık", "2d2167c4-2448-4f2e-8796-464abf4fc482.png", ["564c7fc227652f0c007457c8", "5a14937ca92d200004823245"]],
        "Kutu": ["Dondurma", "c888584c-0a19-43c1-8c6f-30d393b856b4.png", ["5fbcd1beb1b8a2c673204b1f"]],
        "Külah": ["Dondurma", "457f90c7-5766-4282-a2d4-bc4a1133ec67.png", ["5fbcd101fb62ea2a262a0820"]],
        "Maden Suyu": ["Su & İçecek", "d3fd5165-9660-414b-baf0-d3ca62aa6f6a.png", ["58f73b400d69080004368c94"]],
        "Makarna": ["Temel Gıda", "55910f14-5a03-4278-bd27-d95884394c48.png", ["56def24e1cda0403006f9e0e"]],
        "Mama": ["Bebek", "3b01e315-d359-427b-bfb0-34c1e01ed57e.png", ["56e0131fdc83940300af3fea"]],
        "Margarin": ["Temel Gıda", "", ["68b58355664bfa99c43dc759"]],
        "Meyve": ["Meyve & Sebze", "df632af4-d454-450a-aca0-3ecb881ea51a.png", ["59281340616cab00041ec874"]],
        "Meyve Suyu": ["Su & İçecek", "e7ad412a-cc94-43fa-b837-10dd636ccc97.png", ["564c826c27652f0c007459c5"]],
        "Mutfak": ["Ev Bakım", "221cba23-07dc-485b-bdbe-366659ef3339.png", ["564c829b27652f0c007459f9"]],
        "Mutfak Ürünleri": ["Ev & Yaşam", "34c049d7-1a01-4494-9785-4a6994a7e121.png", ["5b06b1dcd5bff900046190de"]],
        "Oda Kokusu": ["Ev Bakım", "1bc4f329-3d76-42b3-952a-c50555ea5101.png", ["56e010208d5ef8030039885c"]],
        "Oyun & Oyuncak": ["Ev & Yaşam", "efeea9d0-a1c7-4fbf-9414-2bcc12b2f70b.png", ["5c13b092196519001262c746"]],
        "Paketli Ekmek": ["Fırından", "41204132-44d3-460b-8464-33c5c9829aac.png", ["61f2a4f53a73f5944e1df234"]],
        "Parti Malzemeleri": ["Ev & Yaşam", "", []],
        "Pasta Malzemeleri": ["Temel Gıda", "7c842941-3343-457f-a7ea-097f2e1ae8cd.png", ["5af1c60886fbaa0004941493"]],
        "Pastörize Süt": ["Süt Ürünleri", "", []],
        "Patlamış Mısır ve Tahıl Patlağı": ["Atıştırmalık", "", []],
        "Paylaşımlık & Draje": ["Atıştırmalık", "b33932fe-bd01-45c4-a1e6-4629aa4b11f0.png", ["621794fb903d64bc5dc9bde0"]],
        "Piknik": ["Ev & Yaşam", "", []],
        "Pil": ["Ev & Yaşam", "23b1da69-b156-4663-a256-3cbdd4287805.png", ["5b3a36770f14560004553753"]],
        "Pirinç": ["Temel Gıda", "8fdc8e6e-d27c-4a1d-8df1-637bf2d39d10.png", ["5d375f1adee74e00018b0c51"]],
        "Prezervatif": ["Cinsel Sağlık", "ee824409-619f-4d3a-8820-6e276a91dc08.png", ["56e014918d5ef80300398b52"]],
        "Sabun": ["Kişisel Bakım", "7dc36878-8c1b-413e-b724-9a0abebf8b7b.png", ["5e3abc1be27a3c242b4de946", "564c851227652f0c00745cba"]],
        "Saç Bakım": ["Kişisel Bakım", "dd1456c2-7d2f-48b3-8360-2c648b1ece17.png", ["5a5e9f47c3949e0004b31823"]],
        "Saç Boyası": ["Kişisel Bakım", "4978dc65-5295-4467-9495-c6ee509fd54a.png", ["5900b2609d21350004cf0fc0"]],
        "Sakız & Şekerleme": ["Atıştırmalık", "54034009-6e9c-42d6-b3dd-93333f85b02e.png", ["56dfecc9cf3fd40300ebcd7e"]],
        "Salça": ["Temel Gıda", "f47383be-44a7-451a-8e0d-580dc2b26173.png", ["627ce88a6e8a96a6dc734824"]],
        "Sandviç": ["Pratik Yemek", "ffa9cadd-0168-4b6f-89fa-9c1302b7b931.png", ["564c8cd127652f0c007465e4"]],
        "Sebze": ["Meyve & Sebze", "77020b86-6f0b-4779-b966-c63f37837f60.png", ["5928134e37e22d0004ead488"]],
        "Seyahat Ürünleri": ["Kişisel Bakım", "3c804c8e-53cf-4e1c-bf2d-ed7761f8d636.png", ["648c11472f9c11f965b3d809"]],
        "Sıvı Yağ": ["Temel Gıda", "0af85bc5-477a-4351-9936-dae6c3493786.png", ["56dfd0e3a32e31030065ca49"]],
        "Sirke & Salata Sosu": ["Temel Gıda", "3e6a16b4-0ae2-43e3-9021-777158a8cc13.png", ["5916d507ad08080004ed3f5a"]],
        "Sos": ["Temel Gıda", "1040f793-ba33-4f47-8cc6-5d21e672e613.png", ["627ce8a4f8c4431590ba0dd0"]],
        "Soğuk Çay": ["Su & İçecek", "fb58716a-e8d5-438d-9c1b-43204532a7cf.png", ["56e00efa8d5ef8030039878f"]],
        "Soğuk Kahve": ["Su & İçecek", "ae983d33-0605-4777-be29-39e2e61bca80.png", ["56e00ee8dc83940300af3cd4"]],
        "Su": ["Su & İçecek", "3bdfc97d-2bca-4ea3-af55-6c09a194c744.png", ["5ee3941d8a1a17d10d681221"]],
        "Süt & Salep": ["Su & İçecek", "b6c375d2-9016-4e9c-9d9b-d0f9843dd26b.png", ["5a149307afa7ea00042f4509"]],
        "Sütlü Tatlı": ["Süt Ürünleri", "7a8229b1-7c78-4cb1-bfb8-61597537ebd1.png", ["63aee166a58b8fc2b6ad4287"]],
        "Sürülebilir": ["Atıştırmalık", "a068d566-8ff7-4a0c-b166-ca333afba773.png", ["5c0a20fb2927f0001848ca34", "61a78fad45075ce2c77d7c74"]],
        "Sürülebilir Peynir": ["Kahvaltılık", "", []],
        "Şarj Aleti & Kablo": ["Ev & Yaşam", "", []],
        "Şarküteri": ["Et, Tavuk & Balık", "2f5ff7e2-9ed2-4be5-a3a6-20bbedc578c2.png", ["61a13ff5d3373238a36705b8", "61a78f1ef4a8b07dce7f44d7", "5a14a9dcb06405000474b85b"]],
        "Şeker": ["Temel Gıda", "efa1d34c-855c-4e91-907a-a257cc6e10a9.png", ["564c873027652f0c00746026"]],
        "Tahin & Pekmez": ["Kahvaltılık", "", []],
        "Tablet Çikolata": ["Atıştırmalık", "", []],
        "Tatlı": ["Temel Gıda", "89748070-9675-419e-a895-6048ff19a9c5.png", ["5b44ab1e07b83e0004edda6d", "63189b76dc0108d24879fe72"]],
        "Taze Fırın": ["Fırından", "8b45b741-25b9-41f0-bdc8-23f2c319b6b6.png", ["5ac4906d2e46870004b465de"]],
        "Taze Yemek": ["Pratik Yemek", "6af56d09-6ac6-4d4d-b726-7f201250e117.png", ["586504cbc68e1b0004d56e19"]],
        "Teknoloji": ["Ev & Yaşam", "", []],
        "Temizlik": ["Ev Bakım", "1afe92e2-4e01-489a-8ade-70d51dcd8ac5.png", ["564c881027652f0c007460f0"]],
        "Tereyağı": ["Süt Ürünleri", "666e2c7a-3d39-47bd-84b9-c107c438b91a.png", ["5cfe769abb6504000119cf99"]],
        "Ton Balığı": ["Temel Gıda", "", ["667e67f9e231aa758aed7b21"]],
        "Tıraş Malzemeleri": ["Kişisel Bakım", "507a5ec4-4621-466d-9b0c-e35a0a9a7d60.png", ["56e01108dc83940300af3ebd"]],
        "Turşu": ["Temel Gıda", "", []],
        "Un": ["Temel Gıda", "28fb2294-1ca3-44a2-9f6b-5f3de8e4fa65.png", ["5e3a6ae86e48c150cfdab57c"]],
        "Unlu Mamüller": ["Fırından", "6dfb423e-8057-4f27-b509-f43ceb32c82c.png", ["566edfa4f9facb0f00b1c4a1"]],
        "Uzun Ömürlü Süt": ["Süt Ürünleri", "c6dee689-3468-454a-b673-04e5e7e13915.png", ["5cfe6d7abb6504000119a6d7"]],
        "Vegan": ["Temel Gıda", "", []],
        "Vücut & El Bakım": ["Kişisel Bakım", "0f20bac1-c135-49ef-910c-dfdd3e7b4774.png", ["56e0115adc83940300af3ee0"]],
        "Yeşillik": ["Meyve & Sebze", "a2224cf3-10df-440a-af75-ca4bc8f5f81e.png", ["61f29217eef40a3410623674"]],
        "Yoğurt": ["Süt Ürünleri", "a25d46ad-d704-41cf-b0ab-cadda8227052.png", ["5cfe7456bb6504000119c32a"]],
        "Yöresel Peynir": ["Kahvaltılık", "", []],
        "Yumurta": ["Kahvaltılık", "7324f7b2-e390-42d2-9b32-573d40b8ff9e.png", ["61a78ee679ef65dd6ce4030f"]],
        "Zeytin": ["Kahvaltılık", "74959542-7dd7-4842-bc58-25565416a565.png", ["61a78f521a62a72a7a8e0b46"]],
        "Zeytinyağı": ["Temel Gıda", "85f140ff-efb6-4d1e-bedb-d7f9dbbf8871.png", ["622780f07fb9dcefa125f0c7"]],
    };

    var GORSEL_KOKU = 'https://cdn-image.getir.com/market/category/';
    var STOK_UCU = 'https://franchise-api-gateway.getirapi.com/stocks';
    var SAYFA = 100;
    var AZAMI_SAYFA = 15;
    var SAYFA_ARASI_MS = 350;
    var SURELER = [7, 14, 21, 30, 45, 60, 90];
    var GUN = 864e5;
    var OTURUM_ANAHTARI = 'jb_dongu_secili';
    var MOD_ANAHTARI = 'jb_dongu_modu';

    var DURUM = {
        gecikti: { ad: 'Gecikti', renk: 'kirmizi', sira: 0 },
        yok: { ad: 'Hiç sayılmadı', renk: 'gri', sira: 1 },
        yaklasiyor: { ad: 'Yaklaşıyor', renk: 'sari', sira: 2 },
        bekliyor: { ad: 'Sayıma hazır', renk: 'mavi', sira: 3 },
        suruyor: { ad: 'Sürüyor', renk: 'mavi', sira: 4 },
        guncel: { ad: 'Güncel', renk: 'yesil', sira: 5 },
    };
    var FILTRELER = [
        ['tumu', 'Tümü', null],
        ['gecikti', 'Gecikmiş', ['gecikti']],
        ['yok', 'Hiç sayılmadı', ['yok']],
        ['suruyor', 'Sürüyor', ['suruyor', 'bekliyor']],
        ['guncel', 'Güncel', ['guncel', 'yaklasiyor']],
    ];

    var HATA = {
        oturum_yok: 'Getir oturumu bulunamadı. Bilgisayarda franchise-v2.getir.com/inventory-management/current sayfasını açıp yenileyin; eklenti oturumu yakalar ve telefona da geçer.',
        oturum_bitti: 'Getir oturumunun süresi dolmuş. Bilgisayarda Getir franchise sayfasını yenileyin, sonra tekrar deneyin.',
        depo_yok: 'Depo bilgisi bulunamadı. Getir franchise sayfasını açıp yenileyin.',
        kimlik_yok: 'Bu alt kategorinin Getir kimliği henüz bilinmiyor. Tabloya bu kategoriden birkaç ürün ekleyin ya da başka bir alt kategoriyi çekin; kimlik Getir yanıtlarından öğrenilir.',
        bos: 'Getir bu alt kategoride depoda ürün döndürmedi.',
        getir: 'Getir isteği başarısız oldu. Biraz sonra tekrar deneyin.',
        ag: 'Getir\'e ulaşılamadı. İnternet bağlantınızı kontrol edin.',
        iptal: 'Ürün çekme durduruldu.',
        mesgul: 'Sayım tablosu şu an başka bir işlem yapıyor. Birkaç saniye sonra deneyin.',
    };

    var d = {
        bagli: false,
        yuklendi: false,
        yukleniyor: null,
        dbYok: false,
        kayitlar: new Map(), // alt kategori adı -> { getir_id, cekildi_at, urun_sayisi }
        ayar: { sure: 30, ogrenilen: {} },
        mod: false,
        secili: null,
        filtre: 'tumu',
        arama: '',
        cekim: null, // { ad, asama, sayfa, toplamSayfa, taranan, uygun, elenen, iptal }
        sonuc: null, // { ad, metin, tur }
        ilkCizim: true,
    };
    var panel = null;
    var sureMenusu = null;

    // ------------------------------------------------------------------
    // Yardımcılar
    // ------------------------------------------------------------------
    function cs() { return window.countingSystem || null; }

    function kacir(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function norm(ad) {
        return String(ad || '').toLocaleLowerCase('tr').replace(/\s*&\s*/g, ' & ').replace(/\s+/g, ' ').trim();
    }

    function kullanici() {
        var s = cs();
        if (s && s.currentUser && s.currentUser.username) return s.currentUser.username;
        try { return (window.authUtils && window.authUtils.checkAuth() || {}).username || null; } catch (e) { return null; }
    }

    function bekle(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    function hata(kod, ek) {
        var e = new Error(HATA[kod] || kod);
        e.kod = kod;
        e.ek = ek;
        return e;
    }

    function gorselAdresi(ad) {
        var t = TOHUM[ad];
        return t && t[1] ? GORSEL_KOKU + t[1] + '?format=webp&width=96&height=96' : '';
    }

    function gunMetni(ms) {
        if (!ms) return '';
        var gun = Math.floor((Date.now() - ms) / GUN);
        if (gun <= 0) return 'bugün';
        if (gun === 1) return 'dün';
        return gun + ' gün önce';
    }

    function azaltilmisHareket() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function bildir(metin, tur) {
        if (window.JBDiyalog && window.JBDiyalog.bildir) window.JBDiyalog.bildir(metin, tur || 'bilgi', 4500);
        else if (cs() && cs().showToast) cs().showToast(metin, tur === 'basari' ? 'success' : tur === 'hata' ? 'error' : 'info');
    }

    // ------------------------------------------------------------------
    // Veritabanı (satır bazlı, RLS ile yalnız kendi satırları)
    // ------------------------------------------------------------------
    function tabloEksikMi(err) {
        return !!err && (err.code === '42P01' || err.code === 'PGRST205' || /does not exist|could not find the table/i.test(err.message || ''));
    }

    function dbYukle(zorla) {
        if (d.yukleniyor) return d.yukleniyor;
        if (d.yuklendi && !zorla) return Promise.resolve();
        var db = window.jbDb;
        var u = kullanici();
        if (!db || !u) { d.yuklendi = true; return Promise.resolve(); }
        d.yukleniyor = Promise.all([
            db.from('sayim_dongu').select('anahtar, getir_id, cekildi_at, urun_sayisi, ayar').eq('username', u),
            db.from('sayim_harici_urunler').select('product_id, ad, gorsel, barkodlar, kategori').eq('username', u),
        ]).then(function (sonuc) {
            var a = sonuc[0];
            var b = sonuc[1];
            if (a.error) {
                d.dbYok = tabloEksikMi(a.error);
            } else {
                d.dbYok = false;
                var yeni = new Map();
                (a.data || []).forEach(function (r) {
                    if (r.anahtar === '_ayar') {
                        var ay = r.ayar || {};
                        if (SURELER.indexOf(Number(ay.sure)) >= 0) d.ayar.sure = Number(ay.sure);
                        if (ay.ogrenilen && typeof ay.ogrenilen === 'object') d.ayar.ogrenilen = Object.assign({}, ay.ogrenilen, d.ayar.ogrenilen);
                        return;
                    }
                    yeni.set(r.anahtar, { getir_id: r.getir_id || null, cekildi_at: r.cekildi_at || null, urun_sayisi: r.urun_sayisi });
                });
                d.kayitlar = yeni;
            }
            if (!b.error && Array.isArray(b.data) && b.data.length && cs() && cs().registerExternalProducts) {
                // Katalog yüklenmeden eklenirse loadProducts dizini baştan kurup siler
                return katalogHazir().then(function () {
                var eklenen = cs().registerExternalProducts(b.data.map(function (r) {
                    return {
                        id: r.product_id,
                        name: r.ad,
                        image: r.gorsel || '',
                        barcodes: (Array.isArray(r.barkodlar) ? r.barkodlar : []).map(function (c) { return { code: String(c) }; }),
                        category: r.kategori || '',
                    };
                }));
                if (eklenen && cs().renderTable) cs().renderTable();
                });
            }
        }).then(function () {
            d.yuklendi = true;
        }).catch(function () {
            d.yuklendi = true;
        }).finally(function () {
            d.yukleniyor = null;
            ciz();
        });
        return d.yukleniyor;
    }

    function katalogHazir() {
        return new Promise(function (coz) {
            var n = 0;
            (function bak() {
                var s = cs();
                if ((s && s.productIndex && s.productIndex.size > 0) || ++n > 120) return coz();
                setTimeout(bak, 250);
            })();
        });
    }

    async function kayitYaz(ad, alanlar) {
        var eski = d.kayitlar.get(ad) || {};
        d.kayitlar.set(ad, Object.assign({}, eski, alanlar));
        if (d.dbYok || !window.jbDb) return;
        var satir = Object.assign({ username: kullanici(), anahtar: ad, guncellendi_at: new Date().toISOString() }, alanlar);
        var r = await window.jbDb.from('sayim_dongu').upsert(satir, { onConflict: 'username,anahtar' });
        if (r.error && tabloEksikMi(r.error)) d.dbYok = true;
    }

    var ayarZaman = null;
    function ayarYaz() {
        clearTimeout(ayarZaman);
        ayarZaman = setTimeout(function () {
            if (d.dbYok || !window.jbDb) return;
            // Öğrenilen eşleşme sınırsız büyümesin
            var og = d.ayar.ogrenilen;
            var anahtarlar = Object.keys(og);
            if (anahtarlar.length > 800) anahtarlar.slice(0, anahtarlar.length - 800).forEach(function (k) { delete og[k]; });
            window.jbDb.from('sayim_dongu').upsert({
                username: kullanici(), anahtar: '_ayar', ayar: { sure: d.ayar.sure, ogrenilen: og }, guncellendi_at: new Date().toISOString(),
            }, { onConflict: 'username,anahtar' });
        }, 600);
    }

    async function hariciYaz(urunler) {
        if (d.dbYok || !window.jbDb || !urunler.length) return;
        var u = kullanici();
        var satirlar = urunler.filter(function (p) { return /^[0-9a-f]{24}$/.test(p.id); }).map(function (p) {
            return {
                username: u,
                product_id: p.id,
                ad: String(p.name || 'Adsız ürün').slice(0, 200),
                gorsel: p.image && /^https:\/\//.test(p.image) ? p.image.slice(0, 400) : null,
                barkodlar: (p.barcodes || []).map(function (b) { return String(b.code).slice(0, 40); }).slice(0, 20),
                kategori: p.category ? String(p.category).slice(0, 120) : null,
                guncellendi_at: new Date().toISOString(),
            };
        });
        for (var i = 0; i < satirlar.length; i += 50) {
            await window.jbDb.from('sayim_harici_urunler').upsert(satirlar.slice(i, i + 50), { onConflict: 'username,product_id' });
        }
    }

    // ------------------------------------------------------------------
    // Durum hesabı (sayım verisinden; ağ yok)
    // ------------------------------------------------------------------
    function tabloVerisi(ad) {
        var s = cs();
        if (!s) return null;
        if (ad === s.currentTableName && s.countingData) return s.countingData;
        return s.cachedFullData && s.cachedFullData._tables ? s.cachedFullData._tables[ad] || null : null;
    }

    function tabloVarMi(ad) {
        var s = cs();
        return !!(s && s.cachedFullData && s.cachedFullData._tables && s.cachedFullData._tables[ad] && !(s._isTableTombstoned && s._isTableTombstoned(ad)));
    }

    function istatistik(ad) {
        var s = cs();
        var t = tabloVerisi(ad);
        if (!t || !tabloVarMi(ad)) return { var: false, toplam: 0, sayilan: 0, sonSayim: 0 };
        var toplam = 0;
        var sayilan = 0;
        var son = 0;
        Object.keys(t).forEach(function (k) {
            if (s.isReservedCountingKey && s.isReservedCountingKey(k)) return;
            var e = t[k];
            if (!e || typeof e !== 'object') return;
            toplam++;
            if (e.warehouseStock !== null && e.warehouseStock !== undefined) {
                sayilan++;
                var ms = Date.parse(e.warehouseStockAt || e.lastUpdated || '') || 0;
                if (ms > son) son = ms;
            }
        });
        if (!toplam) {
            // Ürünler henüz yüklenmediyse sıra bilgisinden tahmin
            var sira = (t._productOrder && t._productOrder.length) || 0;
            return { var: sira > 0, toplam: sira, sayilan: 0, sonSayim: 0, yukleniyor: sira > 0 };
        }
        return { var: true, toplam: toplam, sayilan: sayilan, sonSayim: son };
    }

    function durumHesapla(ad) {
        var st = istatistik(ad);
        var k = d.kayitlar.get(ad) || {};
        var sureMs = d.ayar.sure * GUN;
        var simdi = Date.now();
        var cekildi = Date.parse(k.cekildi_at || '') || 0;
        var oran = st.toplam ? st.sayilan / st.toplam : 0;
        var kod;
        var ref = st.sonSayim || 0;
        if (!st.var) kod = 'yok';
        else if (!st.sayilan) kod = cekildi && simdi - cekildi > sureMs ? 'gecikti' : cekildi ? 'bekliyor' : 'yok';
        else if (simdi - ref > sureMs) kod = 'gecikti';
        else if (oran < 0.95) kod = 'suruyor';
        else if (simdi - ref > sureMs * 0.8) kod = 'yaklasiyor';
        else kod = 'guncel';
        var tabanMs = ref || cekildi;
        return {
            ad: ad,
            kod: kod,
            st: st,
            oran: oran,
            cekildi: cekildi,
            gecikmeGun: tabanMs ? Math.floor((simdi - tabanMs - sureMs) / GUN) : 0,
            kalanGun: tabanMs ? Math.ceil((tabanMs + sureMs - simdi) / GUN) : 0,
        };
    }

    function durumAlt(du) {
        var st = du.st;
        switch (du.kod) {
            case 'yok': return st.var ? st.toplam + ' ürün · sayım yok' : 'Ürünler çekilmedi';
            case 'bekliyor': return st.toplam + ' ürün · ' + gunMetni(du.cekildi) + ' çekildi';
            case 'suruyor': return st.sayilan + ' / ' + st.toplam + ' sayıldı';
            case 'gecikti': return du.gecikmeGun > 0 ? du.gecikmeGun + ' gün gecikti' : 'Süresi doldu';
            case 'yaklasiyor': return du.kalanGun + ' gün kaldı';
            default: return gunMetni(du.st.sonSayim) + ' sayıldı';
        }
    }

    function hepsi() {
        return Object.keys(TOHUM).map(durumHesapla);
    }

    // ------------------------------------------------------------------
    // Getir oturumu
    // ------------------------------------------------------------------
    async function apiBilgisi() {
        var s = cs();
        var info = null;
        try { info = s && s._resolveApiInfoForDebug ? await s._resolveApiInfoForDebug() : null; } catch (e) { info = null; }
        if (!info || !info.token) throw hata('oturum_yok');
        var bitis = s.getEffectiveExpiryMs ? s.getEffectiveExpiryMs(info) : null;
        if (bitis && Date.now() >= bitis - 60000) throw hata('oturum_bitti');
        if (!info.warehouseId || !/^[0-9a-f]{24}$/.test(String(info.warehouseId))) throw hata('depo_yok');
        var jeton = String(info.token).trim();
        if (!/^Bearer /.test(jeton)) jeton = 'Bearer ' + jeton;
        // Jeton yalnız Getir'in stok ucuna gider; kayıtlı başka bir adres kullanılmaz
        var uc = /^https:\/\/franchise-api-gateway\.getirapi\.com\/stocks$/.test(String(info.stockEndpoint || '')) ? info.stockEndpoint : STOK_UCU;
        return { jeton: jeton, depo: String(info.warehouseId), uc: uc, bitis: bitis };
    }

    function oturumMetni() {
        var s = cs();
        var info = (s && s.cachedFullData && s.cachedFullData._api_info && s.cachedFullData._api_info.token && s.cachedFullData._api_info) ||
            (s && s.countingData && s.countingData._api_info) || null;
        if (!info || !info.token) {
            try { var ham = JSON.parse(localStorage.getItem('getir_api_info') || 'null'); if (ham && ham.token) info = ham; } catch (e) { /* yok */ }
        }
        if (!info || !info.token) return { metin: 'Getir oturumu yok', renk: 'kirmizi' };
        var bitis = s.getEffectiveExpiryMs ? s.getEffectiveExpiryMs(info) : null;
        if (!bitis) return { metin: 'Getir oturumu var', renk: 'yesil' };
        var kalan = bitis - Date.now();
        if (kalan <= 60000) return { metin: 'Getir oturumu doldu', renk: 'kirmizi' };
        var sa = Math.floor(kalan / 3600000);
        var dk = Math.floor((kalan % 3600000) / 60000);
        return { metin: 'Getir oturumu ' + (sa ? sa + ' sa ' : '') + dk + ' dk', renk: kalan < 3600000 ? 'sari' : 'yesil' };
    }

    async function stokIstegi(api, govde, offset, sinyal) {
        var r;
        try {
            r = await fetch(api.uc + '?limit=' + SAYFA + '&offset=' + offset, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: api.jeton, Accept: 'application/json' },
                body: JSON.stringify(govde),
                signal: sinyal,
            });
        } catch (e) {
            if (e && e.name === 'AbortError') throw hata('iptal');
            throw hata('ag');
        }
        if (r.status === 401 || r.status === 403) throw hata('oturum_bitti');
        if (!r.ok) throw hata('getir', r.status);
        var j = await r.json().catch(function () { return null; });
        if (!j || !Array.isArray(j.data)) throw hata('getir');
        return { data: j.data, toplam: Number(j.total) || 0 };
    }

    function asilAltKategori(row) {
        var sc = row && row.subCategory;
        if (!sc) return { id: null, ad: '' };
        if (typeof sc === 'string') return { id: sc, ad: '' };
        var ad = sc.name ? (sc.name.tr || sc.name.en || '') : '';
        return { id: sc._id || sc.id || null, ad: ad };
    }

    /** Yanıttaki ürünlerin asıl alt kategorilerinden ad -> kimlik öğren */
    function ogren(satirlar) {
        var degisti = false;
        satirlar.forEach(function (row) {
            var a = asilAltKategori(row);
            if (!a.id || !a.ad || !/^[0-9a-f]{24}$/.test(a.id)) return;
            var n = norm(a.ad);
            if (d.ayar.ogrenilen[n] !== a.id) { d.ayar.ogrenilen[n] = a.id; degisti = true; }
        });
        if (degisti) ayarYaz();
    }

    /** Denenecek kimlikler: kayıtlı (doğrulanmış) > öğrenilen > belgedeki adaylar */
    function adaylar(ad) {
        var liste = [];
        var ekle = function (id) { if (id && /^[0-9a-f]{24}$/.test(id) && liste.indexOf(id) < 0) liste.push(id); };
        var k = d.kayitlar.get(ad);
        if (k) ekle(k.getir_id);
        ekle(d.ayar.ogrenilen[norm(ad)]);
        (TOHUM[ad] ? TOHUM[ad][2] : []).forEach(ekle);
        return liste;
    }

    /** Kimliği bilinmeyen kategoride: tablodaki ürünlerin asıl kategorisinden (tek istek) */
    async function tablodanOgren(ad, api, sinyal) {
        var t = tabloVerisi(ad);
        var s = cs();
        if (!t) return null;
        var ids = Object.keys(t).filter(function (k) {
            return !(s.isReservedCountingKey && s.isReservedCountingKey(k)) && /^[0-9a-f]{24}$/.test(k);
        }).slice(0, 30);
        if (!ids.length) return null;
        var sonuc = await stokIstegi(api, { warehouseIds: [api.depo], productIds: ids, sort: { available: -1 } }, 0, sinyal);
        ogren(sonuc.data);
        var say = {};
        sonuc.data.forEach(function (row) { var a = asilAltKategori(row); if (a.id) say[a.id] = (say[a.id] || 0) + 1; });
        var enIyi = null;
        Object.keys(say).forEach(function (id) { if (!enIyi || say[id] > say[enIyi]) enIyi = id; });
        return enIyi;
    }

    function hariciUrun(row) {
        var ad = (row.fullName && (row.fullName.tr || row.fullName.en)) || (row.shortName && row.shortName.tr) || (row.name && row.name.tr) || 'Adsız ürün';
        var gorsel = (row.picURL && row.picURL.tr) || (row.picURLs && row.picURLs.tr && row.picURLs.tr[0]) || (row.squareThumbnailURL && row.squareThumbnailURL.tr) || '';
        var barkodlar = [];
        var pi = row.packagingInfo || {};
        ['1', '2', '3', '4'].forEach(function (k) {
            (pi[k] && Array.isArray(pi[k].barcodes) ? pi[k].barcodes : []).forEach(function (b) {
                var c = String(b).trim();
                if (c && barkodlar.indexOf(c) < 0) barkodlar.push(c);
            });
        });
        return {
            id: String(row.id || row._id || row.product),
            name: String(ad).replace(/\s+/g, ' ').trim().slice(0, 200),
            image: /^https:\/\//.test(gorsel) ? gorsel : '',
            barcodes: barkodlar.map(function (c) { return { code: c }; }),
            category: row.category && row.category.name ? row.category.name.tr || '' : '',
        };
    }

    // ------------------------------------------------------------------
    // Ürünleri çek
    // ------------------------------------------------------------------
    async function urunleriCek(ad) {
        var s = cs();
        if (!s || d.cekim) return;
        var st = istatistik(ad);
        if (st.var && st.sayilan > 0) {
            var onay = window.JBDiyalog && window.JBDiyalog.onay
                ? await window.JBDiyalog.onay(
                    ad + ' tablosunda ' + st.sayilan + ' ürün sayılmış. Güncel ürünler çekilince tablo yenilenir: depo ve sistem stokları sıfırlanır, listede olmayan ürünler çıkar.',
                    { baslik: 'Tablo sıfırlansın mı?', tehlikeli: true, onayYazi: 'Sıfırla ve çek', vazgecYazi: 'Vazgeç' })
                : window.confirm('Tablo sıfırlanıp güncel ürünler çekilsin mi?');
            if (!onay) return;
        }
        var iptal = new AbortController();
        d.cekim = { ad: ad, asama: 'Getir oturumu kontrol ediliyor', sayfa: 0, toplamSayfa: 0, taranan: 0, uygun: 0, elenen: 0, iptal: iptal };
        d.sonuc = null;
        ciz();
        try {
            var api = await apiBilgisi();
            var liste = adaylar(ad);
            if (!liste.length) {
                d.cekim.asama = 'Alt kategori kimliği öğreniliyor';
                cekimCiz();
                var og = await tablodanOgren(ad, api, iptal.signal);
                if (og) liste.push(og);
            }
            if (!liste.length) throw hata('kimlik_yok');

            var bulunan = null;
            var kullanilan = null;
            var elenen = 0;
            for (var i = 0; i < liste.length && !bulunan; i++) {
                var altId = liste[i];
                var uygun = [];
                var gorulen = new Set();
                elenen = 0;
                var offset = 0;
                for (var sayfa = 1; sayfa <= AZAMI_SAYFA; sayfa++) {
                    d.cekim.asama = 'Getir\'den ürünler alınıyor';
                    d.cekim.sayfa = sayfa;
                    cekimCiz();
                    var cevap = await stokIstegi(api, { subCategory: altId, warehouseIds: [api.depo], sort: { available: -1 } }, offset, iptal.signal);
                    d.cekim.toplamSayfa = Math.max(1, Math.min(AZAMI_SAYFA, Math.ceil(cevap.toplam / SAYFA)));
                    ogren(cevap.data);
                    cevap.data.forEach(function (row) {
                        var id = String(row.id || row._id || row.product || '');
                        if (!id || gorulen.has(id)) return;
                        gorulen.add(id);
                        d.cekim.taranan++;
                        if (asilAltKategori(row).id === altId) uygun.push(row);
                        else elenen++;
                    });
                    d.cekim.uygun = uygun.length;
                    d.cekim.elenen = elenen;
                    cekimCiz();
                    offset += SAYFA;
                    if (cevap.data.length < SAYFA || offset >= cevap.toplam) break;
                    await bekle(SAYFA_ARASI_MS);
                }
                if (uygun.length) { bulunan = uygun; kullanilan = altId; }
            }
            if (!bulunan) throw hata(d.cekim.taranan ? 'kimlik_yok' : 'bos');

            // Katalogda olmayanları tanıt ve hesaba kaydet
            var yeniHarici = [];
            var items = bulunan.map(function (row) {
                var id = String(row.id || row._id || row.product);
                var p = s.productIndex.get(id);
                if (!p) { p = hariciUrun(row); yeniHarici.push(p); }
                return { product: p, row: row };
            });
            if (yeniHarici.length) {
                s.registerExternalProducts(yeniHarici);
                hariciYaz(yeniHarici).catch(function () {});
            }

            d.cekim.asama = 'Tabloya yazılıyor';
            cekimCiz();
            if (s._importInProgress) throw hata('mesgul');
            if (!tabloVarMi(ad)) await s.createTable(ad, { skipRender: true });
            else if (s.currentTableName !== ad) await s.switchTable(ad, { skipCatchUp: true, skipRender: true });
            await s.applyDonguProducts(items, { tablo: ad, kaynak: 'Getir' });

            await kayitYaz(ad, { getir_id: kullanilan, cekildi_at: new Date().toISOString(), urun_sayisi: items.length });
            var parca = [items.length + ' ürün tabloya yazıldı'];
            if (elenen) parca.push(elenen + ' başka kategorinin ürünü elendi');
            if (yeniHarici.length) parca.push(yeniHarici.length + ' ürün katalogda yoktu, eklendi');
            d.sonuc = { ad: ad, metin: parca.join(' · '), tur: 'basari' };
            bildir(ad + ': ' + parca[0] + '.', 'basari');
        } catch (e) {
            var metin = e && e.kod ? e.message : (e && e.message) || HATA.getir;
            d.sonuc = { ad: ad, metin: metin, tur: e && e.kod === 'iptal' ? 'bilgi' : 'hata' };
            if (!(e && e.kod === 'iptal')) bildir(metin, 'hata');
        } finally {
            d.cekim = null;
            ciz();
        }
    }

    // ------------------------------------------------------------------
    // Mod (Döngü sekmesi)
    // ------------------------------------------------------------------
    function sekmeleriBoya() {
        var dugme = document.getElementById('tabDongu');
        var sayim = document.getElementById('tabSayim');
        if (dugme) dugme.classList.toggle('active', d.mod);
        if (sayim && d.mod) sayim.classList.remove('active');
        if (dugme) dugme.setAttribute('aria-selected', d.mod ? 'true' : 'false');
    }

    function modAc() {
        var s = cs();
        if (!s) return;
        if (s.currentTab !== 'sayim') s.switchTab('sayim');
        d.mod = true;
        try { localStorage.setItem(MOD_ANAHTARI, '1'); } catch (e) { /* yok */ }
        document.documentElement.classList.add('sd-modu');
        sekmeleriBoya();
        if (!d.secili) {
            var son = null;
            try { son = sessionStorage.getItem(OTURUM_ANAHTARI); } catch (e) { /* yok */ }
            if (son && TOHUM[son] && tabloVarMi(son)) d.secili = son;
        }
        d.ilkCizim = true;
        if (d.secili) sec(d.secili, { kaydirma: false });
        ciz();
        dbYukle(false);
    }

    function modKapat() {
        if (!d.mod) return;
        d.mod = false;
        try { localStorage.setItem(MOD_ANAHTARI, '0'); } catch (e) { /* yok */ }
        document.documentElement.classList.remove('sd-modu', 'sd-secim');
        sekmeleriBoya();
    }

    function sec(ad, secenek) {
        var s = cs();
        d.secili = ad;
        d.sonuc = d.sonuc && d.sonuc.ad === ad ? d.sonuc : null;
        try { sessionStorage.setItem(OTURUM_ANAHTARI, ad); } catch (e) { /* yok */ }
        document.documentElement.classList.add('sd-secim');
        document.documentElement.classList.toggle('sd-tablosuz', !tabloVarMi(ad));
        if (tabloVarMi(ad) && s && s.currentTableName !== ad && !s._importInProgress) {
            s.switchTable(ad).catch(function () {});
        }
        ciz();
        if (!secenek || secenek.kaydirma !== false) {
            var ust = panel && panel.getBoundingClientRect().top + window.scrollY - 12;
            if (ust != null && window.scrollY > ust) window.scrollTo({ top: ust, behavior: azaltilmisHareket() ? 'auto' : 'smooth' });
        }
    }

    function listeyeDon() {
        d.secili = null;
        try { sessionStorage.removeItem(OTURUM_ANAHTARI); } catch (e) { /* yok */ }
        document.documentElement.classList.remove('sd-secim', 'sd-tablosuz');
        d.ilkCizim = true;
        ciz();
    }

    // ------------------------------------------------------------------
    // Çizim
    // ------------------------------------------------------------------
    var SVG = {
        geri: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>',
        ara: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
        indir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
        yenile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
        saat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
        kutu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/></svg>',
        asagi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    };

    function panelKur() {
        if (panel) return true;
        var kap = document.getElementById('sayimTabContent');
        if (!kap) return false;
        panel = document.createElement('section');
        panel.id = 'sayimDonguPanel';
        panel.className = 'sd-panel';
        panel.setAttribute('aria-label', 'Sayım döngüsü');
        kap.insertBefore(panel, kap.firstChild);

        panel.addEventListener('click', function (e) {
            var h = e.target.closest('[data-sd]');
            if (!h) return;
            var ne = h.getAttribute('data-sd');
            if (ne === 'kart') sec(h.getAttribute('data-ad'));
            else if (ne === 'geri') listeyeDon();
            else if (ne === 'filtre') { d.filtre = h.getAttribute('data-deger'); ciz(); }
            else if (ne === 'cek') urunleriCek(d.secili);
            else if (ne === 'iptal') { if (d.cekim) d.cekim.iptal.abort(); }
            else if (ne === 'sure') sureMenusuAc(h);
            else if (ne === 'listeye') {
                var hedef = document.getElementById('countingTableContainer');
                if (hedef) hedef.scrollIntoView({ behavior: azaltilmisHareket() ? 'auto' : 'smooth', block: 'start' });
            }
        });
        panel.addEventListener('input', function (e) {
            if (e.target && e.target.matches('[data-sd="ara"]')) {
                d.arama = e.target.value;
                listeCiz();
            }
        });
        return true;
    }

    function halka(oran, boy) {
        var r = (boy - 10) / 2;
        var c = 2 * Math.PI * r;
        var dolu = Math.max(0, Math.min(1, oran)) * c;
        return '<svg class="sd-halka" width="' + boy + '" height="' + boy + '" viewBox="0 0 ' + boy + ' ' + boy + '" aria-hidden="true">' +
            '<circle cx="' + boy / 2 + '" cy="' + boy / 2 + '" r="' + r + '" class="sd-halka__iz"/>' +
            '<circle cx="' + boy / 2 + '" cy="' + boy / 2 + '" r="' + r + '" class="sd-halka__dolu" stroke-dasharray="' + dolu.toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 ' + boy / 2 + ' ' + boy / 2 + ')"/></svg>';
    }

    function ciz() {
        if (!d.mod || !panelKur()) return;
        document.documentElement.classList.toggle('sd-secim', !!d.secili);
        if (d.secili) document.documentElement.classList.toggle('sd-tablosuz', !tabloVarMi(d.secili));
        else document.documentElement.classList.remove('sd-tablosuz');
        // Yalnız değiştiyse yaz: sayım girildikçe panel titremesin, görseller yeniden yüklenmesin
        var html = d.secili ? detayHtml(d.secili) : genelHtml();
        var anahtar = (d.secili ? 'd:' : 'g:') + html;
        if (panel.__son !== anahtar) {
            var odak = document.activeElement && panel.contains(document.activeElement) ? document.activeElement.getAttribute('data-sd') : null;
            panel.innerHTML = html;
            panel.__son = anahtar;
            panel.__liste = '';
            if (odak === 'ara') { var g = panel.querySelector('[data-sd="ara"]'); if (g) { g.focus(); g.setSelectionRange(g.value.length, g.value.length); } }
        }
        if (!d.secili) listeCiz();
        if (d.ilkCizim && !azaltilmisHareket()) {
            panel.classList.remove('sd-giris');
            void panel.offsetWidth;
            panel.classList.add('sd-giris');
        }
        d.ilkCizim = false;
    }

    function genelHtml() {
        var liste = hepsi();
        var say = {};
        liste.forEach(function (x) { say[x.kod] = (say[x.kod] || 0) + 1; });
        var guncel = (say.guncel || 0) + (say.yaklasiyor || 0);
        var toplam = liste.length;
        var oran = toplam ? guncel / toplam : 0;
        var ot = oturumMetni();
        var dagilim = ['guncel', 'yaklasiyor', 'suruyor', 'bekliyor', 'gecikti', 'yok'].map(function (k) {
            var n = say[k] || 0;
            return n ? '<span class="sd-dagilim__p sd-r--' + DURUM[k].renk + (k === 'yaklasiyor' ? '-acik' : k === 'bekliyor' ? '-acik' : '') + '" style="flex-grow:' + n + '" title="' + kacir(DURUM[k].ad + ': ' + n) + '"></span>' : '';
        }).join('');
        return '' +
            '<header class="sd-ust">' +
            '<div class="sd-ust__metin">' +
            '<p class="sd-etiket">Sayım Döngüsü</p>' +
            '<h2 class="sd-baslik"><span class="sd-sayi">' + guncel + '</span> / ' + toplam + ' alt kategori güncel</h2>' +
            '<p class="sd-alt">Her alt kategori <button type="button" class="sd-sure" data-sd="sure" aria-haspopup="true">' + d.ayar.sure + ' günde' + SVG.asagi + '</button> bir sayılır' +
            '<span class="sd-oturum sd-oturum--' + ot.renk + '"><span class="sd-nokta"></span>' + kacir(ot.metin) + '</span></p>' +
            '</div>' +
            '<div class="sd-ust__halka">' + halka(oran, 72) + '<span class="sd-ust__yuzde">%' + Math.round(oran * 100) + '</span></div>' +
            '</header>' +
            '<div class="sd-dagilim" aria-hidden="true">' + dagilim + '</div>' +
            (d.dbYok ? '<p class="sd-uyari">Döngü kaydı için veritabanı güncellemesi bekleniyor; ürün çekme çalışır, son çekim zamanı bu cihazda tutulur.</p>' : '') +
            '<div class="sd-arac">' +
            '<div class="sd-filtreler" role="tablist" aria-label="Duruma göre süz">' +
            FILTRELER.map(function (f) {
                var n = f[2] ? f[2].reduce(function (t, k) { return t + (say[k] || 0); }, 0) : toplam;
                return '<button type="button" role="tab" class="sd-filtre" aria-selected="' + (d.filtre === f[0]) + '" data-sd="filtre" data-deger="' + f[0] + '">' +
                    kacir(f[1]) + '<span class="sd-filtre__sayi">' + n + '</span></button>';
            }).join('') +
            '</div>' +
            '<label class="sd-ara">' + SVG.ara + '<input type="search" data-sd="ara" placeholder="Alt kategori ara" autocomplete="off" value="' + kacir(d.arama) + '" aria-label="Alt kategori ara"></label>' +
            '</div>' +
            '<div class="sd-liste" data-sd-liste role="list"></div>';
    }

    function listeCiz() {
        var yer = panel && panel.querySelector('[data-sd-liste]');
        if (!yer) return;
        var filtre = FILTRELER.find(function (f) { return f[0] === d.filtre; });
        var q = norm(d.arama);
        var liste = hepsi().filter(function (x) {
            if (filtre && filtre[2] && filtre[2].indexOf(x.kod) < 0) return false;
            return !q || norm(x.ad).indexOf(q) >= 0;
        });
        liste.sort(function (a, b) {
            if (DURUM[a.kod].sira !== DURUM[b.kod].sira) return DURUM[a.kod].sira - DURUM[b.kod].sira;
            if (a.kod === 'gecikti' && a.gecikmeGun !== b.gecikmeGun) return b.gecikmeGun - a.gecikmeGun;
            return a.ad.localeCompare(b.ad, 'tr');
        });
        var html;
        if (!liste.length) {
            html = '<div class="sd-bos">' + (q ? 'Aramaya uyan alt kategori yok.' : 'Bu durumda alt kategori yok.') + '</div>';
        } else html = liste.map(function (x, i) {
            var g = gorselAdresi(x.ad);
            var r = DURUM[x.kod].renk;
            return '<button type="button" class="sd-kart" role="listitem" data-sd="kart" data-ad="' + kacir(x.ad) + '" style="--sd-i:' + Math.min(i, 24) + '">' +
                '<span class="sd-kart__gorsel">' + (g ? '<img src="' + kacir(g) + '" alt="" loading="lazy" decoding="async">' : SVG.kutu) + '</span>' +
                '<span class="sd-kart__metin"><strong>' + kacir(x.ad) + '</strong>' +
                '<span class="sd-kart__alt"><span class="sd-nokta sd-r--' + r + '"></span>' + kacir(durumAlt(x)) + '</span></span>' +
                '<span class="sd-kart__cubuk" aria-hidden="true"><span class="sd-r--' + r + '" style="transform:scaleX(' + (x.st.var ? x.oran.toFixed(3) : 0) + ')"></span></span>' +
                '<span class="sr-only">' + kacir(DURUM[x.kod].ad) + '</span>' +
                '</button>';
        }).join('');
        if (panel.__liste !== html) { yer.innerHTML = html; panel.__liste = html; }
    }

    function detayHtml(ad) {
        var x = durumHesapla(ad);
        var t = TOHUM[ad] || ['', '', []];
        var g = gorselAdresi(ad);
        var r = DURUM[x.kod].renk;
        var st = x.st;
        var cekiliyor = d.cekim && d.cekim.ad === ad;
        var ilk = !st.var;
        var dugme = cekiliyor
            ? '<button type="button" class="sd-dugme sd-dugme--ikincil" data-sd="iptal">Durdur</button>'
            : '<button type="button" class="sd-dugme sd-dugme--ana" data-sd="cek"' + (d.cekim ? ' disabled' : '') + '>' +
              (ilk ? SVG.indir + '<span>Ürünleri çek</span>' : SVG.yenile + '<span>Güncel ürünleri çek</span>') + '</button>';
        var hucre = function (etiket, deger) { return '<div class="sd-hucre"><span>' + etiket + '</span><strong>' + deger + '</strong></div>'; };
        return '' +
            '<div class="sd-detay">' +
            '<div class="sd-detay__ust">' +
            '<button type="button" class="sd-geri" data-sd="geri" aria-label="Alt kategori listesine dön">' + SVG.geri + '<span>Döngü</span></button>' +
            '<span class="sd-rozet sd-rozet--' + r + '">' + kacir(DURUM[x.kod].ad) + '</span>' +
            '</div>' +
            '<div class="sd-detay__kimlik">' +
            '<span class="sd-detay__gorsel">' + (g ? '<img src="' + kacir(g) + '" alt="">' : SVG.kutu) + '</span>' +
            '<div><p class="sd-etiket">' + kacir(t[0] || 'Alt kategori') + '</p><h2 class="sd-detay__ad">' + kacir(ad) + '</h2>' +
            '<p class="sd-alt">' + kacir(durumAlt(x)) + '</p></div>' +
            '</div>' +
            '<div class="sd-hucreler">' +
            hucre('Ürün', st.var ? st.toplam : '-') +
            hucre('Sayılan', st.var ? st.sayilan + (st.toplam ? ' <em>%' + Math.round(x.oran * 100) + '</em>' : '') : '-') +
            hucre('Son çekim', x.cekildi ? kacir(gunMetni(x.cekildi)) : '-') +
            hucre('Son sayım', st.sonSayim ? kacir(gunMetni(st.sonSayim)) : '-') +
            '</div>' +
            '<div class="sd-ilerleme" aria-hidden="true"><span class="sd-r--' + r + '" style="transform:scaleX(' + (st.var ? x.oran.toFixed(3) : 0) + ')"></span></div>' +
            '<div class="sd-cekim" data-sd-cekim>' + cekimHtml(ad) + '</div>' +
            '<div class="sd-eylem">' + dugme +
            (st.var && !cekiliyor ? '<button type="button" class="sd-dugme sd-dugme--metin" data-sd="listeye">Ürünlere git' + SVG.asagi + '</button>' : '') +
            '</div>' +
            '</div>';
    }

    function cekimHtml(ad) {
        var c = d.cekim && d.cekim.ad === ad ? d.cekim : null;
        if (c) {
            var oran = c.toplamSayfa ? Math.min(1, c.sayfa / c.toplamSayfa) : 0.08;
            if (c.asama === 'Tabloya yazılıyor') oran = 1;
            return '<div class="sd-cekim__kutu" role="status" aria-live="polite">' +
                '<p class="sd-cekim__asama"><span class="sd-cark" aria-hidden="true"></span>' + kacir(c.asama) +
                (c.toplamSayfa > 1 && c.asama !== 'Tabloya yazılıyor' ? ' · sayfa ' + c.sayfa + ' / ' + c.toplamSayfa : '') + '</p>' +
                '<div class="sd-cekim__cubuk"><span style="transform:scaleX(' + oran.toFixed(3) + ')"></span></div>' +
                '<p class="sd-cekim__sayilar"><span><strong>' + c.taranan + '</strong> tarandı</span><span><strong>' + c.uygun + '</strong> uygun</span><span><strong>' + c.elenen + '</strong> elendi</span></p>' +
                '</div>';
        }
        if (d.sonuc && d.sonuc.ad === ad) {
            return '<p class="sd-sonuc sd-sonuc--' + d.sonuc.tur + '">' + kacir(d.sonuc.metin) + '</p>';
        }
        var x = durumHesapla(ad);
        if (!x.st.var) {
            return '<p class="sd-ipucu">Ürünler Getir\'deki mevcut stoktan, stoğu çoktan aza sıralı gelir. Başka kategoriye ait ürünler otomatik elenir.</p>';
        }
        return '<p class="sd-ipucu">Güncel ürünleri çekmek tabloyu yeniler: depo ve sistem stokları sıfırlanır, Getir\'de artık olmayan ürünler çıkar.</p>';
    }

    /** Çekim sürerken yalnız ilerleme kutusunu güncelle (tüm paneli değil) */
    function cekimCiz() {
        if (!panel || !d.mod) return;
        var yer = panel.querySelector('[data-sd-cekim]');
        if (yer && d.cekim && d.secili === d.cekim.ad) yer.innerHTML = cekimHtml(d.cekim.ad);
    }

    function sureMenusuAc(acan) {
        if (sureMenusu) { sureMenusu.remove(); sureMenusu = null; return; }
        sureMenusu = document.createElement('div');
        sureMenusu.className = 'sd-menu';
        sureMenusu.setAttribute('role', 'menu');
        sureMenusu.innerHTML = '<p class="sd-menu__baslik">Sayım sıklığı</p>' + SURELER.map(function (g) {
            return '<button type="button" role="menuitemradio" aria-checked="' + (g === d.ayar.sure) + '" data-gun="' + g + '">' + g + ' günde bir</button>';
        }).join('');
        document.body.appendChild(sureMenusu);
        var r = acan.getBoundingClientRect();
        var sol = Math.min(window.innerWidth - 188, Math.max(8, r.left));
        sureMenusu.style.top = (r.bottom + window.scrollY + 6) + 'px';
        sureMenusu.style.left = sol + 'px';
        var kapat = function (e) {
            if (e && sureMenusu && sureMenusu.contains(e.target) && !e.target.closest('[data-gun]')) return;
            if (e && e.target === acan) return;
            document.removeEventListener('pointerdown', kapat, true);
            document.removeEventListener('keydown', esc, true);
            if (sureMenusu) { sureMenusu.remove(); sureMenusu = null; }
        };
        var esc = function (e) { if (e.key === 'Escape') { e.stopPropagation(); kapat(); acan.focus(); } };
        sureMenusu.addEventListener('click', function (e) {
            var b = e.target.closest('[data-gun]');
            if (!b) return;
            d.ayar.sure = Number(b.getAttribute('data-gun'));
            ayarYaz();
            kapat();
            ciz();
        });
        setTimeout(function () {
            document.addEventListener('pointerdown', kapat, true);
            document.addEventListener('keydown', esc, true);
            var secili = sureMenusu && sureMenusu.querySelector('[aria-checked="true"]');
            if (secili) secili.focus();
        }, 0);
    }

    // ------------------------------------------------------------------
    // Sayım sistemine bağlanma
    // ------------------------------------------------------------------
    var cizZaman = null;
    function gecikmeliCiz() {
        if (!d.mod) return;
        clearTimeout(cizZaman);
        cizZaman = setTimeout(function () {
            // Çekim sürerken ya da kullanıcı arama kutusundayken paneli baştan çizme
            if (d.cekim) return cekimCiz();
            ciz();
        }, 250);
    }

    function bagla() {
        var s = cs();
        if (!s || d.bagli) return !!s;
        d.bagli = true;
        var asilGorunum = s.updateTabDisplay;
        if (typeof asilGorunum === 'function') {
            s.updateTabDisplay = function () {
                var sonuc = asilGorunum.apply(this, arguments);
                if (this.currentTab !== 'sayim' && d.mod) modKapat();
                sekmeleriBoya();
                return sonuc;
            };
        }
        // Sayım tablosu değiştikçe (sayım girildi, başka cihazdan geldi) durumlar tazelensin
        ['renderTable', 'updateTableSelector'].forEach(function (ad) {
            var asil = s[ad];
            if (typeof asil !== 'function') return;
            s[ad] = function () {
                var sonuc = asil.apply(this, arguments);
                try { gecikmeliCiz(); } catch (e) { /* panel yan iş, sayımı bozmasın */ }
                return sonuc;
            };
        });

        var dugme = document.getElementById('tabDongu');
        if (dugme) dugme.addEventListener('click', function () { if (!d.mod) modAc(); });
        ['tabSayim', 'tabFinans', 'tabStokfark'].forEach(function (id) {
            var b = document.getElementById(id);
            if (b) b.addEventListener('click', modKapat, true);
        });
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible' && d.mod) dbYukle(true);
        });

        var acikti = false;
        try { acikti = localStorage.getItem(MOD_ANAHTARI) === '1' && (localStorage.getItem('counting_active_tab') || 'sayim') === 'sayim'; } catch (e) { /* yok */ }
        if (acikti) modAc();
        // Katalog dışı ürünler mod açılmasa da listede görünsün
        dbYukle(false);
        return true;
    }

    function basla() {
        if (!document.getElementById('tabDongu')) return;
        if (bagla()) return;
        var deneme = 0;
        var z = setInterval(function () {
            if (bagla() || ++deneme > 40) clearInterval(z);
        }, 250);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
    else basla();

    window.JBSayimDongu = { ac: modAc, kapat: modKapat, cek: urunleriCek };
})();
