// Özgün SVG çizimler ve sunucu kataloğu aynı yerel kaynaktan üretilir.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const catalog = JSON.parse(
  readFileSync("src/games/auction/catalog.json", "utf8"),
);
const shapes = {
  cheese:
    '<path d="M60 120l76-45 62 40-76 44z" fill="#f1c85e"/><path d="M60 120v44l62 39v-44m0 0l76-44v43l-76 45" fill="#e4ad50"/><g fill="#ba863d"><ellipse cx="91" cy="151" rx="7" ry="10"/><circle cx="143" cy="165" r="6"/><ellipse cx="173" cy="149" rx="6" ry="9"/></g>',
  tomato:
    '<circle cx="128" cy="143" r="58" fill="#dd7b70"/><path d="M128 103l-28-23 28 8 24-17-7 24 28 9-32 5" fill="#82a37f"/><path d="M92 126q-13 18-3 35" fill="none" stroke="#f6b0a4" stroke-width="9" stroke-linecap="round"/>',
  greens:
    '<path d="M128 191Q29 156 79 78q53 2 49 113Q224 158 187 82q-59-6-59 109" fill="#82a984"/><path d="M128 195V83m0 60l-42-34m42 52l41-45" stroke="#527b5d" stroke-width="5" fill="none"/>',
  meat: '<ellipse cx="128" cy="146" rx="73" ry="43" fill="#b37c65"/><ellipse cx="128" cy="133" rx="70" ry="40" fill="#ce937c"/><path d="M81 111l71 44m-44-57l69 44m-87 1l48-36" stroke="#965e50" stroke-width="7" stroke-linecap="round"/>',
  mushroom:
    '<path d="M111 132l-11 60q26 18 57 0l-12-60" fill="#f8edd8"/><path d="M54 138q6-92 75-83 62-2 76 83-75 34-151 0" fill="#bd9680"/><ellipse cx="129" cy="139" rx="74" ry="17" fill="#99745f"/><path d="M80 112q11-29 34-33" fill="none" stroke="#e4c7ad" stroke-width="8" stroke-linecap="round"/>',
  olive:
    '<g fill="#5a6459"><ellipse cx="92" cy="150" rx="31" ry="38" transform="rotate(-25 92 150)"/><ellipse cx="151" cy="145" rx="32" ry="40" transform="rotate(20 151 145)"/></g><path d="M119 104q2-40 58-41-4 43-58 41" fill="#9bad79"/><path d="M124 101l36-25" stroke="#6d8051" stroke-width="4"/>',
  pepper:
    '<path d="M123 99q-54-21-64 24-11 50 46 73 52 15 83-35 23-42-25-64z" fill="#db8168"/><path d="M129 108q-10-43 20-49" stroke="#72966d" stroke-width="13" fill="none" stroke-linecap="round"/><path d="M98 119q-22 27 1 48" stroke="#efad92" stroke-width="9" fill="none" stroke-linecap="round"/>',
  pineapple:
    '<ellipse cx="128" cy="148" rx="48" ry="57" fill="#e9be62"/><path d="M99 105l-17-49 41 29 5-46 19 46 37-26-22 48" fill="#86a175"/><path d="M87 135l63 49m-64-24l40 30m-18-74l58 47m-75 10l61-57m-44 78l57-51" stroke="#c59d4d" stroke-width="4" fill="none"/>',
  onion:
    '<path d="M128 70q-54 39-59 83-3 49 59 50 63-2 58-50-6-41-58-83" fill="#c49ab6"/><path d="M128 76q-27 74-13 120m14-119q32 75 13 119" stroke="#e7c6db" stroke-width="7" fill="none"/><path d="M127 75l-7-27m9 27l16-26" stroke="#8b9f79" stroke-width="6"/>',
  sauce:
    '<rect x="91" y="94" width="76" height="109" rx="24" fill="#c88e75"/><path d="M104 96V72h50v24" fill="#f3e2b9"/><path d="M109 73V53h40v20" fill="#a8816c"/><rect x="103" y="124" width="52" height="45" rx="9" fill="#f9edd8"/><path d="M127 130q-26 29 0 29 26 0 0-29" fill="#c88e75"/>',
  corn: '<ellipse cx="129" cy="133" rx="34" ry="67" fill="#ebc45d"/><path d="M96 200q-45-36-36-91 54 18 69 91 18-68 66-95 8 72-66 102" fill="#8ca776"/><path d="M114 80v90m16-96v110m15-104v83m-47-58h62m-64 18h65m-64 18h59" stroke="#c7a04b" stroke-width="3"/>',
  fish: '<path d="M60 144q58-80 122 0-64 76-122 0l-26-34v69z" fill="#8caebb"/><path d="M101 99l22-20 23 24m-39 78l22 20 19-23" fill="#6e94a4"/><circle cx="163" cy="135" r="5" fill="#435b64"/><path d="M141 111q-18 31 0 62" stroke="#638b9a" stroke-width="4" fill="none"/>',
  bread:
    '<path d="M53 163V125q-9-51 37-55 21-31 57-8 56-7 56 51v50q-71 26-150 0" fill="#dfb27a"/><path d="M75 134q51 23 104 0v30q-49 19-104 0z" fill="#f5d7a2"/><path d="M91 89l10 25m25-35l9 27m24-24l7 24" stroke="#f7d49b" stroke-width="8" stroke-linecap="round"/>',
  egg: '<path d="M128 73q-33-35-59-4-32 10-18 49-21 36 13 54 8 32 48 21 45 23 64-11 38-10 26-49 15-44-24-48-24-30-50-12" fill="#fff9e9"/><circle cx="127" cy="135" r="37" fill="#efc662"/><path d="M106 122q11-13 26-9" stroke="#ffe3a0" stroke-width="7" fill="none" stroke-linecap="round"/>',
  berry:
    '<path d="M69 112q59-41 118 0-11 60-58 90-48-29-60-90" fill="#dc7c8f"/><path d="M128 112l-39-27 34 2 10-24 10 24 30-5-23 29" fill="#83a87a"/><g fill="#f8d89d"><ellipse cx="100" cy="129" rx="3" ry="5"/><ellipse cx="132" cy="141" rx="3" ry="5"/><ellipse cx="157" cy="126" rx="3" ry="5"/><ellipse cx="117" cy="166" rx="3" ry="5"/><ellipse cx="145" cy="167" rx="3" ry="5"/></g>',
  chocolate:
    '<path d="M66 101l99-34 31 98-98 34z" fill="#8c675d"/><path d="M75 106l85-29 26 82-84 29z" fill="#ac8070"/><path d="M103 97l27 82m-2-91l28 83m-72-39l86-29m-77 55l85-29" stroke="#805a50" stroke-width="6"/>',
  cream:
    '<path d="M77 167q-27-29 13-47-20-25 19-37 18-6 18-28 36 16 25 42 45 8 26 34 38 27 1 43z" fill="#fff6e6"/><path d="M91 121q36 15 66-3m-78 31q46 17 96-4" fill="none" stroke="#e9d7be" stroke-width="7" stroke-linecap="round"/>',
  banana:
    '<path d="M71 70q-17 90 71 111 44 11 61-16-39 14-76-21-32-30-43-73" fill="#edce72"/><path d="M80 78q-8 77 71 92" fill="none" stroke="#d0ac53" stroke-width="5"/><path d="M72 71l10-14m112 108l12-3" stroke="#8b7757" stroke-width="10" stroke-linecap="round"/>',
  nut: '<ellipse cx="105" cy="142" rx="36" ry="48" transform="rotate(-20 105 142)" fill="#cba578"/><ellipse cx="160" cy="151" rx="32" ry="42" transform="rotate(22 160 151)" fill="#ad8965"/><path d="M97 101q-15 44 17 76m43-62q-10 36 13 64" stroke="#8f6f4d" stroke-width="5" fill="none"/>',
  honey:
    '<rect x="78" y="105" width="103" height="94" rx="20" fill="#dfb56c"/><rect x="76" y="91" width="107" height="21" rx="7" fill="#b8a883"/><rect x="96" y="128" width="69" height="44" rx="8" fill="#f8eac7"/><path d="M123 49l65 35m-14-33l-12 22m-1-28l-12 22m-1-28l-12 22" stroke="#a9865e" stroke-width="9" stroke-linecap="round"/>',
  cake: '<path d="M65 140l80-65 52 64v53H65z" fill="#e8b0ad"/><path d="M65 139l80-64 52 64z" fill="#f8e9d6"/><path d="M65 166h132" stroke="#fcf2e5" stroke-width="13"/><circle cx="145" cy="98" r="14" fill="#d8768c"/><path d="M146 86q-3-17 11-21" stroke="#82a47d" stroke-width="5" fill="none"/>',
  cookie:
    '<circle cx="128" cy="139" r="66" fill="#dbb88c"/><circle cx="128" cy="139" r="54" fill="none" stroke="#eccc9f" stroke-width="6"/><g fill="#956f5a"><circle cx="103" cy="112" r="8"/><circle cx="149" cy="128" r="9"/><circle cx="113" cy="159" r="8"/><circle cx="150" cy="169" r="6"/></g>',
  flower:
    '<g fill="#d997b7"><ellipse cx="128" cy="98" rx="20" ry="37"/><ellipse cx="128" cy="98" rx="20" ry="37" transform="rotate(72 128 131)"/><ellipse cx="128" cy="98" rx="20" ry="37" transform="rotate(144 128 131)"/><ellipse cx="128" cy="98" rx="20" ry="37" transform="rotate(216 128 131)"/><ellipse cx="128" cy="98" rx="20" ry="37" transform="rotate(288 128 131)"/></g><circle cx="128" cy="131" r="22" fill="#ebca80"/>',
  tea: '<path d="M91 101q22 49 0 83 36 21 73 0-22-36 0-83z" fill="#d9c3b2"/><path d="M99 122q13 33 2 57 25 12 52 0-12-25-1-57z" fill="#b88365"/><ellipse cx="128" cy="194" rx="59" ry="10" fill="#f8eddb"/><path d="M115 82q-10-12 1-28m25 27q-11-15 1-26" stroke="#c5b7ac" stroke-width="5" fill="none" stroke-linecap="round"/>',
  orange:
    '<circle cx="128" cy="143" r="59" fill="#e6ae62"/><path d="M128 84q9-35 44-27-1 33-44 27" fill="#8ea680"/><circle cx="128" cy="143" r="42" fill="#f4cd87"/><path d="M128 104v79m-39-40h78m-67-28l56 56m-56 0l56-56" stroke="#fbe9be" stroke-width="4"/>',
  avocado:
    '<path d="M128 62q-26 12-48 58-33 77 48 82 81-5 48-82-22-46-48-58" fill="#81a177"/><path d="M128 77q-22 13-39 51-25 59 39 63 64-4 39-63-17-38-39-51" fill="#c7d79b"/><circle cx="128" cy="154" r="29" fill="#ae8263"/>',
  pickle:
    '<path d="M90 190q-40-36 0-85l54-44q39-13 45 22-6 24-39 53-22 53-60 54" fill="#89a67c"/><path d="M90 167q-16-21 15-52l48-39" stroke="#abc293" stroke-width="9" fill="none" stroke-linecap="round"/><g fill="#63845c"><circle cx="130" cy="127" r="4"/><circle cx="154" cy="101" r="4"/><circle cx="107" cy="150" r="4"/></g>',
  garlic:
    '<path d="M128 93q-63 13-62 65 2 45 63 44 61 1 62-44-1-52-63-65l7-41-21-2z" fill="#ede2d4"/><path d="M125 105q-28 35-10 86m20-86q30 34 10 86" fill="none" stroke="#c8b5a7" stroke-width="5"/>',
  shrimp:
    '<path d="M162 80q-89-33-94 42-10 64 61 65 40-2 41-40-8-22-28-11 17 28-10 26-32-3-29-36 3-31 45-20" fill="none" stroke="#dfa08a" stroke-width="25" stroke-linecap="round"/><path d="M154 103l26-34 9 34-22 18" fill="#c48273"/><path d="M96 101l20 9m-39 17l26 2m-14 32l18-16" stroke="#b47b6c" stroke-width="4"/>',
};
shapes.coconut = shapes.nut;
shapes.cherry = shapes.berry;
shapes.pearls =
  '<g fill="#fff7e9" stroke="#dfd0bc" stroke-width="2">' +
  [
    [95, 120],
    [140, 100],
    [165, 150],
    [110, 171],
    [129, 137],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="19"/>`)
    .join("") +
  "</g>";
const furniture = {
  sofa: '<rect x="55" y="94" width="146" height="75" rx="24"/><path d="M53 136v51h151v-51M78 186v15m100-15v15M128 105v65"/>',
  lamp: '<path d="M128 114v84m-40 0h80"/><path d="M84 117l16-59h56l17 59z"/>',
  bookshelf:
    '<rect x="69" y="56" width="121" height="147" rx="5"/><path d="M70 126h119M87 72v51m18-51v51m22-51v51m22 19v53m-40-53v53m65-53v53"/>',
  bathtub:
    '<path d="M49 120h161l-15 64q-65 27-131 0zM72 197v9m116-9v9M76 120V87q0-31 31-16v24"/>',
  bed: '<path d="M58 96v104m141-104v104M58 113h141v72H58z"/><rect x="70" y="121" width="48" height="25" rx="8"/><rect x="134" y="121" width="48" height="25" rx="8"/>',
  desk: '<path d="M50 117h158M67 117v83m123-83v83M151 135h35v31h-35z"/><rect x="90" y="68" width="74" height="44" rx="5"/>',
  plant: shapes.greens + '<path d="M90 171h77l-12 42h-53z"/>',
  mirror:
    '<rect x="83" y="48" width="91" height="144" rx="44"/><path d="M91 198l-9 16m83-16l9 16M110 87l32-17m-37 46l41-22"/>',
  pool: '<ellipse cx="128" cy="149" rx="83" ry="48"/><path d="M65 144q15-16 30 0t30 0 30 0 30 0M86 169q15-16 30 0t30 0 30 0"/>',
};
for (const k of [
  "piano",
  "fireplace",
  "rug",
  "terrace",
  "kitchen",
  "cinema",
  "chair",
])
  furniture[k] =
    k === "rug"
      ? '<path d="M58 93h145v98H58zM77 109h106v65H77zM100 142l28-21 26 21-26 19z"/>'
      : k === "fireplace"
        ? '<path d="M61 93h137v110H61zM49 83h162M86 199v-70h87v70"/><path d="M128 186q-37-5-10-43 2 17 11 14l10-27q38 51-11 56"/>'
        : k === "cinema"
          ? '<rect x="49" y="65" width="161" height="107" rx="8"/><path d="M109 88v58l44-29zM81 190h97"/>'
          : k === "piano"
            ? '<path d="M59 82q137-55 144 33v59H59zM70 175v29m120-29v29M59 139h144m-122 0v34m23-34v34m24-34v34m24-34v34m23-34v34"/>'
            : k === "chair"
              ? '<path d="M88 134V65q38-17 73 0v69M74 136h102v35H74zM91 172v25m68-25v25M60 194q68 22 132 0"/>'
              : '<path d="M56 104l72-50 73 50v91H56zM97 194v-70h61v70M49 200h164"/>';
const travel = {
  mountain:
    '<path d="M31 195l73-118 35 62 25-37 64 93z" fill="#94b4a4"/><path d="M80 117l24-40 24 43-20-11-11 14z" fill="#fff7e7"/>',
  beach:
    '<path d="M30 187q88-47 196-12v40H30" fill="#e6cd99"/><path d="M138 181V96m-53 13q53-75 105 0z" fill="#e29b93" stroke="#b78175" stroke-width="5"/><path d="M32 155q28-18 53 0t53 0 53 0" fill="none" stroke="#9bbfc8" stroke-width="12"/>',
  balloon:
    '<path d="M128 51q-77 0-52 70l34 46h36l34-46q25-70-52-70" fill="#d8a2b7"/><path d="M128 51q-33 59-15 111m15-111q34 59 15 111" stroke="#f1d8cc" stroke-width="16" fill="none"/><path d="M111 173h34v26h-34z" fill="#c49d77"/>',
  tent: '<path d="M43 193l81-125 88 125z" fill="#d9b78e"/><path d="M85 193l39-125 47 125z" fill="#a78270"/><circle cx="191" cy="64" r="14" fill="#e6d69e"/>',
};
travel.cabin =
  '<path d="M62 126l65-65 67 65v71H62z" fill="#ba967e"/><path d="M46 127l81-80 81 80" stroke="#7e8f7e" stroke-width="17" fill="none"/><rect x="108" y="135" width="39" height="62" fill="#ebcc9d"/>';
travel.island = travel.beach;
travel.ski = travel.mountain;
travel.aurora =
  '<path d="M35 99q48-64 89 0t95-2M33 137q42-64 89 0t95-2" stroke="#a5cbb9" stroke-width="22" fill="none"/>' +
  travel.mountain;
travel.ship =
  '<path d="M44 159h174l-35 39H76z" fill="#9daebb"/><path d="M130 57v99H65z" fill="#fff5dd"/><path d="M140 73v76h62z" fill="#dbb2a1"/>';
travel.train =
  '<rect x="50" y="83" width="158" height="96" rx="21" fill="#9eb7bd"/><g fill="#f8eccf"><rect x="68" y="101" width="42" height="34" rx="5"/><rect x="132" y="101" width="55" height="34" rx="5"/></g><path d="M62 193h137M73 183l-16 24m127-24l16 24" stroke="#81949a" stroke-width="7"/>';
travel.city =
  '<g fill="#b1a9c4"><path d="M45 199V101h51v98M108 199V64h54v135M174 199V122h39v77"/></g><path d="M62 124h17m-17 24h17m49-54h16m-16 24h16m-16 25h16m-16 25h16m50-21h13m-13 24h13" stroke="#f2dfbe" stroke-width="9"/>';
travel.museum =
  '<path d="M43 105l86-48 86 48zM49 195h160M71 115v73m39-73v73m39-73v73m38-73v73" fill="#d6c3a8" stroke="#b6a18d" stroke-width="12"/>';
travel.waterfall =
  '<path d="M55 62h147v136H55z" fill="#9bb7a2"/><path d="M112 63q-12 55 2 75t-15 65h58q-20-46-8-65t2-75z" fill="#c2dce1"/><path d="M126 70q-5 52 6 81m-37 41h72" stroke="#f5f2df" stroke-width="6" fill="none"/>';
travel.scuba =
  '<path d="M42 150q34-33 69-1t104 0" fill="none" stroke="#9cbfc8" stroke-width="15"/>' +
  shapes.fish;
travel.safari = travel.tent + shapes.greens.replaceAll("128", "188");
travel.spa =
  shapes.flower + '<ellipse cx="128" cy="194" rx="65" ry="13" fill="#9aada1"/>';
function animal(kind) {
  const flying = ["eagle", "owl", "dragon"].includes(kind);
  const aquatic = ["shark", "croc"].includes(kind);
  return aquatic
    ? shapes.fish.replaceAll("#8caebb", kind === "croc" ? "#94aa7d" : "#8caebb")
    : `<g fill="${["lion", "tiger", "fox", "horse"].includes(kind) ? "#cba078" : "#9ea79e"}" stroke="#738278" stroke-width="3"><ellipse cx="126" cy="155" rx="62" ry="40"/><path d="M81 169v35h19v-32m57-4v36h20v-46"/><circle cx="172" cy="105" r="35"/>${kind === "elephant" ? '<path d="M195 109q37 73-3 81l-10-14q25 0 0-47"/><ellipse cx="145" cy="106" rx="23" ry="34"/>' : kind === "lion" ? '<circle cx="171" cy="105" r="44" fill="#af8a66"/><circle cx="171" cy="106" r="29" fill="#d4ac7f"/>' : kind === "rhino" ? '<path d="M193 102l23-35-4 47"/>' : kind === "cobra" ? '<path d="M92 186q-38-111 28-124 73 14 24 97" fill="none" stroke="#9eae85" stroke-width="26"/>' : '<path d="M149 80l-6-27 29 20m11 1l20-20-1 37"/>'}${flying ? '<path d="M114 142L36 64l8 73 69 40m26-35l89-79-15 81-64 32" fill="#b2b8a7"/>' : ""}<circle cx="182" cy="102" r="4" fill="#424f48"/><path d="M64 151q-27-10-27-38" fill="none" stroke-width="10" stroke-linecap="round"/></g>`;
}
function animalArt(kind) {
  const eyes =
    '<g fill="#4c5350"><circle cx="103" cy="124" r="5"/><circle cx="153" cy="124" r="5"/></g>';
  const muzzle =
    '<ellipse cx="128" cy="153" rx="31" ry="23" fill="#f4e5cd"/><path d="M119 145h18l-9 10z" fill="#68594e"/><path d="M128 154v8m-10 0q10 9 20 0" fill="none" stroke="#8e7764" stroke-width="3" stroke-linecap="round"/>';
  const head = (color, ears) =>
    `<g fill="${color}" stroke="#887e7160" stroke-width="3">${ears}<rect x="70" y="80" width="116" height="113" rx="50"/></g>`;
  const pointed = '<path d="M77 101L69 49l47 38m63 13l8-51-47 38"/>';
  const round =
    '<circle cx="78" cy="83" r="24"/><circle cx="178" cy="83" r="24"/>';
  const bodies = {
    lion:
      '<g fill="#b99063">' +
      Array.from(
        { length: 12 },
        (_, i) =>
          `<circle cx="${128 + 53 * Math.cos((i * Math.PI) / 6)}" cy="${132 + 53 * Math.sin((i * Math.PI) / 6)}" r="23"/>`,
      ).join("") +
      "</g>" +
      head("#d7b17f", round) +
      eyes +
      muzzle,
    tiger:
      head("#d4a277", pointed) +
      '<path d="M105 86l10 20m36-20l-10 20M74 126l21 9m-22 16l22 5m89-30l-21 9m22 16l-22 5" stroke="#866a53" stroke-width="8" stroke-linecap="round"/>' +
      eyes +
      muzzle,
    wolf:
      head("#9caaa8", pointed) +
      '<path d="M78 143l50 53 50-53-30 6-20-21-20 21z" fill="#e7e6d9"/>' +
      eyes +
      muzzle,
    fox:
      head("#cc9a75", pointed) +
      '<path d="M73 126q3 57 55 67-30-64-55-67m110 0q-3 57-55 67 30-64 55-67" fill="#f9ecd5"/>' +
      eyes +
      '<path d="M119 160h18l-9 11z" fill="#68594e"/>',
    bear: head("#af957b", round) + eyes + muzzle,
    gorilla:
      head("#858f8a", round) +
      '<path d="M85 118q43-44 86 0v39q-43 58-86 0z" fill="#b9b6a6"/>' +
      eyes +
      '<ellipse cx="128" cy="151" rx="27" ry="20" fill="#7f8277"/><circle cx="118" cy="150" r="4"/><circle cx="139" cy="150" r="4"/><path d="M109 176h38" stroke="#5b645d" stroke-width="4"/>',
    elephant:
      '<g fill="#a5b2ad" stroke="#84968b" stroke-width="3"><ellipse cx="67" cy="120" rx="34" ry="50"/><ellipse cx="190" cy="120" rx="34" ry="50"/><rect x="80" y="69" width="96" height="116" rx="47"/><path d="M112 138v57q14 36 47 8l-8-13q-18 17-19-5v-47"/></g>' +
      eyes +
      '<path d="M91 154q-10 29-21 15m96-15q10 29 21 15" stroke="#fcf2dc" stroke-width="9" fill="none" stroke-linecap="round"/>',
    rhino:
      head("#acb5aa", round) +
      eyes +
      '<ellipse cx="127" cy="162" rx="46" ry="27" fill="#c2c9b8"/><path d="M111 160l18-73 19 73" fill="#f3e9d3" stroke="#b6b4a4" stroke-width="3"/>',
    bison:
      '<path d="M85 104q-55-10-28-52 0 33 36 27m78 25q55-10 28-52 0 33-36 27" fill="#efe4ca" stroke="#b4a38e" stroke-width="3"/>' +
      head("#a98e74", "") +
      '<path d="M79 91q8-47 28-17 17-39 31-3 29-37 40 20" fill="#8c7562"/>' +
      eyes +
      muzzle,
    horse:
      '<g fill="#c09f7e"><path d="M86 94V45l27 43m58 6V45l-27 43"/><rect x="83" y="77" width="90" height="130" rx="40"/></g><path d="M103 78q25-39 50 0l-8 47-17-29-17 29" fill="#8b7668"/><ellipse cx="128" cy="179" rx="38" ry="24" fill="#e7ccb0"/>' +
      eyes +
      '<g fill="#8d7a69"><circle cx="113" cy="181" r="4"/><circle cx="143" cy="181" r="4"/></g>',
    owl: '<path d="M63 85l8-38 42 26h30l42-26 8 38v87q-64 65-130 0z" fill="#a8a99a"/><g fill="#ece3ca"><ellipse cx="100" cy="124" rx="34" ry="41"/><ellipse cx="156" cy="124" rx="34" ry="41"/></g><g fill="#697569"><circle cx="100" cy="122" r="14"/><circle cx="156" cy="122" r="14"/></g><g fill="#fff9e7"><circle cx="105" cy="118" r="4"/><circle cx="161" cy="118" r="4"/></g><path d="M117 147h22l-11 19z" fill="#c3a46b"/>',
    eagle:
      '<path d="M64 192q10-67 47-101 69-46 85 39l-50 65z" fill="#a7b2a5"/><path d="M97 110q30-68 82-39 25 14 15 58l-35 1-22 46-38-24 18-15-26-9" fill="#f4ecd6"/><path d="M178 113q44 1 32 34l-26-14-31-2" fill="#d6b572"/><circle cx="164" cy="101" r="6" fill="#657065"/>',
    croc: '<path d="M54 164V94l24-27 18 19 21-18 20 19 22-9 43 51v39z" fill="#97ae83"/><rect x="60" y="136" width="143" height="49" rx="23" fill="#b4c89c"/><path d="M78 157h109" stroke="#71875f" stroke-width="4"/><g fill="#fff2d6"><path d="M96 155l8 14 8-14m28 0l8 14 8-14"/></g><circle cx="96" cy="117" r="5" fill="#52644b"/><circle cx="159" cy="117" r="5" fill="#52644b"/>',
    shark:
      '<path d="M47 145l-20-42 52 18q63-62 133 18-77 64-136 16l-49 29z" fill="#99b4bf"/><path d="M113 104l22-43 21 56m-42 50l24 34 18-34" fill="#7d9da9"/><path d="M107 149q48 24 93-3l-19 30-53-1" fill="#f0eee1"/><circle cx="182" cy="131" r="5" fill="#4c626b"/><path d="M171 157l5 8 6-9" fill="#8b9fa5"/>',
    cobra:
      '<ellipse cx="127" cy="194" rx="69" ry="22" fill="#97ac83"/><path d="M119 189V145q-54-34-31-73 40-37 78 0 23 39-28 73v44" fill="#9bb389" stroke="#7e9870" stroke-width="4"/><path d="M108 174v-35q-18-24-4-41 25-19 47 0 13 20-15 41v37" fill="#d7d4a6"/><circle cx="113" cy="95" r="4" fill="#556c4b"/><circle cx="144" cy="95" r="4" fill="#556c4b"/><path d="M128 109v24m0-3l-9 8m9-8l9 8" stroke="#b1857c" stroke-width="3"/>',
    dragon:
      '<path d="M76 175L31 85l57 23 35-48 35 48 57-23-36 90" fill="#b5a4c7"/>' +
      head("#a3b58f", pointed) +
      eyes +
      '<path d="M102 159q27-26 54 0v23h-54z" fill="#c7d1a6"/><path d="M108 180l15 31 6-19 12 17 8-29" fill="#d8b16f"/>',
  };
  return bodies[kind] ?? animal(kind);
}
travel.island =
  '<ellipse cx="129" cy="186" rx="93" ry="22" fill="#e5ce9f"/><path d="M130 184q18-75 6-92" fill="none" stroke="#b19370" stroke-width="12"/><path d="M135 99q-26-53-68-12 39-1 68 12-8-63 49-47-35 12-49 47 57-36 76 16-41-21-76-16" fill="#95b58f"/>';
travel.ski =
  travel.mountain +
  '<path d="M83 166l61 32m-45-49l62 33" stroke="#b291a9" stroke-width="8" stroke-linecap="round"/>';
travel.spa =
  '<ellipse cx="128" cy="186" rx="72" ry="18" fill="#96aaa1"/><ellipse cx="128" cy="160" rx="55" ry="17" fill="#b8c5b9"/><ellipse cx="128" cy="134" rx="35" ry="15" fill="#d1d9c5"/><path d="M180 104q-4-42 29-48 5 36-29 48" fill="#9bb187"/>';
travel.scuba =
  '<rect x="49" y="93" width="159" height="79" rx="29" fill="#a9c3cc"/><g fill="#dcece7" stroke="#87a8b2" stroke-width="6"><rect x="62" y="106" width="52" height="49" rx="14"/><rect x="140" y="106" width="52" height="49" rx="14"/></g><path d="M127 147v46q34 16 44-7V71" stroke="#b2a5c1" stroke-width="12" fill="none" stroke-linecap="round"/>';
travel.safari =
  '<path d="M51 145l29-54h92l30 54v38H51z" fill="#afb992"/><path d="M90 105h29v32H75zm43 0h29l23 32h-52z" fill="#e7e9cc"/><g fill="#86947c"><circle cx="82" cy="185" r="20"/><circle cx="173" cy="185" r="20"/></g><circle cx="181" cy="67" r="15" fill="#e8cf91"/>';
furniture.sofa =
  '<rect x="69" y="90" width="121" height="82" rx="22"/><path d="M54 140q0-20 22-16v54h108v-54q24-4 24 16v46H54zM71 187v16m120-16v16M128 105v62"/>';
furniture.terrace =
  '<path d="M48 163h164M57 163v43m25-43v43m26-43v43m26-43v43m26-43v43m26-43v43m20-43v43M140 160V74m-41 20q41-57 83 0z"/>';
furniture.kitchen =
  '<path d="M48 116h162v79H48zM39 112h180M100 121v70m53-70v70M67 139h11m39 0h11m42 0h11M87 110V81q0-28 24-13v18"/>';
const whiteCheese = shapes.cheese
  .replaceAll("#f1c85e", "#f6eedc")
  .replaceAll("#e4ad50", "#ded7c5")
  .replaceAll("#ba863d", "#c1b7a6");
const mozzarella =
  '<path d="M72 146q-12-54 46-61 59-16 72 43 12 64-49 72-61 3-69-54" fill="#faf2df"/><path d="M95 111q28-24 58-13" stroke="#e4dac5" stroke-width="7" fill="none" stroke-linecap="round"/>';
const berries = (color) =>
  '<g fill="' +
  color +
  '">' +
  [
    [93, 135],
    [129, 107],
    [161, 137],
    [114, 164],
    [148, 169],
  ]
    .map(
      ([x, y]) =>
        `<circle cx="${x}" cy="${y}" r="25"/><circle cx="${x - 6}" cy="${y - 6}" r="6" fill="#ffffff35"/>`,
    )
    .join("") +
  "</g>";
const cherry =
  '<path d="M91 139q29-45 48-79 2 47 30 85" stroke="#869b70" stroke-width="6" fill="none"/><g fill="#c87985"><circle cx="90" cy="159" r="31"/><circle cx="171" cy="167" r="31"/></g><path d="M142 74q22-31 45-15-8 27-45 15" fill="#93ad7e"/>';
const pancakes =
  '<g fill="#d9b583" stroke="#f5dbac" stroke-width="5"><ellipse cx="128" cy="172" rx="69" ry="23"/><ellipse cx="128" cy="154" rx="69" ry="23"/><ellipse cx="128" cy="136" rx="69" ry="23"/></g><path d="M105 119l30-12 24 16-31 12z" fill="#f2d47c"/><path d="M157 136v31q11 13 13-4v-23" fill="#bb9270"/>';
const macarons =
  '<g transform="rotate(-12 128 128)"><rect x="62" y="105" width="102" height="58" rx="27" fill="#b0c4a3"/><path d="M63 134h101" stroke="#f8ecd7" stroke-width="9"/></g><g transform="translate(46 27) rotate(12 128 128)"><rect x="65" y="105" width="91" height="54" rx="25" fill="#d7a3ba"/><path d="M66 133h89" stroke="#f8ecd7" stroke-width="9"/></g>';
const special = {
  "pizza-1": mozzarella,
  "pizza-4":
    '<g fill="#c98475" stroke="#aa6a60" stroke-width="3"><ellipse cx="95" cy="140" rx="35" ry="46"/><ellipse cx="155" cy="153" rx="35" ry="46"/></g><g fill="#efd7ae">' +
    [
      [90, 117],
      [104, 145],
      [80, 158],
      [156, 132],
      [145, 161],
      [167, 174],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4"/>`)
      .join("") +
    "</g>",
  "burger-2": shapes.cheese.replaceAll("#f1c85e", "#edbd64"),
  "burger-6":
    '<g fill="none" stroke="#d7ad73" stroke-width="16"><ellipse cx="94" cy="136" rx="31" ry="39" transform="rotate(-25 94 136)"/><ellipse cx="154" cy="157" rx="36" ry="28" transform="rotate(22 154 157)"/></g>',
  "burger-9":
    '<path d="M54 134q2-79 75-79t74 79z" fill="#dfb884"/><path d="M54 152h149v31q-73 29-149 0z" fill="#e9c393"/><g stroke="#f8e3b6" stroke-width="6" stroke-linecap="round"><path d="M91 91l5 8m26-20l2 8m28 0l-4 8m-39 15l3 6m32-6l-2 7"/></g>',
  "burger-15":
    '<g fill="#ebd2a0" stroke="#d4b279" stroke-width="4"><rect x="66" y="83" width="37" height="110" rx="17" transform="rotate(-15 84 138)"/><rect x="112" y="77" width="37" height="116" rx="17"/><rect x="157" y="84" width="37" height="110" rx="17" transform="rotate(15 175 139)"/></g>',
  "cake-4": berries("#cf869e"),
  "cake-5": shapes.chocolate
    .replaceAll("#8c675d", "#dbccb2")
    .replaceAll("#ac8070", "#f2e4cc")
    .replaceAll("#805a50", "#c7b69a"),
  "cake-7": shapes.nut
    .replaceAll("#cba578", "#b1c38c")
    .replaceAll("#ad8965", "#a7b77f"),
  "cake-9": berries("#939cbb"),
  "cake-10":
    '<path d="M62 130q2 76 66 76t66-76z" fill="#ab8b6c"/><ellipse cx="128" cy="128" rx="66" ry="39" fill="#faf1de"/><ellipse cx="128" cy="128" rx="47" ry="24" fill="#e8e1cf"/>',
  "cake-15": cherry,
  "breakfast-1":
    '<ellipse cx="128" cy="140" rx="66" ry="47" fill="none" stroke="#d8b17b" stroke-width="29"/><g stroke="#f9e3b4" stroke-width="3" stroke-linecap="round">' +
    Array.from({ length: 16 }, (_, i) => {
      const a = (i * Math.PI) / 8;
      return `<path d="M${128 + 66 * Math.cos(a)} ${140 + 47 * Math.sin(a)}l3 5"/>`;
    }).join("") +
    "</g>",
  "breakfast-2": whiteCheese,
  "breakfast-10":
    '<path d="M49 166l88-92 70 91z" fill="#dfc698" stroke="#c2a578" stroke-width="5"/><path d="M70 165l66-69 48 68" fill="none" stroke="#f1dbb1" stroke-width="5"/>',
  "breakfast-13": pancakes,
  "breakfast-16":
    '<path d="M53 166q3-97 73-101 74 3 80 101l-35-25q-42-24-80 0z" fill="#dfb785"/><path d="M104 74l-13 67m62-65l17 65m-42-77v63" stroke="#f5d8aa" stroke-width="7"/>',
  "pasta-15": mozzarella,
  "dessert-1":
    '<path d="M61 116l93-42 43 43v67l-93 26-43-35z" fill="#997262"/><path d="M61 116l93-42 43 43-93 32z" fill="#b78a75"/><path d="M101 149v59" stroke="#80604f" stroke-width="5"/>',
  "dessert-2": macarons,
  "dessert-5":
    berries("#d8b690") +
    '<path d="M64 128q11-21 33-13 29-32 54-11 33-6 44 36-18 23-39-2-26 19-48-4-23 18-44-6" fill="#a47c68"/>',
  "dessert-6":
    '<path d="M53 149l73-78 77 80-75 53z" fill="#d5b781"/><path d="M72 150l55-59 58 61-56 33z" fill="#e9d397"/><path d="M91 128l56 53m-38-72l57 52m-74 7l56-60m-37 78l58-61" stroke="#bca16b" stroke-width="5"/><g fill="#a8b87c"><circle cx="128" cy="133" r="5"/><circle cx="144" cy="145" r="5"/><circle cx="116" cy="151" r="5"/></g>',
  "dessert-7": shapes.cake
    .replaceAll("#e8b0ad", "#edddb7")
    .replaceAll("#f8e9d6", "#fff4d8")
    .replaceAll("#d8768c", "#a398bc"),
  "dessert-11":
    '<path d="M61 82h133v113H61z" fill="#d7b382" stroke="#bc9566" stroke-width="5"/><path d="M88 85v105m27-105v105m27-105v105m27-105v105M65 110h125M65 137h125M65 164h125" stroke="#f3d8a5" stroke-width="9"/>',
  "dessert-15": shapes.cake
    .replaceAll("#e8b0ad", "#ab8673")
    .replaceAll("#f8e9d6", "#d9bea0")
    .replaceAll("#d8768c", "#957062"),
};
special["breakfast-4"] =
  '<ellipse cx="128" cy="154" rx="79" ry="45" fill="#b6a294"/><ellipse cx="128" cy="144" rx="70" ry="36" fill="#d79579"/>' +
  shapes.egg.replace(
    "<path",
    '<g transform="translate(48 66) scale(.62)"><path',
  ) +
  "</g>";
special["breakfast-7"] =
  shapes.egg +
  special["pizza-4"].replace("<g", '<g transform="translate(31 44) scale(.6)"');
for (const theme of catalog) {
  theme.items.forEach((item, i) => {
    const name = item[0];
    const id = theme.id + "-" + (i + 1);
    if (item[2] === "sauce" && /mayonez|Hardal|Zeytinyağı|Trüf/.test(name))
      special[id] = shapes.sauce.replaceAll(
        "#c88e75",
        /mayonez/.test(name)
          ? "#e4cfa9"
          : /Hardal/.test(name)
            ? "#d9b767"
            : "#a8af81",
      );
    if (/Tavuk|tavuk/.test(name))
      special[id] = shapes.meat
        .replaceAll("#b37c65", "#cfb087")
        .replaceAll("#ce937c", "#e6c79f")
        .replaceAll("#965e50", "#b79a73");
  });
}
mkdirSync("public/auction", { recursive: true });
mkdirSync("public/auction", { recursive: true });
for (const theme of catalog) {
  theme.items = theme.items.map(([name, description, kind], i) => ({
    id: `${theme.id}-${i + 1}`,
    name,
    description,
    image: `/auction/${theme.id}-${i + 1}.svg`,
    kind,
  }));
  for (const [i, item] of theme.items.entries()) {
    const art =
      special[item.id] ??
      shapes[item.kind] ??
      (furniture[item.kind]
        ? `<g fill="#c6b5d7" stroke="#897c9c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">${furniture[item.kind]}</g>`
        : (travel[item.kind] ?? animalArt(item.kind)));
    const title = item.name.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
    writeFileSync(
      `public${item.image}`,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img"><title>${title}</title><rect width="256" height="256" rx="32" fill="${theme.color}"/><circle cx="${120 + (i % 3) * 8}" cy="125" r="93" fill="#ffffff45"/><ellipse cx="128" cy="211" rx="76" ry="10" fill="#6a586312"/><g transform="rotate(${(i % 3) - 1} 128 128)">${art}</g><path d="M37 63v12m-6-6h12M210 180v10m-5-5h10" stroke="#ffffffb0" stroke-width="3" stroke-linecap="round"/></svg>\n`,
    );
  }
}
writeFileSync(
  "src/games/auction/themes.json",
  JSON.stringify(catalog, null, 2) + "\n",
);
const seed = catalog
  .map(
    (t) =>
      `('${t.id}', '${t.title.replaceAll("'", "''")}', $catalog$${JSON.stringify(t.items)}$catalog$::jsonb)`,
  )
  .join(",\n");
writeFileSync(
  "supabase/migrations/202611060003_auction_catalog.sql",
  `-- scripts/build-auction-assets.mjs tarafından yerel katalogdan üretilir.\nbegin;\ncreate table private.auction_catalog(theme text primary key, title text not null, items jsonb not null);\nalter table private.auction_catalog enable row level security;\nrevoke all on private.auction_catalog from public, anon, authenticated;\ninsert into private.auction_catalog(theme,title,items) values\n${seed};\ncommit;\n`,
);
console.log(
  `${catalog.length} tema, ${catalog.reduce((n, t) => n + t.items.length, 0)} yerel SVG ve sunucu kataloğu hazır.`,
);
