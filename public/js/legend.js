// Legend cards: one line-drawing per factor, drawn in the same ink style as the plans.
// Diagrams are schematic (not to scale) and use currentColor so they follow the theme.
window.LEGEND = [
  {
    title: 'Sun direction', tag: 'Importance per direction',
    text: 'The compass direction the living / dining room windows face, rounded to 8 points. North–south facing units get less direct afternoon sun; west-facing units get the most.',
    rule: 'Facing = window side on the floor plan, rotated by the site plan north arrow.',
    svg: `<svg viewBox="0 0 300 150" fill="none" stroke="currentColor" stroke-width="1.2">
      <circle cx="80" cy="75" r="52" stroke-opacity=".35"/><circle cx="80" cy="75" r="2" fill="currentColor"/>
      ${['N','NE','E','SE','S','SW','W','NW'].map((d,i)=>{const a=(i*45-90)*Math.PI/180;const x=80+64*Math.cos(a),y=75+64*Math.sin(a);const x2=80+52*Math.cos(a),y2=75+52*Math.sin(a);return `<line x1="80" y1="75" x2="${x2}" y2="${y2}" stroke-opacity="${i%2?'.25':'.6'}"/><text x="${x}" y="${y+4}" font-family="Geist Mono" font-size="10" text-anchor="middle" fill="currentColor" stroke="none">${d}</text>`}).join('')}
      <rect x="180" y="50" width="90" height="50" stroke-width="1.6"/><line x1="180" y1="100" x2="270" y2="100" stroke="var(--signal)" stroke-width="4"/>
      <path d="M225 108 v26 m-6 -8 l6 8 l6 -8" stroke="var(--signal)"/><text x="225" y="44" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">UNIT</text>
      <text x="246" y="128" font-family="Geist Mono" font-size="9" fill="var(--signal)" stroke="none">S</text></svg>`,
  },
  {
    title: 'Corridor or corner unit', tag: 'Corner unit',
    text: 'A corner unit sits at the end of a row: it shares a wall with only one neighbour and has windows on two sides. Corridor units sit between two units along the common corridor.',
    rule: 'Taken from the block floor plan.',
    svg: `<svg viewBox="0 0 300 150" fill="none" stroke="currentColor" stroke-width="1.2">
      ${[0,1,2,3].map(i=>`<rect x="${30+i*60}" y="30" width="60" height="60" ${i===0||i===3?'fill="var(--signal-soft)" stroke-width="1.8"':''}/>`).join('')}
      <rect x="30" y="98" width="240" height="18" stroke-dasharray="3 3" stroke-opacity=".6"/>
      <text x="150" y="111" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">COMMON CORRIDOR</text>
      <text x="60" y="64" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">CORNER</text>
      <text x="240" y="64" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">CORNER</text>
      <text x="150" y="64" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none" opacity=".6">CORRIDOR</text>
      <path d="M26 30 v60 M30 26 h60" stroke="var(--signal)" stroke-width="3"/></svg>`,
  },
  {
    title: 'Distance from lift', tag: 'Distance from lift (further)',
    text: 'Straight-line metres from the unit\'s main door to the lift lobby. Closer is convenient; further is quieter. Set a positive importance if you prefer further away.',
    rule: 'Measured on the floor plan with its scale bar. "Near" = within 15 m.',
    svg: `<svg viewBox="0 0 300 150" fill="none" stroke="currentColor" stroke-width="1.2">
      <rect x="20" y="40" width="60" height="70"/>${[0,1].map(i=>`<rect x="${28+i*24}" y="50" width="20" height="20"/><path d="M${28+i*24} 50 l20 20 m0 -20 l-20 20" stroke-opacity=".5"/>`).join('')}
      <text x="50" y="98" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">LIFTS</text>
      <rect x="200" y="40" width="80" height="70" fill="var(--green-soft)"/><text x="240" y="80" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">UNIT</text>
      <path d="M80 75 H200" stroke="var(--signal)" stroke-dasharray="4 3"/><path d="M80 70 v10 M200 70 v10" stroke="var(--signal)"/>
      <text x="140" y="66" font-family="Geist Mono" font-size="10" text-anchor="middle" fill="var(--signal)" stroke="none">23 m</text></svg>`,
  },
  {
    title: 'Distance from rubbish chute', tag: 'Distance from rubbish chute (further)',
    text: 'Straight-line metres from the unit\'s door to the nearest refuse chute (next to the wash area). Further usually means fewer smells and less noise.',
    rule: 'Measured on the floor plan with its scale bar. "Near" = within 10 m.',
    svg: `<svg viewBox="0 0 300 150" fill="none" stroke="currentColor" stroke-width="1.2">
      <rect x="20" y="45" width="56" height="56"/><path d="M28 53 h40 v40 h-40z" stroke-opacity=".5"/><path d="M28 53 l40 40 M68 53 l-40 40" stroke-opacity=".4"/>
      <text x="48" y="118" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">CHUTE</text>
      <rect x="120" y="45" width="60" height="56" fill="var(--signal-soft)"/><rect x="220" y="45" width="60" height="56" fill="var(--green-soft)"/>
      <text x="150" y="77" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">NEAR</text>
      <text x="250" y="77" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">FAR</text>
      <path d="M76 30 H250" stroke="var(--signal)" stroke-dasharray="4 3"/><path d="M76 25 v10 M150 25 v10 M250 25 v10" stroke="var(--signal)"/></svg>`,
  },
  {
    title: 'More than 30 m from neighbouring blocks', tag: 'Importance + privacy filter',
    text: 'Each unit gets a 15 m circle around its centre on the site plan. If two circles from facing units overlap, the units are less than 30 m apart. The privacy filter hides units whose windows face another unit closer than 30 m.',
    rule: 'Measured on the site plan with its scale bar.',
    svg: `<svg viewBox="0 0 300 150" fill="none" stroke="currentColor" stroke-width="1.2">
      <rect x="40" y="20" width="70" height="40"/><rect x="40" y="95" width="70" height="40"/><rect x="190" y="20" width="70" height="40"/>
      <circle cx="75" cy="40" r="30" fill="var(--signal-soft)" fill-opacity=".7" stroke="var(--signal)"/><circle cx="75" cy="115" r="30" fill="var(--signal-soft)" fill-opacity=".7" stroke="var(--signal)"/>
      <circle cx="225" cy="40" r="30" fill="var(--green-soft)" fill-opacity=".7" stroke="var(--green)"/>
      <text x="150" y="85" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">r = 15 m</text>
      <text x="75" y="80" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="var(--signal)" stroke="none">&lt; 30 m</text>
      <text x="225" y="88" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="var(--green)" stroke="none">&gt; 30 m</text></svg>`,
  },
  {
    title: 'Access to roof', tag: 'Access to roof',
    text: 'The unit looks onto or adjoins a roof marked on the floor plan, e.g. "ROOF AT 2ND STOREY ONLY". Usually only applies on the storey just above the roof.',
    rule: 'From floor plan annotations, per storey.',
    svg: `<svg viewBox="0 0 300 150" fill="none" stroke="currentColor" stroke-width="1.2">
      ${[0,1,2,3].map(i=>`<rect x="40" y="${20+i*28}" width="80" height="28" ${i===2?'fill="var(--green-soft)"':''}/>`).join('')}
      <path d="M120 104 H270 V132 H120" fill="var(--paper-2)"/><path d="M120 104 H270" stroke-width="2.5"/>
      <text x="195" y="122" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">ROOF AT 2ND STOREY</text>
      <text x="80" y="94" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">#03</text>
      <path d="M126 90 q30 -10 50 6" stroke="var(--signal)"/><path d="M170 90 l6 6 l-8 2" stroke="var(--signal)"/></svg>`,
  },
  {
    title: 'Near MRT', tag: 'Near MRT',
    text: 'Straight-line distance from the unit\'s block to the nearest MRT station. "Near" means within 400 m, about a 5-minute walk.',
    rule: 'From the site plan, or the location plan when the station is off the site plan.',
    svg: `<svg viewBox="0 0 300 150" fill="none" stroke="currentColor" stroke-width="1.2">
      <circle cx="80" cy="75" r="60" stroke-dasharray="3 4" stroke-opacity=".6"/><rect x="66" y="62" width="28" height="26"/>
      <text x="80" y="128" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">400 m</text>
      <rect x="210" y="58" width="56" height="34" rx="17" fill="var(--green)" stroke="none"/><text x="238" y="79" font-family="Geist Mono" font-size="10" text-anchor="middle" fill="var(--sheet)" stroke="none">MRT</text>
      <path d="M94 75 H210" stroke="var(--signal)" stroke-dasharray="4 3"/></svg>`,
  },
  {
    title: 'Facilities nearby', tag: 'Facilities nearby',
    text: '"Has" = the facility is in the unit\'s own block (e.g. at its 1st storey or on its roof). "Near" = the facility is not in any residential block but is within 50 m of the unit. A "has" counts twice as much as a "near".',
    rule: 'Facility markers from the site plan legend: playgrounds, fitness stations, pavilions, preschool, RN centre, shops, eating house, supermarket and more.',
    svg: `<svg viewBox="0 0 300 150" fill="none" stroke="currentColor" stroke-width="1.2">
      <rect x="30" y="40" width="90" height="70" fill="var(--green-soft)"/><text x="75" y="100" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">YOUR BLOCK</text>
      <circle cx="75" cy="68" r="11" fill="var(--ink)" stroke="none"/><text x="75" y="72" font-family="Geist Mono" font-size="11" text-anchor="middle" fill="var(--sheet)" stroke="none">5</text>
      <circle cx="75" cy="75" r="100" stroke-dasharray="3 4" stroke-opacity=".35"/>
      <circle cx="190" cy="60" r="11" fill="var(--ink)" stroke="none"/><text x="190" y="64" font-family="Geist Mono" font-size="11" text-anchor="middle" fill="var(--sheet)" stroke="none">1</text>
      <text x="75" y="30" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">HAS</text>
      <text x="190" y="88" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">NEAR ≤ 50 m</text></svg>`,
  },
  {
    title: 'Unit design', tag: '2-Room Flexi only',
    text: '2-Room Flexi flats come in Type 1 and Type 2 layouts, shown in different colours on the unit distribution grid. The meter only appears when your selected blocks contain 2-Room Flexi units.',
    rule: 'From the unit distribution legend.',
    svg: `<svg viewBox="0 0 300 150" fill="none" stroke="currentColor" stroke-width="1.2">
      <rect x="40" y="30" width="90" height="90" fill="#fde2d1" stroke-opacity=".8"/><rect x="170" y="30" width="90" height="90" fill="#e27f68" fill-opacity=".55"/>
      <path d="M40 80 h50 v40 M170 70 h40 v50" stroke-opacity=".6"/>
      <text x="85" y="140" font-family="Geist Mono" font-size="10" text-anchor="middle" fill="currentColor" stroke="none">TYPE 1</text>
      <text x="215" y="140" font-family="Geist Mono" font-size="10" text-anchor="middle" fill="currentColor" stroke="none">TYPE 2</text></svg>`,
  },
  {
    title: 'Floor level', tag: 'Filter + floor priority',
    text: 'Choose the lowest and highest storey you\'d accept, then whether to prioritise higher, middle or lower floors. Priority is relative to each block\'s own height, so a 16-storey and a 48-storey block are treated fairly.',
    rule: 'Storeys from the unit distribution grid.',
    svg: `<svg viewBox="0 0 300 150" fill="none" stroke="currentColor" stroke-width="1.2">
      ${Array.from({length:10},(_,i)=>`<rect x="40" y="${12+i*12.5}" width="60" height="12.5" ${i<3?'fill="var(--green-soft)"':''}/>`).join('')}
      ${Array.from({length:6},(_,i)=>`<rect x="170" y="${62+i*12.5}" width="60" height="12.5" ${i<2?'fill="var(--green-soft)"':''}/>`).join('')}
      <text x="70" y="146" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">48 STOREYS</text>
      <text x="200" y="146" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">16 STOREYS</text>
      <text x="135" y="42" font-family="Geist Mono" font-size="9" text-anchor="middle" fill="var(--green)" stroke="none">TOP 30%</text></svg>`,
  },
];
