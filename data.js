/* Kenar Düellosu — game data: weapons, perks, cosmetics, maps, campaign, challenges */
(() => {
const K = window.K = window.K || {};
K.W = 960; K.H = 540;

/* ---------- weapons ----------
   kb: knockback per hit, rate: seconds between shots, clip, reload (s), spread (rad),
   speed (px/s), recoil, weight 0..3, len (px drawn), life (s), auto, pellets, burst,
   kind: bullet | rocket | arc | laser | demat, pierce, spin (minigun spin-up)          */
const WEAPONS = [];
const CATS = [
  { id: 'tabanca', name: 'Tabancalar' },
  { id: 'hafif',   name: 'Hafif makineli' },
  { id: 'pompali', name: 'Pompalılar' },
  { id: 'keskin',  name: 'Keskin nişancı' },
  { id: 'tufek',   name: 'Tüfek ve ağır makineli' },
  { id: 'ozel',    name: 'Özel' },
];
function w(id, name, cat, o) {
  WEAPONS.push(Object.assign({
    id, name, cat, kb: 260, rate: .25, clip: 12, reload: 1, spread: .03, speed: 1150, recoil: 40,
    weight: 0, len: 13, life: .9, auto: false, pellets: 1, burst: 0, kind: 'bullet', pierce: false,
    body: '#2a2b36', accent: '#5b5e70', stock: 0, scope: 0, mag: 1, clips: 3,
  }, o));
}
// Tabancalar — başlangıç silahı olarak seçilebilir, sınırsız şarjör
w('klasik',  'Klasik',        'tabanca', { kb: 300, rate: .26, clip: 12, reload: .9, len: 12, recoil: 40, clips: Infinity });
w('kartal',  'Çöl Kartalı',   'tabanca', { kb: 430, rate: .42, clip: 7,  reload: 1.1, len: 14, recoil: 110, accent: '#a9adb8', clips: Infinity });
w('kompakt', 'Kompakt',       'tabanca', { kb: 240, rate: .16, clip: 17, reload: .8, len: 11, recoil: 25, body: '#1c1d24', clips: Infinity });
w('altipatlar','Altıpatlar',  'tabanca', { kb: 520, rate: .55, clip: 6,  reload: 1.4, len: 14, recoil: 150, accent: '#8b2b2b', clips: Infinity });
w('cep',     'Cep Tabancası', 'tabanca', { kb: 200, rate: .12, clip: 20, reload: .7, len: 9,  recoil: 15, body: '#6c6f7d', clips: Infinity });
w('yilan',   'Yılan',         'tabanca', { kb: 380, rate: .34, clip: 8,  reload: 1.0, len: 15, recoil: 90, accent: '#a0652a', clips: Infinity });
w('altin',   'Altın Tabanca', 'tabanca', { kb: 340, rate: .2,  clip: 15, reload: .8, len: 13, recoil: 30, body: '#d6a920', accent: '#f6dc6a', clips: Infinity, locked: true });
// Hafif makineli
const smg = [
  ['ari','Arı',165,.075,30,.08,'#30323d','#e2b33a'], ['sinek','Sinek',150,.06,36,.11,'#40434f','#777b8c'],
  ['mini9','Mini-9',175,.08,30,.07,'#24252e','#4b4e5c'], ['firtina','Fırtına',160,.065,40,.1,'#3c4a3a','#6f8a5f'],
  ['kivilcim','Kıvılcım',185,.09,28,.06,'#2a2b36','#c9553b'], ['akrep','Akrep',145,.055,25,.12,'#252630','#8c8f9d'],
  ['yaban','Yaban',190,.095,32,.07,'#5a4632','#8a6a45'], ['simsek','Şimşek',155,.05,50,.13,'#262a3a','#4aa3ff'],
  ['kirbac','Kırbaç',200,.1,24,.06,'#33343f','#a9adb8'], ['vizilti','Vızıltı',140,.05,45,.12,'#4a4c57','#e7e7e7'],
  ['kasirga','Kasırga-S',180,.07,35,.08,'#1e2a24','#4e7d5c'], ['tunel','Tünel',170,.08,40,.09,'#2c2c2c','#6b6b6b'],
];
smg.forEach(([id, n, kb, rate, clip, spread, body, accent], i) =>
  w(id, n, 'hafif', { kb, rate, clip, spread, body, accent, auto: true, reload: 1.2 + (i % 3) * .1, speed: 1050, recoil: 16, weight: 1, len: 16 + (i % 4), life: .75, stock: i % 2, mag: 2 }));
// Pompalılar
w('cifte',   'Çifte',       'pompali', { pellets: 7, kb: 190, rate: .45, clip: 2, reload: 1.1, spread: .2,  speed: 950, recoil: 220, weight: 1, len: 20, life: .32, body: '#6b4a2b', accent: '#2b2b2b', stock: 1 });
w('pompa',   'Pompa',       'pompali', { pellets: 7, kb: 180, rate: .7,  clip: 6, reload: 1.4, spread: .22, speed: 950, recoil: 200, weight: 2, len: 21, life: .32, stock: 1 });
w('kisanamlu','Kısa Namlu', 'pompali', { pellets: 9, kb: 210, rate: .6,  clip: 2, reload: 1.0, spread: .3,  speed: 900, recoil: 300, weight: 1, len: 15, life: .26, body: '#3a2f25', accent: '#b58b52' });
w('agirpompa','Ağır Pompa', 'pompali', { pellets: 8, kb: 230, rate: .9,  clip: 5, reload: 1.6, spread: .2,  speed: 950, recoil: 260, weight: 3, len: 23, life: .34, stock: 1, mag: 2 });
w('otopompa','Oto Pompa',   'pompali', { pellets: 6, kb: 160, rate: .32, clip: 8, reload: 1.7, spread: .24, speed: 950, recoil: 150, weight: 2, len: 21, life: .3, auto: true, mag: 2 });
w('tirpan',  'Tırpan',      'pompali', { pellets: 5, kb: 220, rate: .6,  clip: 7, reload: 1.4, spread: .12, speed: 1000, recoil: 180, weight: 2, len: 22, life: .4, accent: '#a9adb8' });
w('sacma12', 'Saçma-12',    'pompali', { pellets: 7, kb: 170, rate: .5,  clip: 12, reload: 2.0, spread: .22, speed: 950, recoil: 170, weight: 2, len: 20, life: .3, mag: 2, body: '#202125' });
w('gurz',    'Gürz',        'pompali', { pellets: 10, kb: 150, rate: .8, clip: 4, reload: 1.5, spread: .34, speed: 900, recoil: 240, weight: 2, len: 19, life: .28, body: '#45362a' });
w('balyoz',  'Balyoz',      'pompali', { pellets: 6, kb: 260, rate: 1.0, clip: 3, reload: 1.6, spread: .16, speed: 980, recoil: 320, weight: 3, len: 24, life: .36, stock: 1, accent: '#c9553b' });
// Keskin nişancı
const snp = [
  ['atmaca','Atmaca',820,1.0,5,1.6,2,'#2a2b36'], ['kartalgoz','Kartal Göz',900,1.1,5,1.7,2,'#3c4a3a'],
  ['uzunyol','Uzun Yol',980,1.25,4,1.8,2,'#5a4632'], ['dagci','Dağcı',760,.85,6,1.5,2,'#33343f'],
  ['sessiz','Sessiz',700,.8,8,1.5,1,'#1c1d24'], ['tekatis','Tek Atış',1150,1.3,1,1.0,2,'#6b4a2b'],
  ['avci','Avcı',860,1.0,6,1.6,2,'#45362a'], ['yariotomatik','Yarı Otomatik',600,.45,10,1.8,2,'#262a3a'],
];
snp.forEach(([id, n, kb, rate, clip, reload, weight, body], i) =>
  w(id, n, 'keskin', { kb, rate, clip, reload, weight, body, spread: 0, speed: 2300, recoil: 230, len: 28 + (i % 3) * 2, scope: 1, stock: 1, life: .8 }));
w('filavci', 'Fil Avcısı', 'keskin', { kb: 1500, rate: 1.6, clip: 3, reload: 2.2, weight: 3, spread: 0, speed: 2500, recoil: 420, len: 34, scope: 1, stock: 1, pierce: true, body: '#2b2b2b', accent: '#d6a920', life: .8 });
// Tüfek ve ağır makineli
const rif = [
  ['piyade','Piyade',230,.11,26,.035,2,0], ['komando','Komando',240,.1,30,.04,1,0], ['bozkir','Bozkır',270,.13,30,.045,2,0],
  ['kisatufek','Kısa Tüfek',210,.09,25,.05,1,0], ['ciftsarjor','Çift Şarjör',220,.1,60,.05,2,0], ['taarruz','Taarruz',250,.11,30,.035,2,0],
  ['burst3','Üçlü Atış',280,.42,24,.02,2,3], ['gozcu','Gözcü',380,.3,15,.015,2,0], ['agirmakineli','Ağır Makineli',260,.09,80,.07,3,0],
  ['bant','Bant',240,.08,100,.08,3,0], ['kusatma','Kuşatma',300,.12,50,.06,3,0], ['savasci','Savaşçı',235,.1,35,.04,2,0],
  ['muhafiz','Muhafız',255,.12,40,.04,2,0], ['demiryagmur','Demir Yağmur',200,.06,120,.1,3,0],
];
const rifColors = ['#3c4a3a', '#2a2b36', '#5a4632', '#33343f', '#262a3a', '#1e2a24', '#45362a'];
rif.forEach(([id, n, kb, rate, clip, spread, weight, burst], i) =>
  w(id, n, 'tufek', { kb, rate, clip, spread, weight, burst, auto: !burst && id !== 'gozcu', reload: 1.3 + weight * .2, speed: 1300, recoil: id === 'gozcu' ? 90 : 28, len: 22 + weight * 2, stock: 1, mag: weight > 2 ? 3 : 2, body: rifColors[i % rifColors.length], accent: '#8c8f9d' }));
// Özel
w('minigun',  'Minigun',        'ozel', { kb: 150, rate: .045, clip: 150, reload: 2.4, spread: .1, speed: 1100, recoil: 12, weight: 3, len: 26, auto: true, spin: true, mag: 3, clips: 1 });
w('bazuka',   'Bazuka',         'ozel', { kind: 'rocket', kb: 950, rate: 1.1, clip: 3, reload: 1.6, spread: 0, speed: 620, recoil: 260, weight: 3, len: 26, life: 2, body: '#3c4a3a', accent: '#c9553b', clips: 2 });
w('bombaatar','Bomba Atar',     'ozel', { kind: 'arc', kb: 800, rate: .7, clip: 6, reload: 1.8, spread: .03, speed: 640, recoil: 120, weight: 2, len: 20, life: 3, body: '#4a4c57', mag: 3, clips: 2 });
w('lazer',    'Lazer',          'ozel', { kind: 'laser', kb: 520, rate: .45, clip: 10, reload: 1.6, spread: 0, speed: 0, recoil: 60, weight: 1, len: 20, body: '#e7e7e7', accent: '#ff3d6e', clips: 2 });
w('buhar',    'Buharlaştırıcı', 'ozel', { kind: 'demat', kb: 0, rate: .9, clip: 4, reload: 1.4, spread: 0, speed: 700, recoil: 80, weight: 1, len: 18, life: 1.6, body: '#d9dde6', accent: '#7ef0d0', clips: Infinity });
w('cividen',  'Çivi Tabancası', 'ozel', { kb: 120, rate: .05, clip: 60, reload: 1.6, spread: .05, speed: 1400, recoil: 8, weight: 1, len: 17, auto: true, body: '#ffc531', accent: '#1b1b1b' });
w('havatopu', 'Hava Topu',      'ozel', { kb: 420, pellets: 3, rate: .8, clip: 4, reload: 1.5, spread: .12, speed: 800, recoil: 140, weight: 2, len: 22, life: .22, body: '#4aa3ff', accent: '#e7e7e7' });
w('oyuncak',  'Oyuncak',        'ozel', { kb: 45, rate: .2, clip: 30, reload: .6, spread: .05, speed: 900, recoil: 0, weight: 0, len: 12, body: '#ff7ab8', accent: '#ffe08a' });
w('ikiz',     'İkiz Namlu',     'ozel', { kb: 330, pellets: 2, rate: .3, clip: 16, reload: 1.3, spread: .04, speed: 1200, recoil: 70, weight: 1, len: 18, body: '#33343f', accent: '#c9553b' });

/* ---------- weapon looks: frame type, colour scheme, parts ----------
   types: pistol revolver smg p90 vector rifle bullpup lmg sniper pump double autosg blunder
          minigun rocket launcher laser demat nail air toy twin
   parts: st stock (none fixed wood thumb skel fold wire), mg magazine (straight curved drum box grip dual belt ext),
          sc sight (iron dot holo mid long huge), md muzzle (supp brake bigbrake), hg handguard (rail wood vent fin)   */
const LOOKS = {
  klasik: ['pistol', 'black', {}], kartal: ['pistol', 'chrome', { big: 1 }], kompakt: ['pistol', 'black', { mg: 'ext' }],
  altipatlar: ['revolver', 'chrome', { furn: 'wood' }], cep: ['pistol', 'tan', {}], yilan: ['revolver', 'black', { sc: 'dot', furn: 'wood' }],
  altin: ['pistol', 'gold', { engr: 1 }],
  ari: ['smg', 'black', { mg: 'straight', st: 'fold', stripe: '#ffc531' }], sinek: ['smg', 'gunmetal', { mg: 'grip', md: 'supp' }],
  mini9: ['smg', 'black', { mg: 'grip', st: 'wire' }], firtina: ['smg', 'olive', { mg: 'straight', st: 'fixed', hg: 'rail', sc: 'dot' }],
  kivilcim: ['smg', 'black', { mg: 'curved', st: 'skel', md: 'brake', stripe: '#c9553b' }], akrep: ['smg', 'gunmetal', { mg: 'straight', st: 'fold', sc: 'iron' }],
  yaban: ['smg', 'wood', { mg: 'drum', st: 'wood', vg: 1, hg: 'fin' }], simsek: ['p90', 'black', { stripe: '#4aa3ff' }],
  kirbac: ['smg', 'chrome', { mg: 'straight', st: 'fixed', md: 'supp' }], vizilti: ['vector', 'white', { sc: 'holo' }],
  kasirga: ['smg', 'olive', { mg: 'curved', st: 'fold', hg: 'vent' }], tunel: ['smg', 'black', { mg: 'drum', st: 'skel', md: 'supp' }],
  cifte: ['double', 'wood', { st: 'wood' }], pompa: ['pump', 'black', { st: 'fixed', fore: 'wood' }], kisanamlu: ['double', 'wood', { sawed: 1 }],
  agirpompa: ['pump', 'olive', { st: 'fixed', hg: 'vent', md: 'brake' }], otopompa: ['autosg', 'black', { mg: 'box', st: 'fixed', handle: 1 }],
  tirpan: ['pump', 'chrome', { st: 'skel', sc: 'dot' }], sacma12: ['autosg', 'tan', { mg: 'drum', st: 'fold' }], gurz: ['blunder', 'wood', {}],
  balyoz: ['pump', 'black', { pg: 1, md: 'brake', stripe: '#c9553b' }],
  atmaca: ['sniper', 'black', { st: 'fixed', sc: 'long', bipod: 1 }], kartalgoz: ['sniper', 'olive', { st: 'thumb', sc: 'huge' }],
  uzunyol: ['sniper', 'wood', { st: 'wood', sc: 'long', fore: 1 }], dagci: ['sniper', 'tan', { st: 'skel', sc: 'long', md: 'brake' }],
  sessiz: ['sniper', 'black', { st: 'fixed', sc: 'mid', md: 'supp' }], tekatis: ['sniper', 'wood', { st: 'wood', sc: 'iron', fore: 1 }],
  avci: ['sniper', 'wood', { st: 'thumb', sc: 'mid', fore: 1 }], yariotomatik: ['sniper', 'black', { st: 'fixed', sc: 'mid', mg: 'box', hg: 'rail' }],
  filavci: ['sniper', 'black', { st: 'fixed', sc: 'huge', md: 'bigbrake', mg: 'box', bipod: 1, stripe: '#d6a920', thick: 1 }],
  piyade: ['rifle', 'black', { mg: 'curved', st: 'fixed', hg: 'rail', sc: 'iron' }], komando: ['rifle', 'tan', { mg: 'straight', st: 'fold', sc: 'dot' }],
  bozkir: ['rifle', 'wood', { mg: 'curved', st: 'wood', hg: 'wood', magc: '#a8562a' }], kisatufek: ['rifle', 'black', { mg: 'curved', st: 'fold', sc: 'holo' }],
  ciftsarjor: ['rifle', 'olive', { mg: 'dual', st: 'fixed', hg: 'vent' }], taarruz: ['bullpup', 'olive', { sc: 'dot' }],
  burst3: ['rifle', 'gunmetal', { mg: 'straight', st: 'fixed', handle: 1 }], gozcu: ['rifle', 'tan', { mg: 'straight', st: 'fixed', sc: 'long', md: 'brake' }],
  agirmakineli: ['lmg', 'black', { mg: 'box', bipod: 1, handle: 1, st: 'fixed' }], bant: ['lmg', 'olive', { mg: 'belt', bipod: 1, st: 'fixed' }],
  kusatma: ['lmg', 'black', { mg: 'drum', st: 'skel' }], savasci: ['bullpup', 'black', { sc: 'holo', stripe: '#c9553b' }],
  muhafiz: ['bullpup', 'white', { handle: 1 }], demiryagmur: ['lmg', 'tan', { mg: 'drum', hg: 'vent', bipod: 1, st: 'fixed' }],
  minigun: ['minigun', 'gunmetal', {}], bazuka: ['rocket', 'olive', {}], bombaatar: ['launcher', 'black', {}], lazer: ['laser', 'white', {}],
  buhar: ['demat', 'chrome', {}], cividen: ['nail', 'toyY', {}], havatopu: ['air', 'blue', {}], oyuncak: ['toy', 'toy', {}], ikiz: ['twin', 'black', { stripe: '#c9553b' }],
};
WEAPONS.forEach(wd => {
  const L = LOOKS[wd.id] || ['pistol', 'black', {}];
  wd.look = Object.assign({ t: L[0], c: L[1] }, L[2]);
  // health damage per hit; explosives deal their damage in the blast
  wd.dmg = wd.kind === 'demat' ? 100 : wd.kind === 'rocket' || wd.kind === 'arc' ? 0 : Math.max(2, Math.round(wd.kb / 34));
});
K.WEAPONS = WEAPONS;
K.WEAP = Object.fromEntries(WEAPONS.map(x => [x.id, x]));
K.CATS = CATS;
K.PISTOLS = WEAPONS.filter(x => x.cat === 'tabanca').map(x => x.id);
K.CRATE_POOL = WEAPONS.filter(x => x.cat !== 'tabanca' && x.id !== 'buhar').map(x => x.id);
K.GUNGAME = ['cep', 'klasik', 'ari', 'pompa', 'piyade', 'atmaca', 'kivilcim', 'agirpompa', 'bant', 'kartalgoz', 'lazer', 'bazuka'];

/* ---------- perks ---------- */
K.PERKS = [
  { id: 'none',     name: 'Yeteneksiz',      icon: '–',  desc: 'Ek bir yetenek yok.' },
  { id: 'weight',   name: 'Hafif Taşıyıcı',  icon: 'kg', desc: 'Silahların ağırlığı yürüyüş hızını düşürmez.' },
  { id: 'jump3',    name: 'Üçlü Zıplama',    icon: '3x', desc: 'Havada iki kez daha zıplayabilirsin.' },
  { id: 'minigun',  name: 'Minigun Avcısı',  icon: 'MG', desc: 'Sandıklardan %33 ihtimalle minigun çıkar.' },
  { id: 'recoil',   name: 'Sabit Nişan',     icon: '⇤',  desc: 'Ateş ederken geri tepme olmaz.' },
  { id: 'blast',    name: 'Patlama Kalkanı', icon: '◈',  desc: 'Patlamaların itişi büyük ölçüde azalır.' },
  { id: 'ammo',     name: 'Fazla Mermi',     icon: '+⅓', desc: 'Tüm silahlarda %33 daha fazla mermi.' },
  { id: 'nades',    name: 'Ekstra Dinamit',  icon: '+2', desc: 'Her canda 2 dinamit fazladan.' },
  { id: 'random',   name: 'Sürpriz Silah',   icon: '?',  desc: 'Her doğuşta rastgele bir silahla başlarsın.' },
  { id: 'duck',     name: 'Lastik Ördek',    icon: '◖',  desc: 'Dinamit yerine zıplayan ördek bombaları atarsın.' },
  { id: 'infpistol',name: 'Sonsuz Tabanca',  icon: '∞',  desc: 'Tabancan hiç dolum gerektirmez.' },
  { id: 'shotgun',  name: 'Kısa Namlu Ustası', icon: 'SG', desc: 'Sandıklardan her zaman Kısa Namlu çıkar.' },
  { id: 'kamikaze', name: 'Kamikaze',        icon: '✸',  desc: 'Bomba tuşu seni patlatır: bir can gider, çevren uçar.' },
];
K.PERK = Object.fromEntries(K.PERKS.map(p => [p.id, p]));

/* ---------- cosmetics ---------- */
K.COLORS = ['#4aa3ff', '#ff5a5a', '#5fd36a', '#c98bff', '#ffc531', '#ff8a3d', '#3fd6d0', '#f3efe6'];
K.HATS = ['Yok', 'Baret', 'Fötr', 'Kovboy', 'Bere', 'Taç', 'Kask', 'Kep'];
K.FACES = ['Sakin', 'Kızgın', 'Gözlük', 'Güneş gözlüğü', 'Bıyık', 'Maske'];
K.OUTFITS = ['Yelek', 'Takım', 'Tişört', 'Tulum', 'Zırh', 'Kapüşon'];

/* ---------- maps ----------
   plats: P(x, y, w, opts)
   opts: move [dx, dy, period]   back-and-forth motion
         orbit [cx, cy, r, period, phase]   elliptical loop
         drive speed             drives across the screen and wraps around (vehicles)
         blink [on, off, phase]  solid only while "on" (energy bridges, drawbridge)
         crumble 1               collapses shortly after being stood on, comes back later
         bounce v                launches anyone who lands on it (leaves, awnings)
         conv speed              conveyor belt, carries whoever stands on it
         k                       how it is drawn (hook, belt, leaf, cabin, boat, truck, chair, awning, energy...)
   map:  zones [{x,y,w,h,f}] updraft vents · wind {period,dur,f} gusts · supports  posts under static platforms */
const P = (x, y, w, o) => Object.assign({ x, y, w }, o || {});
K.MAPS = [
  { id: 'insaat', name: 'İnşaat Alanı', theme: 'insaat', features: ['Taşıma bandı', 'Vinç kancası'],
    desc: 'Ortadaki bant seni sağa taşır, vinç kancası tepede gidip gelir. Alt kirişin ortası açık.',
    plats: [P(60, 470, 330), P(570, 470, 330), P(300, 380, 360, { conv: 70, k: 'belt' }), P(40, 290, 220), P(700, 290, 220),
            P(350, 200, 260), P(120, 110, 110, { move: [600, 0, 10], k: 'hook' })] },
  { id: 'orman', name: 'Orman Köprüsü', theme: 'orman', supports: 'bamboo', features: ['Zıplatan yapraklar', 'Bambu kafes'],
    desc: 'Bambu kafesin katları arasında sıkışık bir dövüş. İki yandaki dev yapraklar seni havaya fırlatır.',
    plats: [P(100, 480, 240), P(380, 480, 200), P(620, 480, 240), P(40, 390, 200), P(300, 400, 360), P(720, 390, 200),
            P(170, 300, 240), P(550, 300, 240), P(360, 210, 240),
            P(6, 250, 74, { bounce: 1000, k: 'leaf' }), P(880, 250, 74, { bounce: 1000, k: 'leaf' })] },
  { id: 'teleferik', name: 'Teleferik', theme: 'teleferik', features: ['Hareketli kabinler', 'Açık uçurum'],
    desc: 'Zemin yok. İki istasyon arasında gidip gelen kabinlerin çatısında dövüşürsün.',
    plats: [P(0, 440, 180, { k: 'station' }), P(780, 440, 180, { k: 'station' }), P(0, 260, 150), P(810, 260, 150),
            P(190, 370, 110, { move: [470, 0, 8], k: 'cabin' }), P(660, 290, 110, { move: [-470, 0, 9], k: 'cabin' }),
            P(410, 190, 140, { k: 'pylon' })] },
  { id: 'uzay', name: 'Uzay İstasyonu', theme: 'uzay', g: .7, features: ['Düşük yerçekimi', 'Yörüngedeki platformlar'],
    desc: 'Yerçekimi zayıf, herkes uzağa savrulur. İki platform merkez modülün çevresinde döner.',
    plats: [P(380, 330, 200, { k: 'module' }), P(0, 0, 120, { orbit: [480, 330, 210, 12, 0] }), P(0, 0, 120, { orbit: [480, 330, 210, 12, .5] }),
            P(50, 460, 220), P(690, 460, 220), P(110, 200, 170), P(680, 200, 170)] },
  { id: 'kanal', name: 'Kanal Şehri', theme: 'kanal', supports: 'piles', features: ['Gondollar', 'Suya düşme'],
    desc: 'Alt kat yalnızca iki iskele ve kanalda süzülen gondollardan oluşur. Taş köprü ortada.',
    plats: [P(0, 470, 170), P(790, 470, 170), P(190, 478, 130, { move: [440, 0, 7], k: 'boat' }), P(640, 478, 130, { move: [-440, 0, 8], k: 'boat' }),
            P(250, 360, 460, { k: 'bridge' }), P(40, 270, 170), P(750, 270, 170), P(370, 220, 220), P(100, 140, 150), P(710, 140, 150)] },
  { id: 'kale', name: 'Eski Kale', theme: 'kale', supports: 'stone', features: ['Asma köprü', 'Çöken taşlar'],
    desc: 'Asma köprü belli aralıklarla kalkar. Kulelerin yanındaki eski taşlar üstüne basınca çöker.',
    plats: [P(200, 470, 560), P(30, 380, 150), P(780, 380, 150), P(30, 250, 150), P(780, 250, 150),
            P(330, 350, 300, { blink: [5, 2.4, 0], k: 'drawbridge' }), P(220, 250, 90, { crumble: 1 }), P(650, 250, 90, { crumble: 1 }), P(350, 160, 260)] },
  { id: 'denizalti', name: 'Denizaltı Üssü', theme: 'denizalti', g: .85, features: ['Kabarcık bacası', 'Asansör'],
    desc: 'Ortadaki kabarcık bacası düşenleri yukarı iter. Solda asansör iner çıkar.',
    zones: [{ x: 390, y: 150, w: 180, h: 420, f: 2500 }],
    plats: [P(60, 480, 320), P(580, 480, 320), P(150, 430, 110, { move: [0, -210, 6], k: 'lift' }), P(30, 330, 180), P(750, 330, 180),
            P(380, 250, 200), P(130, 150, 170), P(660, 160, 170)] },
  { id: 'otoyol', name: 'Otoyol', theme: 'otoyol', features: ['Akan trafik', 'Zemin yok'],
    desc: 'Zemin, iki şeritte akan kamyonlar ve minibüsler. Üstünde kalırsan ekran dışına taşınırsın.',
    plats: [P(0, 300, 220, { k: 'overpass' }), P(740, 300, 220, { k: 'overpass' }), P(410, 330, 140), P(360, 170, 240, { k: 'gantry' }),
            P(-100, 470, 210, { drive: 150, k: 'truck' }), P(470, 470, 210, { drive: 150, k: 'truck' }),
            P(150, 400, 150, { drive: -200, k: 'van' }), P(720, 400, 150, { drive: -200, k: 'van' })] },
  { id: 'col', name: 'Çöl Harabesi', theme: 'col', supports: 'sand', features: ['Kum fırtınası', 'Çöken taşlar'],
    desc: 'Arada bir kum fırtınası herkesi bir yana iter. Basamaklı tapınak ortada, kenardaki taşlar çöker.',
    wind: { period: 13, dur: 3.5, f: 430 },
    plats: [P(330, 470, 300), P(370, 400, 220), P(410, 330, 140), P(40, 390, 150), P(770, 390, 150),
            P(150, 270, 120, { crumble: 1 }), P(690, 270, 120, { crumble: 1 }), P(290, 200, 120), P(550, 200, 120)] },
  { id: 'kar', name: 'Kar Tepesi', theme: 'kar', ice: true, features: ['Buzlu zemin', 'Telesiyej'],
    desc: 'Buz yüzünden zor durursun. İki telesiyej koltuğu çapraz şekilde tepeye taşır.',
    plats: [P(60, 470, 300), P(600, 470, 300), P(330, 380, 300), P(80, 330, 80, { move: [320, -150, 7], k: 'chair' }),
            P(800, 180, 80, { move: [-320, 150, 7], k: 'chair' }), P(70, 210, 170), P(720, 260, 170), P(390, 140, 180)] },
  { id: 'pazar', name: 'Gece Pazarı', theme: 'pazar', supports: 'poles', features: ['Esnek tenteler', 'Fenerler'],
    desc: 'Tezgâh tenteleri trambolin gibidir. Ortadaki tente boşluğa düşeni kurtarabilir.',
    plats: [P(30, 480, 390), P(540, 480, 390), P(110, 410, 110, { bounce: 1000, k: 'awning' }), P(740, 410, 110, { bounce: 1000, k: 'awning' }),
            P(425, 420, 110, { bounce: 1150, k: 'awning' }), P(40, 300, 200), P(720, 300, 200), P(330, 260, 300), P(130, 160, 150), P(680, 160, 150)] },
  { id: 'gemi', name: 'Yıldız Gemisi', theme: 'gemi', g: .8, features: ['Enerji köprüleri', 'Dışarı iten bantlar'],
    desc: 'Enerji köprüleri kısa aralıklarla kapanır. Alt güverte bantları seni boşluğa doğru taşır.',
    plats: [P(30, 450, 260, { conv: -90, k: 'belt' }), P(670, 450, 260, { conv: 90, k: 'belt' }), P(290, 450, 380, { blink: [3.2, 1.8, 0], k: 'energy' }),
            P(110, 320, 200), P(650, 320, 200), P(380, 290, 200, { blink: [4, 1.6, 2.1], k: 'energy' }), P(240, 180, 170), P(550, 180, 170), P(420, 90, 120)] },
];
K.MAP = Object.fromEntries(K.MAPS.map(m => [m.id, m]));
K.isStatic = p => !p.move && !p.orbit && !p.drive && !p.blink && !p.crumble && !p.bounce;
// targets and crates for challenges, placed on each map's fixed platforms so all are reachable
function genTargets(mapId, n) {
  const st = K.MAP[mapId].plats.filter(K.isStatic).sort((a, b) => a.y - b.y);
  const out = [];
  for (let i = 0; i < n; i++) {
    const pl = st[i % st.length], f = ((i * .618) % 1) * .7 + .15;
    out.push([Math.round(Math.max(30, Math.min(930, pl.x + pl.w * f))), pl.y - (i % 3 === 2 ? 78 : 26)]);
  }
  return out;
}
function genCrates(mapId, n) {
  const st = K.MAP[mapId].plats.filter(K.isStatic);
  return Array.from({ length: n }, (_, i) => { const pl = st[(i * 3) % st.length]; return [Math.round(pl.x + pl.w * (.3 + ((i * .37) % .4))), 0]; });
}

/* ---------- visual themes ---------- */
K.THEMES = {
  insaat:    { sky: ['#231d45', '#7d3e6a', '#e0795a', '#f6b870'], sun: [705, 360, 48, '#ffe1a2'], far: ['city', '#6a3a63'], near: ['city', '#2b2140', true], deco: 'crane', plat: ['#d9643f', '#8b3425', '#62261b', 'girder'] },
  orman:     { sky: ['#0f3b2e', '#2f6b3e', '#9ac46a', '#e8f0a0'], sun: [180, 140, 40, '#fff6c0'], far: ['hills', '#2c5a3a'], near: ['trees', '#173d2b'], deco: 'vines', plat: ['#e7a24a', '#9c5f22', '#6b3d14', 'bamboo'] },
  teleferik: { sky: ['#2b6fb3', '#69a7de', '#bfe1f7', '#eaf6ff'], sun: [820, 110, 36, '#ffffff'], far: ['peaks', '#8fb3d6'], near: ['peaks', '#4f6f95'], deco: 'cables', plat: ['#e0e4ea', '#8a95a6', '#5c6677', 'metal'] },
  uzay:      { sky: ['#05050f', '#0d1030', '#1b1a45', '#2c1f4f'], planet: [760, 140, 70, '#c98bff'], stars: 1, far: ['none'], near: ['station', '#1a1d33'], deco: 'none', plat: ['#9ad7ff', '#35507a', '#1d2d48', 'metal'] },
  kanal:     { sky: ['#30245a', '#b5577a', '#f0a070', '#ffd59a'], sun: [480, 400, 60, '#ffe7b0'], far: ['city', '#7a4a6a'], near: ['houses', '#3a2a40', true], deco: 'water', plat: ['#c9b08a', '#7a6248', '#4e3e2c', 'stone'] },
  kale:      { sky: ['#1d1a2e', '#3c3456', '#7a5a7a', '#c08a7a'], sun: [200, 120, 34, '#f3efe6'], stars: 1, far: ['hills', '#3a3050'], near: ['castle', '#1e1a2a'], deco: 'flags', plat: ['#9a9aa6', '#5e5e6c', '#3e3e48', 'stone'] },
  denizalti: { sky: ['#032a3a', '#05485e', '#0b6a7a', '#0f8a8a'], far: ['reef', '#0b5060'], near: ['reef', '#06323e'], deco: 'bubbles', plat: ['#ffc531', '#7a6a2a', '#4a3f18', 'metal'] },
  otoyol:    { sky: ['#14131f', '#2a2140', '#ff6f61', '#ffb07a'], sun: [480, 420, 70, '#ffd0a0'], far: ['city', '#3a2a50'], near: ['city', '#1a1625', true], deco: 'road', plat: ['#ffc531', '#3a3a44', '#22222a', 'girder'] },
  col:       { sky: ['#d9763a', '#f0a050', '#f7cf7a', '#fbe6b0'], sun: [700, 150, 56, '#fff2c8'], far: ['dunes', '#d99a55'], near: ['dunes', '#b0703a'], deco: 'ruins', plat: ['#e8c48a', '#b08850', '#7a5a30', 'stone'] },
  kar:       { sky: ['#5a78a8', '#9ab8d8', '#d8e8f4', '#f4f8fc'], sun: [200, 110, 30, '#ffffff'], far: ['peaks', '#b8cce4'], near: ['pines', '#5a7896'], deco: 'snow', plat: ['#f4f8fc', '#9ab8d8', '#6a88a8', 'ice'] },
  pazar:     { sky: ['#0d0b1e', '#1e1638', '#3a2350', '#5a2f5a'], stars: 1, far: ['city', '#2a1f40'], near: ['houses', '#140f22', true], deco: 'lanterns', plat: ['#ff7a5a', '#7a3044', '#4a1a2a', 'wood'] },
  gemi:      { sky: ['#000008', '#08082a', '#1a0d3a', '#3a1450'], planet: [180, 380, 120, '#ff8a3d'], stars: 1, far: ['none'], near: ['none'], deco: 'hull', plat: ['#7ef0d0', '#2a5a5a', '#163636', 'neon'] },
};

/* ---------- campaign ---------- */
const AI = (diff, o) => Object.assign({ diff }, o || {});
K.CAMPAIGN = [
  { id: 'egitim',  name: 'Eğitim',            map: 'insaat', tutorial: true, desc: 'Kontrolleri öğren: yürü, zıpla, in, ateş et, dinamit at, sandık al ve kuklayı düşür.' },
  { id: 'kolay1',  name: 'Kolay Rakip',       map: 'orman', lives: 5, opp: [AI('kolay')], desc: 'Kolay bir bilgisayar rakibine karşı basit bir düello.' },
  { id: 'kolay2',  name: 'İki Kolay Rakip',   map: 'kanal', lives: 5, opp: [AI('kolay'), AI('kolay')], desc: 'Aynı anda iki kolay rakip. Arada kalma.' },
  { id: 'uclu',    name: 'Üçlü Zıplama',      map: 'teleferik', lives: 5, opp: [AI('orta', { perk: 'jump3' })], playerPerk: 'jump3', desc: 'Sen de rakibin de havada iki kez daha zıplayabiliyorsunuz.' },
  { id: 'orta1',   name: 'Orta Rakip',        map: 'kale', lives: 5, opp: [AI('orta')], desc: 'Daha hızlı nişan alan, düşerken kendini kurtaran bir rakip.' },
  { id: 'gorunmez',name: 'Görünmez Adam',     map: 'pazar', lives: 5, opp: [AI('orta', { invis: true })], desc: 'Rakibin sadece ateş ederken ve vurulunca görünüyor.' },
  { id: 'orta2',   name: 'İki Orta Rakip',    map: 'denizalti', lives: 5, opp: [AI('orta'), AI('orta')], desc: 'İki orta seviye rakip birlikte saldırıyor.' },
  { id: 'dinamit', name: 'Sadece Dinamit',    map: 'col', lives: 5, opp: [AI('orta'), AI('kolay')], rules: { dynamiteOnly: true }, desc: 'Silah yok, sınırsız dinamit var. Basılı tutup güç topla.' },
  { id: 'zor1',    name: 'Zor Rakip',         map: 'otoyol', lives: 5, opp: [AI('zor')], desc: 'Sandık kovalayan, dinamit atan zor bir rakip.' },
  { id: 'pompaci', name: 'Pompalı Çetesi',    map: 'kanal', lives: 5, opp: [AI('orta', { perk: 'shotgun', gun: 'kisanamlu' }), AI('orta', { perk: 'shotgun', gun: 'kisanamlu' })], desc: 'Rakiplerin hep Kısa Namlu taşıyor. Yakınlarına girme.' },
  { id: 'mini',    name: 'Mini Rakip',        map: 'uzay', lives: 5, opp: [AI('zor', { mini: true })], desc: 'Küçük, hızlı ve vurması zor bir rakip.' },
  { id: 'zor2',    name: 'İki Zor Rakip',     map: 'kale', lives: 6, opp: [AI('zor'), AI('zor')], desc: 'İki zor rakip aynı anda.' },
  { id: 'duello',  name: 'Kusursuz Düello',   map: 'insaat', lives: 1, oppLives: 3, opp: [AI('zor')], rules: { pistolOnly: true, crates: false }, desc: 'Tek canın var, rakibin üç. Sadece tabanca.' },
  { id: 'hizli',   name: 'Çok Hızlı',         map: 'otoyol', lives: 5, opp: [AI('zor')], rules: { speed: 1.45 }, desc: 'Oyun normalden çok daha hızlı akıyor.' },
  { id: 'silici',  name: 'Buharlaştırıcı',    map: 'gemi', lives: 3, opp: [AI('zor'), AI('orta')], rules: { oneHit: true }, desc: 'Herkeste Buharlaştırıcı var. Tek isabet öldürür.' },
  { id: 'final',   name: 'Son Sınav',         map: 'kar', lives: 6, opp: [AI('usta'), AI('zor'), AI('zor')], desc: 'Üç rakip, biri usta. Bunu geçersen Altın Tabanca açılır.' },
];

/* ---------- challenges ---------- */
K.CHALLENGES = [
  { id: 'c_tabanca', name: 'Tabanca Eğitimi',     gun: 'kartal',  map: 'insaat',    targets: genTargets('insaat', 10), stars: [37, 30, 23], desc: 'Verilen tabancayla tüm hedefleri olabildiğince hızlı vur. Sandık ve bonus yok.' },
  { id: 'c_hafif',   name: 'Hafif Makineli Eğitimi', gun: 'kivilcim', map: 'orman',  targets: genTargets('orman', 10), stars: [34, 27, 20], desc: 'Verilen hafif makineliyle tüm hedefleri vur. Sandık ve bonus yok.' },
  { id: 'c_pompa',   name: 'Pompalı Eğitimi',     gun: 'pompa',   map: 'kale',      targets: genTargets('kale', 10), stars: [36, 29, 22], desc: 'Verilen pompalıyla tüm hedefleri vur. Menzili kısa, yaklaşman gerek.' },
  { id: 'c_tufek',   name: 'Tüfek Eğitimi',       gun: 'taarruz', map: 'kanal',     targets: genTargets('kanal', 10), stars: [35, 28, 21], desc: 'Verilen tüfekle tüm hedefleri vur. Sandık ve bonus yok.' },
  { id: 'c_keskin',  name: 'Keskin Nişancı Eğitimi', gun: 'atmaca', map: 'col',     targets: genTargets('col', 10), stars: [34, 27, 20], desc: 'Verilen keskin nişancı tüfeğiyle tüm hedefleri vur. Kum fırtınasına dikkat.' },
  { id: 'c_dinamit', name: 'Dinamit Atışı',       gun: null,      map: 'denizalti', targets: genTargets('denizalti', 10), stars: [27, 20, 13], desc: 'Sadece dinamit. Basılı tutup çizgiyle nişan al; fitil bitince patlar.' },
  { id: 'c_sandik',  name: 'Sandık Toplama',      gun: 'klasik',  map: 'pazar',     crates: genCrates('pazar', 10), stars: [34, 29, 24], desc: 'Tüm sandıkları olabildiğince hızlı topla. Tenteler seni zıplatır.' },
];

K.MODES = [
  { id: 'lms',      name: 'Son Ayakta Kalan', desc: 'Herkes tek başına. Son hayatta kalan kazanır.', lives: 10 },
  { id: 'team',     name: 'Takım Savaşı',     desc: 'İki takım. Takım arkadaşının mermisi seni itmez. Son ayakta kalan takım kazanır.', lives: 10 },
  { id: 'survival', name: 'Hayatta Kalma',    desc: 'Sadece 5 can. Giderek güçlenen robot dalgalarına karşı dayanabildiğin kadar dayan.', lives: 5 },
  { id: 'onehit',   name: 'Tek Vuruş',        desc: 'Herkeste Buharlaştırıcı var. İsabet alan anında yok olur.', lives: 10 },
  { id: 'gungame',  name: 'Silah Oyunu',      desc: 'Her devirmede silahın bir üst seviyeye çıkar. Tüm silahlarla devirme yapan ilk oyuncu kazanır. Mermin bitmesin.', lives: Infinity },
  { id: 'gungamer', name: 'Ters Silah Oyunu', desc: 'Silah Oyunu’nun tersi: en güçlü silahla başlar, her devirmede daha zayıfına geçersin.', lives: Infinity },
  { id: 'jetpack',  name: 'Jetpack',          desc: 'Son Ayakta Kalan, ama herkeste jetpack var. Yakıt yavaşça dolar. Can sayısını düşük tutmak iyi olur.', lives: 5 },
];
K.MODE = Object.fromEntries(K.MODES.map(m => [m.id, m]));

/* bot profiles
   think: seconds between decisions · react: time a target must stay lined up before firing
   aimTol: vertical band (px) they consider "lined up" · spray: chance to keep firing slightly off line
   recover: chance to fight back from a fall · dodge: chance to hop over an incoming shot
   nade: dynamite rate per second · crate: interest in crates/pickups · hop: idle hopping rate
   lead: predicts where the target will be · edge: plays for the edge (pushes targets outward, avoids own edge)  */
K.DIFFS = {
  kukla: { name: 'Kukla', think: .3,  react: 99,  aimTol: 0,  spray: 0,   recover: 0,   dodge: 0,   nade: 0,   crate: 0,  hop: 0,   lead: 0, edge: 0, wobble: 0 },
  kolay: { name: 'Kolay', think: .26, react: .5,  aimTol: 16, spray: .15, recover: .6,  dodge: .05, nade: .08, crate: .4, hop: .06, lead: 0, edge: 0, wobble: 70 },
  orta:  { name: 'Orta',  think: .16, react: .3,  aimTol: 22, spray: .35, recover: .9,  dodge: .25, nade: .16, crate: .8, hop: .12, lead: 0, edge: 1, wobble: 40 },
  zor:   { name: 'Zor',   think: .1,  react: .18, aimTol: 26, spray: .5,  recover: 1,   dodge: .5,  nade: .26, crate: 1,  hop: .18, lead: 1, edge: 1, wobble: 20 },
  usta:  { name: 'Usta',  think: .06, react: .1,  aimTol: 28, spray: .6,  recover: 1,   dodge: .75, nade: .34, crate: 1,  hop: .24, lead: 1, edge: 1, wobble: 8 },
};
})();
