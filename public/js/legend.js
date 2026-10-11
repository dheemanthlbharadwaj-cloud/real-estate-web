// Factor legend shown in the Rank page drawer. Each picture is a brochure drawing with the
// highlights and scale bar already drawn on it.
window.LEGEND = [
  {
    key: "sun", title: "Sun direction", tag: "Importance per direction",
    img: "lg-sun.webp", alt: "Kebun Baru Breeze site plan with a compass laid over it",
    text: "We lay a compass over the site plan, lined up with the plan's north arrow, and check which way each unit's living room windows face. That gives one of eight directions. North and south facing units get the least direct afternoon sun, and west facing units get the most.",
    rule: "Source: kebun-baru_breeze-5.pdf, page 9 (site plan).",
  },
  {
    key: "floor", title: "Floor level", tag: "Filter and floor priority",
    img: "lg-floor.webp", alt: "Berlayar Rise towers with higher, middlemost and lower floors marked (artist's impression)",
    text: "Set the lowest and highest storey you would accept, then choose whether higher or lower floors rank first. Floor priority is measured against each block's own height, so a 33 storey block and a 49 storey block are compared fairly. The Rank page also lists every matching unit on the highest, middlemost and lowest storeys of your list.",
    rule: "Source: berlayar-rise-7.pdf, page 8 (artist's impression). Storeys from the unit distribution, pages 13 to 15.",
  },
  {
    key: "corner", title: "Corridor or corner unit", tag: "Corner unit",
    img: "lg-corner.webp", alt: "Block 200A floor plan with corner units and corridor units highlighted",
    text: "A corner unit sits at the end of the corridor. It shares a wall with only one neighbour and usually has windows on two sides. A corridor unit's front door opens onto the common corridor, between other units.",
    rule: "Source: berlayar-rise-7.pdf, page 17 (Block 200A floor plan).",
  },
  {
    key: "chute", title: "Distance from rubbish chute", tag: "Further is better",
    img: "lg-chute.webp", alt: "Block 200A floor plan with the refuse chute ringed and a near and a far unit marked",
    text: "We measure the straight line distance from the unit's front door to the nearest refuse chute, using the floor plan's scale bar. Units further away usually get less smell and noise. A unit within 10 m counts as near.",
    rule: "Source: berlayar-rise-7.pdf, page 17 (Block 200A floor plan), measured with its scale bar.",
  },
  {
    key: "clearance", title: "More than 30 m from the next block", tag: "Importance",
    img: "lg-clearance.webp", alt: "Sembawang Portico site plan with 15 m circles around four units: one overlapping pair and one pair that does not touch",
    text: "Each unit gets a 15 m circle around its centre, drawn to the site plan's scale. If the circles of two units in neighbouring blocks overlap (red), the units are less than 30 m apart. If the circles don't touch (green), there is more than 30 m between them.",
    rule: "Source: sembawang-portico-4.pdf, page 9 (site plan), measured with its scale bar.",
  },
  {
    key: "roof", title: "Access to roof", tag: "Access to roof",
    img: "lg-roof.webp", alt: "Block 204B floor plan with the roof at 2nd storey note highlighted",
    text: "Some units look onto, or step out towards, a roof drawn on the floor plan, marked for example \"roof at 2nd storey only\". This usually applies only to the storey just above that roof.",
    rule: "Source: berlayar-rise-7.pdf, page 31 (Block 204B floor plan).",
  },
  {
    key: "mrt", title: "Near MRT", tag: "Near MRT",
    img: "lg-mrt.webp", alt: "Berlayar Rise site plan with a 100 m circle around Telok Blangah MRT station",
    text: "We measure the straight line distance from the unit's block to the nearest MRT station with the site plan's scale bar. Within 400 m, about a five minute walk, counts as near. The circle shows 100 m to scale.",
    rule: "Source: berlayar-rise-7.pdf, page 12 (site plan), measured with its scale bar.",
  },
  {
    key: "facilities", title: "Facilities nearby", tag: "One meter per facility",
    img: "lg-facilities.webp", alt: "Sembawang Portico site plan with 30 m circles around the children's playground and the preschool",
    text: "Each facility gets a 30 m circle on the site plan, drawn to scale. A unit inside the circle counts as near that facility. A facility inside your own block, such as a preschool on the first storey, counts as has. Every facility type in your selected blocks gets its own meter, where a has counts fully and a near counts half.",
    rule: "Source: sembawang-portico-4.pdf, page 9 (site plan), measured with its scale bar.",
  },
  {
    key: "design", title: "Unit design", tag: "2-Room Flexi only",
    img: "lg-design.webp", alt: "2-Room Flexi Type 1 and Type 2 floor plans side by side",
    text: "2-Room Flexi flats come in two layouts, Type 1 and Type 2, which the unit distribution grid shows in different colours. This meter only appears when your selected blocks contain 2-Room Flexi units.",
    rule: "Source: berlayar-rise-7.pdf, pages 17 and 31 (floor plans) and pages 13 to 15 (unit distribution).",
  },
];
