// Factor legend shown in the Rank page drawer. Every visual is a real brochure drawing or the
// project's own annotated screenshot; labels are HTML pins placed by percentage (x, y).
window.LEGEND = [
  {
    key: 'sun', title: 'Sun direction', tag: 'Importance per direction',
    img: 'sun.webp', alt: 'Floor plan of 4-room units 113 and 115 with living and dining windows along the top edge',
    pins: [{ x: 50, y: 6, text: 'Living room windows', dir: 'up' }, { x: 50, y: 90, text: 'The way these windows face is the unit’s facing' }],
    text: 'We look at which side the living and dining room windows are on, then turn that into one of eight compass points using the site plan’s north arrow. North and south facing homes get the least direct afternoon sun; west facing homes get the most.',
    rule: 'Source: block floor plan and site plan north arrow.',
  },
  {
    key: 'floor', title: 'Floor level', tag: 'Filter and floor priority',
    img: 'floors.webp', alt: 'Berlayar Rise towers (artist’s impression)',
    bands: true,
    text: 'Pick the lowest and highest storey you would accept, then choose whether higher, middle or lower floors should rank first. Priority is worked out against each block’s own height, so a 33 storey block and a 49 storey block are treated fairly.',
    rule: 'Source: unit distribution grid.',
  },
  {
    key: 'corner', title: 'Corridor or corner unit', tag: 'Corner unit',
    img: 'plan-200a.webp', alt: 'Block 200A floor plan with a corner unit and a corridor unit highlighted',
    marks: [
      { type: 'box', x: 2.9, y: 7.6, w: 24.7, h: 23.4, tone: 'sea', label: 'Corner unit: end of the row, windows on two sides' },
      { type: 'box', x: 61.2, y: 41.2, w: 18.8, h: 24.6, tone: 'navy', label: 'Corridor unit: door opens onto the common corridor' },
    ],
    text: 'A corner unit sits at the end of a row. It shares a wall with one neighbour and usually has windows on two sides. Corridor units sit along the common corridor, next to other units.',
    rule: 'Source: block floor plan (Berlayar Rise, Block 200A).',
  },

  {
    key: 'chute', title: 'Distance from rubbish chute', tag: 'Further is better',
    img: 'plan-200a.webp', alt: 'Block 200A floor plan with the refuse chute ringed',
    marks: [
      { type: 'ring', x: 22.7, y: 45, d: 7, label: 'Refuse chute' },
      { type: 'box', x: 2.9, y: 7.6, w: 24.7, h: 23.4, tone: 'navy', label: 'Close to the chute' },
      { type: 'box', x: 64.7, y: 68.6, w: 30.6, h: 31, tone: 'sea', label: 'Far from the chute' },
    ],
    text: 'Straight line distance from the unit’s front door to the nearest refuse chute, measured with the floor plan’s scale bar. Further usually means less smell and less noise. A unit within 10 m counts as near.',
    rule: 'Source: block floor plan, measured with its scale bar.',
  },

  {
    key: 'lift', title: 'Distance from lift', tag: 'Closer or further, your call',
    img: 'lift.webp', alt: 'Floor plan showing the lift lobby between two rows of units',
    pins: [{ x: 70, y: 62, text: 'Lift lobby' }, { x: 42, y: 12, text: 'Front doors open onto the corridor' }],
    text: 'Straight line distance from the front door to the lift lobby. Close is convenient; further away is quieter. Slide the meter to plus if you would rather be further away. Within 15 m counts as near.',
    rule: 'Source: block floor plan, measured with its scale bar.',
  },
  {
    key: 'clearance', title: 'More than 30 m from the next block', tag: 'Importance and privacy filter',
    img: 'site-privacy.webp', alt: 'Site plan of blocks 200A and 200B with a 15 m ring around one unit in each block',
    marks: [
      { type: 'ring', x: 14, y: 48, d: 16.4, label: '15 m' },
      { type: 'ring', x: 42.9, y: 46.5, d: 16.4, label: '15 m' },
      { type: 'line', x1: 14, x2: 42.9, y: 47.2, label: 'Rings do not touch: more than 30 m apart' },
    ],
    text: 'Each unit gets a 15 m ring around its centre on the site plan, drawn to the plan’s scale. If the rings of two facing units overlap, the units are less than 30 m apart. Switch on the privacy filter to hide every unit whose windows face another home closer than 30 m.',
    rule: 'Source: site plan, measured with its scale bar.',
  },

  {
    key: 'roof', title: 'Access to roof', tag: 'Access to roof',
    img: 'plan-204b.webp', alt: 'Block 204B floor plan with the roof at 2nd storey notes highlighted',
    marks: [
      { type: 'box', x: 12.5, y: 61, w: 14.5, h: 17, tone: 'sea', label: 'Note on the plan: roof at 2nd storey only' },
    ],
    text: 'Some units look onto, or step out towards, a roof drawn on the floor plan, such as “roof at 2nd storey only”. This usually applies only on the storey just above that roof.',
    rule: 'Source: floor plan annotations, per storey (Berlayar Rise, Block 204B).',
  },

  {
    key: 'mrt', title: 'Near MRT', tag: 'Near MRT',
    img: 'site-mrt.webp', alt: 'Northern part of the Berlayar Rise site plan with Telok Blangah MRT station',
    marks: [
      { type: 'ring', x: 65.6, y: 24, d: 73.8, label: '100 m' },
    ],
    pins: [{ x: 65.6, y: 13, text: 'Telok Blangah MRT' }],
    text: 'Straight line distance from the unit’s block to the nearest MRT station, measured with the site plan’s scale bar. Within 400 m, roughly a five minute walk, counts as near. The ring shows 100 m to scale.',
    rule: 'Source: site plan, or the location plan when the station sits outside the site.',
  },

  {
    key: 'facilities', title: 'Facilities nearby', tag: 'Has and near',
    img: 'facilities.webp', alt: 'Site plan detail with numbered facility markers around blocks 201B and 204A',
    img2: 'facilities-key.webp', alt2: 'Facilities key from the site plan',
    pins: [{ x: 66, y: 22, text: 'RN centre inside block 201B: “has” for 201B' }, { x: 16, y: 40, text: 'Playgrounds in the open: “near”' }],
    text: '“Has” means the facility is in your own block, for example at its first storey or on its roof. “Near” means it is not inside any residential block but sits within 50 m of your unit. A “has” counts twice as much as a “near”.',
    rule: 'Source: numbered markers on the site plan and its legend.',
  },
  {
    key: 'design', title: 'Unit design', tag: '2-Room Flexi only',
    img: 'rf1.webp', alt: '2-Room Flexi Type 1 floor plan', cap: 'Type 1',
    img2: 'rf2.webp', alt2: '2-Room Flexi Type 2 floor plan', cap2: 'Type 2',
    text: '2-Room Flexi flats come in two layouts, Type 1 and Type 2, shown in different colours on the unit distribution grid. This meter only appears when your selected blocks contain 2-Room Flexi units.',
    rule: 'Source: unit distribution legend and floor plans.',
  },
];
