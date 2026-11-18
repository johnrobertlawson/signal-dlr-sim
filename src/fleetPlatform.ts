// A small indexed sprite is drawn once per outfit and scaled with nearest-neighbour sampling.
const figures = [
  ['...hhh..','...hss..','...ss...','..cccc..','..accca.','..accca.','..scccs.','...ccc..','...ppp..','...p.p..','...p.p..','..ff.ff.'],
  ['...hh...','..hhsh..','..hssh..','...cc...','..cccc..','.acccca.','.sccccs.','..cccc.b','..ppp.bb','..p.p.bb','..p.p...','.ff.ff..'],
  ['..aaaa..','..hss...','...ss...','..cccc..','.accbbc.','.accbbc.','.sccbbc.','..cccc..','..pppp..','..p..p..','..p..p..','.ff..ff.'],
];
const sprites = new Map<number, HTMLCanvasElement>();
export function passengerSprite(index: number) {
  const key = index % 12;
  const cached = sprites.get(key);
  if (cached) return cached;
  const image = document.createElement('canvas');
  image.width = 8; image.height = 12;
  const ctx = image.getContext('2d')!;
  const coat = ['#b36145','#526f91','#728757','#a8778d'][key%4];
  const colours: Record<string,string> = {
    h: '#514039', s: ['#dbaa87','#8d624e','#bb8966'][key%3], c: coat,
    a: '#655668', p: '#404855', f: '#302e36', b: '#ab8652',
  };
  figures[key%3].forEach((row,y) => [...row].forEach((pixel,x) => {
    if (pixel === '.') return;
    ctx.fillStyle = colours[pixel]; ctx.fillRect(x,y,1,1);
  }));
  sprites.set(key,image);
  return image;
}

const lineColours: Record<string,string> = {
  Central: '#e1251b', Circle: '#ffd329', District: '#00843d', Northern: '#26282b',
  Jubilee: '#a0a5a9', 'Waterloo & City': '#93ceba', 'Hammersmith & City': '#e899ad',
  'Elizabeth line': '#9170b8', 'Mildmay line': '#68a5dc', 'Windrush line': '#e95240',
  Metropolitan: '#9b0056', 'National Rail': '#e34a45', 'River services': '#4397ca',
};
export function lineColour(label: string) {
  return lineColours[label.split(/ · | via /)[0]] ?? '#3e9d9f';
}
