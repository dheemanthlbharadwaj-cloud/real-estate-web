// Factor legend shown in the Rank page drawer. Each picture is a brochure drawing with the
// highlights and scale bar already drawn on it.
window.LEGEND = [
  {
    key: "sun", title: "Sun direction",
    img: "lg-sun.webp", alt: "Sembawang Brook site plan with a coloured arrow on each unit showing where its living room windows face, and a compass for NE, SE, SW and NW",
    text: "This is the direction the unit’s living room windows face: NE, SE, SW or NW.",
    rule: "Source: sembawang-brook-6.pdf, page 9 (site plan), with facings from the floor plans on pages 13, 15, 17 and 19.",
  },
  {
    key: "wind_facing", title: "Faces the prevailing wind (SE to E)",
    img: "lg-wind-facing.webp", alt: "Sembawang Portico site plan with blue arrows blowing in from the east and south-east, and a compass showing NE and SE facings count while SW and NW do not",
    text: "Singapore’s prevailing wind comes from the south-east to east. Units only face NE, SE, SW or NW, and a NE or SE window both catch wind from the east side, so a NE or SE facing scores 1 and a SW or NW facing scores 0. The wind arrows and compass are drawn on the picture to explain the idea and are not measured.",
    rule: "Facing comes from the site plan compass and floor plans, see Sun direction. The SE to E (bearing 90 to 135 degrees) wind side is general knowledge, not from the brochure. Picture: sembawang-portico-4.pdf, page 9 (site plan).",
  },
  {
    key: "wind_open", title: "Not blocked from the wind",
    img: "lg-wind-open.webp", alt: "Kebun Baru Breeze site plan with a 30 m wedge on the south-east to east side of two units: one wedge is clear, the other is blocked by Block 247A",
    text: "This is whether no other block stands within 30 m of the unit on its SE to E side. In the picture the green wedge is clear, so that stack is open, and the red wedge runs into Block 247A, so that stack is blocked. For now these values are sample placeholders, not measured, because most brochure site plans do not give exact block outlines. Units that face NE or SE are made mostly open, the rest are a coin flip.",
    rule: "Picture: kebun-baru_breeze-5.pdf, page 9 (site plan), 30 m measured with its scale bar. The two stacks were picked by eye to show the rule.",
  },
  {
    key: "floor", title: "Floor level",
    img: "lg-floor.webp", alt: "Berlayar Rise towers with higher, middlemost and lower floors marked (artist’s impression)",
    text: "Prioritise higher or lower floors to be ranked first.",
    rule: "Source: berlayar-rise-7.pdf, page 8 (artist’s impression). Storeys from the unit distribution, pages 13 to 15.",
  },
  {
    key: "corner", title: "Corridor or corner unit",
    img: "lg-corner.webp", alt: "Block 200A floor plan with corner units and corridor units highlighted",
    text: "This is whether the unit sits at the end of the corridor (corner) or along it (corridor).",
    rule: "Source: berlayar-rise-7.pdf, page 17 (Block 200A floor plan).",
  },
  {
    key: "chute", title: "10 m away from rubbish chute",
    img: "lg-chute.webp", alt: "Block 200A floor plan with the refuse chute ringed and a near and a far unit marked",
    text: "This is whether the unit’s front door is more than 10 m from the nearest refuse chute, measured in a straight line.",
    rule: "Source: berlayar-rise-7.pdf, page 17 (Block 200A floor plan), measured with its scale bar.",
  },
  {
    key: "clearance", title: "More than 30 m from the nearest visible unit",
    img: "lg-clearance.webp", alt: "Sembawang Portico site plan with 15 m circles around four units: one overlapping pair and one pair that does not touch",
    text: "This is whether the unit is more than 30 m from the nearest visible unit in the same or neighbouring block.",
    rule: "Source: sembawang-portico-4.pdf, page 9 (site plan), measured with its scale bar.",
  },
  {
    key: "roof", title: "Access to roof",
    img: "lg-roof.webp", alt: "Block 204B floor plan with the roof at 2nd storey note highlighted",
    text: "This is whether the unit is on the same floor as an accessible roof (marked on the plan, e.g. “roof at 2nd storey only”).",
    rule: "Source: berlayar-rise-7.pdf, page 31 (Block 204B floor plan).",
  },
  {
    key: "mrt", title: "Within 100 m from MRT",
    img: "lg-mrt.webp", alt: "Berlayar Rise site plan with a 100 m circle around Telok Blangah MRT station",
    text: "This is how far the unit’s block is from the nearest MRT station in a straight 100 m line.",
    rule: "Source: berlayar-rise-7.pdf, page 12 (site plan), measured with its scale bar.",
  },
  {
    key: "mscp", title: "Within 100 m from a multi-storey car park",
    img: "lg-mscp.webp", alt: "Sembawang Portico site plan with the Block 433 car park outlined in red and a 100 m ring around it, with the distance to each residential block",
    text: "This is whether the unit’s block is within 100 m of a multi-storey car park, in a straight line from the middle of the block to the nearest edge of the car park block. The car park blocks are real, taken from the brochure site plans. The distances are estimates made by eye on those plans with the scale bar, good to about 10 m (about 20 m for Sembawang Brook), and rounded to 5 m. Berlayar Rise and Woodgrove Acres have blocks close to the 100 m line, so check them on the plan.",
    rule: "Source: the site plan page of each brochure (e.g. sembawang-portico-4.pdf, page 9), measured with its scale bar. All seven projects have a car park block, listed with the facilities.",
  },
  {
    key: "facilities", title: "Facilities nearby",
    img: "lg-facilities.webp", alt: "Sembawang Portico site plan with 30 m circles around the children’s playground and the preschool",
    text: "This is which facilities are in the unit’s block (has) or within 30 m of it (near). Facilities at the 1st storey (void deck) come from the HDB brochure site plan. Future amenities/facilities: void deck space HDB has set aside for things like preschools, eldercare or a residents’ network centre.",
    rule: "Source: sembawang-portico-4.pdf, page 9 (site plan), measured with its scale bar.",
  },
  {
    key: "design", title: "Unit design",
    img: "lg-design.webp", alt: "2-Room Flexi Type 1 and Type 2 floor plans side by side",
    text: "This is which 2-Room Flexi layout the unit has, Type 1 or Type 2.",
    rule: "Source: berlayar-rise-7.pdf, pages 17 and 31 (floor plans) and pages 13 to 15 (unit distribution).",
  },
];
// Same order as the importance panel: sun, wind, floor, design, distance, others, facilities.
(function () {
  const order = ['sun', 'wind_facing', 'wind_open', 'floor', 'design', 'clearance', 'chute', 'mrt', 'mscp', 'corner', 'roof', 'facilities'];
  const at = e => { const i = order.indexOf(e.key); return i < 0 ? order.length : i; };
  window.LEGEND = window.LEGEND.map((e, i) => [e, i]).sort((a, b) => at(a[0]) - at(b[0]) || a[1] - b[1]).map(x => x[0]);
})();
