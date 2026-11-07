import { readFileSync, writeFileSync } from "node:fs";
import {
  additions,
  pizzaExtra,
  dessertItems,
} from "./auction-expansion-data.mjs";
const source = JSON.parse(
  readFileSync("src/games/auction/catalog.json", "utf8"),
);
const pizza = source.find((t) => t.id === "pizza");
pizza.items.push(
  ...pizzaExtra.map(([name]) => [
    name,
    `${name} ile pizzana yeni bir lezzet kat.`,
    "topping",
  ]),
);
const dessert = source.find((t) => t.id === "dessert");
dessert.title = "En İyi Tatlı Tabağını Kur";
dessert.items = dessertItems.map(([name]) => [
  name,
  `Tatlı koleksiyonunun yıldızı: ${name}.`,
  "dessert",
]);
source.push(
  ...additions.map((t) => ({
    ...t,
    items: t.items.map(([name]) => [
      name,
      `${t.title.replace(/ Kur$| Hazırla$| Seç$/, "")}: ${name}.`,
      t.id,
    ]),
  })),
);
const photoThemes = new Set([
  "pizza",
  "dessert",
  ...additions.map((t) => t.id),
]);
const themes = source.map(({ style, ...t }) => ({
  ...t,
  items: t.items.map(([name, description, kind], i) => ({
    id: `${t.id}-${i + 1}`,
    name,
    description,
    kind,
    image: photoThemes.has(t.id)
      ? `/auction/atlas/${t.id}.webp`
      : `/auction/${t.id}-${i + 1}.svg`,
    ...(photoThemes.has(t.id) ? { image_cell: i } : {}),
  })),
}));
writeFileSync(
  "src/games/auction/themes.json",
  JSON.stringify(themes, null, 2) + "\n",
);
const seed = themes
  .map(
    (t) =>
      `('${t.id}','${t.title.replaceAll("'", "''")}',$catalog$${JSON.stringify(t.items)}$catalog$::jsonb)`,
  )
  .join(",\n");
writeFileSync(
  "supabase/migrations/202611070009_auction_expanded_catalog.sql",
  `-- 001–008 sonrasında bir kez çalıştırın. Önceki migration dosyaları değişmez.\nbegin;\ninsert into private.auction_catalog(theme,title,items) values\n${seed}\non conflict(theme) do update set title=excluded.title,items=excluded.items;\ncommit;\n`,
);
const prefix =
  "Production game asset sprite atlas. Exactly 4 columns and 5 rows, 20 equal square cells, 4:5 overall ratio, no gutters, borders, text, labels or watermarks. Every cell has exactly one centered subject with generous margins fully contained within its cell, soft professional studio/cinematic light and clean neutral background. ";
const subjectsPizza = [
  "mozzarella ball",
  "sliced tomato",
  "basil leaves",
  "Turkish sucuk sausage slices",
  "button mushrooms",
  "black olives",
  "sliced red bell pepper",
  "pineapple chunks",
  "parmesan wedge",
  "arugula leaves",
  "caramelized onions in bowl",
  "hot sauce in bowl",
  "grilled chicken strips",
  "sweetcorn kernels",
  "tuna flakes",
  "truffle oil bottle",
  ...pizzaExtra.map((x) => x[1]),
];
const jobs = [
  {
    id: "pizza",
    style: "photorealistic food ingredient catalogue photography",
    subjects: subjectsPizza,
  },
  {
    id: "dessert",
    style: "photorealistic Turkish dessert food photography on small plates",
    subjects: dessertItems.map((x) => x[1]),
  },
  ...additions.map((t) => ({
    id: t.id,
    style: t.style,
    subjects: t.items.map((x) => x[1]),
  })),
];
// Portreler yerine bu temada gücü simgeleyen özgün, markasız nesneler kullanılır.
const heroJob = jobs.find((j) => j.id === "heroes");
heroJob.style =
  "photorealistic studio still-life photography of symbolic fantasy equipment and natural effects, no people, no faces, no official logos, no text";
heroJob.subjects = [
  "red and black theater mask on neutral background",
  "green stone giant fist sculpture",
  "silver fantasy hammer with blue lightning",
  "intricate silver spider web between red leaves",
  "glowing red and gold mechanical energy core",
  "round red white blue metal shield with no emblem",
  "black bat silhouette sculpture",
  "red cape flowing over blue stone pedestal",
  "golden tiara and coiled rope",
  "three polished metal claws sculpture",
  "glowing circular golden portal",
  "black panther animal figurine",
  "red lightning bolt sculpture",
  "golden trident standing in water",
  "cosmic glowing gold star orb",
  "red crystal crown with energy",
  "tiny red and silver futuristic helmet",
  "wooden archery bow with purple ribbon",
  "black and red abstract hourglass sculpture",
  "green glowing crystal ring",
];
writeFileSync(
  "docs/auction-image-prompts.json",
  JSON.stringify(
    jobs.map(({ id, style, subjects }) => ({
      id,
      tool: "built-in image_gen",
      prompt:
        prefix +
        style +
        ". Row-major order, left to right and then down: " +
        subjects.map((s, i) => `${i + 1}. ${s}`).join("; ") +
        ". No subject may cross cell boundaries.",
    })),
    null,
    2,
  ) + "\n",
);
console.log(
  `${themes.length} tema; ${themes.reduce((n, t) => n + t.items.length, 0)} ürün. Yalnız yeni 009 migration üretildi.`,
);
