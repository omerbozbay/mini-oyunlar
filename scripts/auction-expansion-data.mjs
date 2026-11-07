// Adlar oyun kartlarında, görsel tarifleri üretim atlasının hücre sıralamasında kullanılır.
const rows = (names, subjects) =>
  names.split("|").map((name, i) => [name, subjects.split("|")[i]]);
export const additions = [
  {
    id: "heroes",
    title: "Süper Kahraman Takımını Kur",
    subtitle: "Gücün kadar takım uyumuna da güven.",
    color: "#dce8f4",
    style:
      "cinematic photorealistic superhero character collectible portraits, no actors, no lettering",
    items: rows(
      "Deadpool|Hulk|Thor|Örümcek Adam|Iron Man|Kaptan Amerika|Batman|Superman|Wonder Woman|Wolverine|Doctor Strange|Black Panther|Flash|Aquaman|Captain Marvel|Scarlet Witch|Ant-Man|Hawkeye|Black Widow|Green Lantern",
      "Deadpool red black mask|Hulk green muscular giant|Thor with hammer and red cape|Spider-Man red blue webbed mask|Iron Man red gold armor|Captain America with circular shield|Batman black cowl|Superman blue suit red cape|Wonder Woman armor tiara|Wolverine yellow black suit claws|Doctor Strange red cloak|Black Panther sleek black suit|Flash red suit lightning|Aquaman golden armor trident|Captain Marvel blue red gold suit|Scarlet Witch red crown|Ant-Man silver red helmet|Hawkeye purple costume bow|Black Widow black suit red hair|Green Lantern glowing green ring",
    ),
  },
  {
    id: "meals",
    title: "En İyi Yemek Menüsünü Kur",
    subtitle: "Sokak lezzetlerinden sofranın yıldızlarına.",
    color: "#f4e1cf",
    style:
      "photorealistic appetizing Turkish food photography on ceramic plates",
    items: rows(
      "Lahmacun|Makarna|Pizza|İskender|Çiğ köfte|Kokoreç|Kavurma|Mantı|Kuru fasulye|Adana kebap|Döner|İçli köfte|Hünkar beğendi|Karnıyarık|Yaprak sarma|Pide|Balık ekmek|Tavuk pilav|İmam bayıldı|Mercimek çorbası",
      "Turkish lahmacun|spaghetti pasta with tomato sauce|baked margherita pizza|Iskender doner kebab yogurt tomato butter|cig kofte bulgur balls lettuce lemon|Turkish kokorec sandwich|Turkish beef kavurma|Turkish manti yogurt dumplings|white bean tomato stew|Adana kebab skewers|doner kebab wrap|fried icli kofte|hunkar begendi beef on eggplant puree|karniyarik stuffed eggplants|rolled grape leaves|Turkish cheese pide|grilled fish sandwich|chicken rice pilaf|imam bayildi stuffed eggplant|orange lentil soup",
    ),
  },
  {
    id: "teatime",
    title: "En Güzel Gün Tabağını Hazırla",
    subtitle: "Bir tabakta tatlı, tuzlu ve bol muhabbet.",
    color: "#eee0ed",
    style: "photorealistic Turkish afternoon tea foods on small elegant plates",
    items: rows(
      "Kısır|Islak kek|Patates salatası|Yaprak sarması|Börek|Poğaça|İçli köfte|Kıbrıs tatlısı|Mercimek köftesi|Rus salatası|Makarna salatası|Havuç tarator|Acılı ezme|Mini sandviç|Elmalı kurabiye|Tuzlu kurabiye|Açma|Trileçe|Mozaik pasta|Çay",
      "Turkish kisir bulgur salad|chocolate wet cake square|potato salad|rolled grape leaves|Turkish borek pastry|pogaca buns|icli kofte|Cypriot coconut cream cake|red lentil kofte|Russian potato pea salad|pasta salad|carrot yogurt tarator|spicy tomato ezme|mini tea sandwiches|apple filled crescent cookies|savory cookies|Turkish acma bagel|trilece caramel milk cake|chocolate biscuit mosaic cake|Turkish tea in tulip glass",
    ),
  },
  {
    id: "series",
    title: "En İyi Diziler Listesini Kur",
    subtitle: "Unutulmaz hikâyelere kendi sıralamanı ver.",
    color: "#e1dcf1",
    style:
      "cinematic photorealistic scene stills inspired by Turkish TV genres, no real actors, no posters or lettering, symbolic settings only",
    items: rows(
      "Aşk-ı Memnu|Muhteşem Yüzyıl|Ezel|Kurtlar Vadisi|Yaprak Dökümü|Medcezir|Sihirli Annem|Doktorlar|Avrupa Yakası|Leyla ile Mecnun|Behzat Ç.|Çukur|İçerde|Şahsiyet|Bir Başkadır|Masum|İkinci Bahar|Ekmek Teknesi|Yargı|Gibi",
      "luxury Bosphorus mansion forbidden romance|Ottoman palace crown and royal throne|Istanbul noir revenge chessboard|Istanbul dark crime city skyline|old Turkish family wooden mansion autumn leaves|young seaside romance sailboat|magical Turkish family home glowing wand|bright modern hospital stethoscope|Istanbul Nisantasi comedy fashion office|Istanbul seaside surreal romance empty bench|Ankara rain detective desk|Istanbul old neighborhood alley graffiti|undercover police city night|old typewriter and clock psychological mystery|Istanbul crowded commuter ferry|quiet rural lakeside house mystery|traditional Turkish kebab restaurant|warm neighborhood bakery|Turkish courthouse justice scales|two friends tea glasses absurd comedy living room",
    ),
  },
  {
    id: "survival",
    title: "Hayatta Kalma Çantanı Hazırla",
    subtitle: "Doğada doğru ekipman hayat kurtarır.",
    color: "#dde8d4",
    style: "photorealistic outdoor survival equipment product photographs",
    items: rows(
      "Balta|Çadır|Bıçak|Kibrit|Pusula|Damacana su|Balıkçılık seti|Uyku tulumu|Fener|İlk yardım çantası|İp|Su filtresi|Kamp ocağı|Tencere|Yağmurluk|Termal battaniye|Düdük|Harita|Çok amaçlı çakı|Telsiz",
      "camping axe|green camping tent|camping knife|wooden matchbox matches|brass compass|large blue water jug|fishing rod and tackle kit|sleeping bag|camping lantern|red first aid bag|coiled rope|portable water filter|camping stove|camping cooking pot|yellow rain poncho|silver thermal blanket|emergency whistle|folded topographic map|multitool pocket knife|walkie talkie",
    ),
  },
  {
    id: "commanders",
    title: "Tarihi Komutanlar Kadrosunu Kur",
    subtitle: "Farklı çağlardan bir strateji masası.",
    color: "#e8dfcf",
    style:
      "near-photorealistic historically inspired museum portrait paintings, respectful neutral depictions, no text or medals with writing, not archival photographs",
    items: rows(
      "Yavuz Sultan Selim|Kanuni Sultan Süleyman|Mustafa Kemal Atatürk|Timurlenk|Fatih Sultan Mehmet|Attila|Mete Han|Alp Arslan|Yıldırım Bayezid|Büyük İskender|Cengiz Han|Napolyon Bonapart|Jül Sezar|Selahaddin Eyyubi|Halid bin Velid|Hannibal|Subutay|İsmet İnönü|Kazım Karabekir|Tomris Hatun",
      "Ottoman Sultan Selim I white turban moustache|Suleiman the Magnificent large white turban|Mustafa Kemal Ataturk dignified dark suit portrait|Timur Central Asian ruler|Mehmed the Conqueror Ottoman turban aquiline profile|Attila Hun ruler|Modu Chanyu steppe ruler|Alp Arslan Seljuk sultan|Bayezid I Ottoman ruler|Alexander the Great Macedonian armor|Genghis Khan Mongolian ruler|Napoleon Bonaparte bicorne coat|Julius Caesar Roman laurel|Saladin medieval ruler|Khalid ibn al Walid early Arabian commander|Hannibal Carthaginian general|Subutai Mongol general|Ismet Inonu Turkish statesman|Kazim Karabekir Turkish general|Tomyris Central Asian queen",
    ),
  },
  {
    id: "countries",
    title: "Ülkeler Koleksiyonunu Kur",
    subtitle: "Dünyanın farklı köşelerini bir araya getir.",
    color: "#dbe9ee",
    style:
      "photorealistic travel photography of iconic real landmarks, no flags or text",
    items: rows(
      "ABD|Çin|Türkiye|Japonya|İtalya|Fransa|Almanya|Birleşik Krallık|İspanya|Brezilya|Kanada|Avustralya|Mısır|Yunanistan|Güney Kore|Hindistan|Meksika|Norveç|İsviçre|Güney Afrika",
      "Statue of Liberty New York|Great Wall of China|Istanbul Bosphorus and Hagia Sophia|Mount Fuji and red pagoda Japan|Colosseum Rome Italy|Eiffel Tower Paris France|Brandenburg Gate Berlin Germany|Big Ben London Britain|Sagrada Familia Barcelona Spain|Christ the Redeemer Rio Brazil|Canadian Rockies turquoise lake|Sydney Opera House Australia|Giza pyramids Egypt|Acropolis Athens Greece|Gyeongbokgung palace Seoul Korea|Taj Mahal India|Chichen Itza pyramid Mexico|Norwegian fjord|Swiss Alps Matterhorn|Table Mountain Cape Town South Africa",
    ),
  },
  {
    id: "powers",
    title: "Süper Güçlerini Seç",
    subtitle: "Hayalindeki yetenekler için teklif ver.",
    color: "#e8ddf4",
    style:
      "near-photorealistic cinematic visual effects concept photography, clearly fictional superpowers, no text",
    items: rows(
      "Görünmezlik|Işınlanma|Uçmak|Zamanı durdurmak|Zihin okumak|Telekinezi|Süper hız|Süper güç|Şekil değiştirmek|İyileştirme|Ateşi kontrol etmek|Suyu kontrol etmek|Buzu kontrol etmek|Elektriği kontrol etmek|Yer çekimini kontrol etmek|Hayvanlarla konuşmak|Geleceği görmek|Işık hızında düşünmek|Boyut kapısı açmak|Kopyalanmak",
      "partly invisible person transparent silhouette|person teleporting through blue energy|person flying above clouds|frozen floating clock and suspended water droplets|glowing minds connected by energy|floating rocks above outstretched hand|speed runner colorful motion blur|person lifting giant boulder|shapeshifting luminous silhouette|hands green healing light over leaf|hands shaping fire sphere|hands shaping floating water sphere|hands shaping ice crystals|hands conducting blue electricity|floating boulders gravity field|person calmly talking to friendly forest animals|crystal ball showing future city|brain bright neural light|glowing portal to another dimension|three identical silhouettes light duplicates",
    ),
  },
];
export const pizzaExtra = rows(
  "Sosis|Yeşil zeytin|Jalapeno|Füme hindi",
  "sliced frankfurter sausage|green olives|jalapeno slices|smoked turkey slices",
);
export const dessertItems = rows(
  "Künefe|Fırın sütlaç|İrmik helvası|Lokma|Güllaç|Revani|Kazandibi|Baklava|Şekerpare|Aşure|Profiterol|Trileçe|San Sebastian cheesecake|Tiramisu|Sufle|Ekler|Tulumba|Waffle|Dondurma|Sütlü nuriye",
  "Turkish kunefe pistachio cheese pastry|baked rice pudding clay bowl|semolina halva|lokma fried dough balls|gullac milk pastry pomegranate|revani semolina cake|caramelized milk pudding kazandibi|pistachio baklava|sekerpare syrup cookies|asure wheat fruit pudding|profiterole chocolate cream puffs|trilece caramel milk cake|Basque burnt cheesecake|tiramisu|chocolate souffle|chocolate eclairs|tulumba syrup pastry|waffle fruit chocolate|Turkish ice cream|sutlu nuriye milk baklava",
);
