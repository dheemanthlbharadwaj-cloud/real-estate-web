// Factor legend shown in the Rank page drawer. rule: "scale" = source link + measured with its scale bar, "plain" = source link only.
// Each picture is a brochure drawing with the highlights and scale bar already drawn on it.
window.LEGEND = [
  {
    key: "sun", title: "Sun direction",
    img: "lg-sun.webp", alt: "Sembawang Brook site plan with a coloured arrow on each unit showing where its living room windows face, and a compass for NE, SE, SW and NW",
    text: "This is the direction the unit’s living room windows face: NE, SE, SW or NW.",
    rule: "plain",
  },
  {
    key: "wind_facing", title: "Faces the prevailing wind (SE to E)",
    img: "lg-wind-facing.webp", alt: "Sembawang Portico site plan with blue arrows blowing in from the east and south-east, and a compass showing NE and SE facings count while SW and NW do not",
    text: "Singapore’s prevailing wind comes from the south-east to east. Units only face NE, SE, SW or NW, and a NE or SE window both catch wind from the east side, so a NE or SE facing scores 1 and a SW or NW facing scores 0. The wind arrows and compass are drawn on the picture to explain the idea and are not measured.",
    rule: "plain",
  },
  {
    key: "wind_open", title: "Not blocked from the wind",
    img: "lg-wind-open.webp", alt: "Kebun Baru Breeze site plan with a 30 m wedge on the south-east to east side of two units: one wedge is clear, the other is blocked by Block 247A",
    text: "This is whether no other block stands within 30 m of the unit on its SE to E side. In the picture the green wedge is clear, so that stack is open, and the red wedge runs into Block 247A, so that stack is blocked.",
    rule: "scale",
  },
  {
    key: "floor", title: "Floor level",
    img: "lg-floor.webp", alt: "Berlayar Rise towers with higher, middlemost and lower floors marked (artist’s impression)",
    text: "Prioritise higher or lower floors to be ranked first.",
    rule: "plain",
  },
  {
    key: "corner", title: "Corridor or corner unit",
    img: "lg-corner.webp", alt: "Block 200A floor plan with corner units and corridor units highlighted",
    text: "This is whether the unit sits at the end of the corridor (corner) or along it (corridor).",
    rule: "plain",
  },
  {
    key: "chute", title: "10 m away from rubbish chute",
    img: "lg-chute.webp", alt: "Block 200A floor plan with the refuse chute ringed and a near and a far unit marked",
    text: "This is whether the unit’s front door is more than 10 m from the nearest refuse chute, measured in a straight line.",
    rule: "scale",
  },
  {
    key: "clearance", title: "More than 30 m from the nearest visible unit",
    img: "lg-clearance.webp", alt: "Sembawang Portico site plan with 15 m circles around four units: one overlapping pair and one pair that does not touch",
    text: "This is whether the unit is more than 30 m from the nearest visible unit in the same or neighbouring block.",
    rule: "scale",
  },
  {
    key: "mrt", title: "Within 100 m from MRT",
    img: "lg-mrt.webp", alt: "Berlayar Rise site plan with a 100 m circle around Telok Blangah MRT station",
    text: "This is whether the unit’s block is within 100 m of the nearest MRT station, in a straight line from the nearest edge of the block.",
    rule: "scale",
  },
  {
    key: "mscp", title: "Within 100 m from a multi-storey car park",
    img: "lg-mscp.webp", alt: "Sembawang Portico site plan with the Block 433 car park outlined in red and a 100 m ring around it, with the distance to each residential block",
    text: "This is whether the unit’s block is within 100 m of a multi-storey car park, in a straight line from the nearest edge of the block to the nearest edge of the car park.",
    rule: "scale",
  },
  {
    key: "facilities", title: "Facilities nearby",
    img: "lg-facilities.webp", alt: "Sembawang Portico site plan with 30 m circles around the children’s playground and the preschool",
    text: "This is which facilities are in the unit’s block (has) or within 30 m of any part of the block (near). Every unit in a block gets the same facilities. Facilities at the 1st storey (void deck) come from the HDB brochure site plan. Future amenities/facilities: void deck space HDB has set aside for things like preschools, eldercare or a residents’ network centre.",
    rule: "scale",
  },
  {
    key: "design", title: "Unit design",
    img: "lg-design.webp", alt: "2-Room Flexi Type 1 and Type 2 floor plans side by side",
    text: "This is which 2-Room Flexi layout the unit has, Type 1 or Type 2.",
    rule: "plain",
  },
];
// Same order as the importance panel: sun, wind, floor, design, distance, others, facilities.
(function () {
  const order = ['sun', 'wind_facing', 'wind_open', 'floor', 'design', 'clearance', 'chute', 'mrt', 'mscp', 'corner', 'roof', 'facilities'];
  const at = e => { const i = order.indexOf(e.key); return i < 0 ? order.length : i; };
  window.LEGEND = window.LEGEND.map((e, i) => [e, i]).sort((a, b) => at(a[0]) - at(b[0]) || a[1] - b[1]).map(x => x[0]);
})();
