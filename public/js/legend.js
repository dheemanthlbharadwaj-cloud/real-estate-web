// Factor legend shown in the Rank page drawer. Each picture is a brochure drawing with the
// highlights and scale bar already drawn on it.
window.LEGEND = [
  {
    key: "sun", title: "Sun direction", tag: "Importance per direction",
    img: "lg-sun.webp", alt: "Woodgrove Acres site plan with a compass laid over it",
    text: "This is the direction the unit’s living room windows face.",
    rule: "Source: woodgrove-acres-3.pdf, page 9 (site plan).",
  },
  {
    key: "floor", title: "Floor level", tag: "Filter and floor priority",
    img: "lg-floor.webp", alt: "Berlayar Rise towers with higher, middlemost and lower floors marked (artist’s impression)",
    text: "This is the storey range you’d accept, and whether higher or lower floors rank first.",
    rule: "Source: berlayar-rise-7.pdf, page 8 (artist’s impression). Storeys from the unit distribution, pages 13 to 15.",
  },
  {
    key: "corner", title: "Corridor or corner unit", tag: "Corner unit",
    img: "lg-corner.webp", alt: "Block 200A floor plan with corner units and corridor units highlighted",
    text: "This is whether the unit sits at the end of the corridor (corner) or along it (corridor).",
    rule: "Source: berlayar-rise-7.pdf, page 17 (Block 200A floor plan).",
  },
  {
    key: "chute", title: "Distance from rubbish chute", tag: "Further is better",
    img: "lg-chute.webp", alt: "Block 200A floor plan with the refuse chute ringed and a near and a far unit marked",
    text: "This is how far the unit’s front door is from the nearest refuse chute in a straight line.",
    rule: "Source: berlayar-rise-7.pdf, page 17 (Block 200A floor plan), measured with its scale bar.",
  },
  {
    key: "clearance", title: "More than 30 m from the next block", tag: "Importance",
    img: "lg-clearance.webp", alt: "Sembawang Portico site plan with 15 m circles around four units: one overlapping pair and one pair that does not touch",
    text: "This is whether the unit is more than 30 m from the nearest unit in a neighbouring block.",
    rule: "Source: sembawang-portico-4.pdf, page 9 (site plan), measured with its scale bar.",
  },
  {
    key: "roof", title: "Access to roof", tag: "Access to roof",
    img: "lg-roof.webp", alt: "Block 204B floor plan with the roof at 2nd storey note highlighted",
    text: "This is whether the unit is on the same floor as an accessible roof (marked on the plan, e.g. “roof at 2nd storey only”).",
    rule: "Source: berlayar-rise-7.pdf, page 31 (Block 204B floor plan).",
  },
  {
    key: "mrt", title: "Near MRT", tag: "Near MRT",
    img: "lg-mrt.webp", alt: "Berlayar Rise site plan with a 100 m circle around Telok Blangah MRT station",
    text: "This is how far the unit’s block is from the nearest MRT station in a straight 100 m line.",
    rule: "Source: berlayar-rise-7.pdf, page 12 (site plan), measured with its scale bar.",
  },
  {
    key: "facilities", title: "Facilities nearby", tag: "One meter per facility",
    img: "lg-facilities.webp", alt: "Sembawang Portico site plan with 30 m circles around the children’s playground and the preschool",
    text: "This is which facilities are in the unit’s block (has) or within 30 m of it (near).",
    rule: "Source: sembawang-portico-4.pdf, page 9 (site plan), measured with its scale bar.",
  },
  {
    key: "design", title: "Unit design", tag: "2-Room Flexi only",
    img: "lg-design.webp", alt: "2-Room Flexi Type 1 and Type 2 floor plans side by side",
    text: "This is which 2-Room Flexi layout the unit has, Type 1 or Type 2.",
    rule: "Source: berlayar-rise-7.pdf, pages 17 and 31 (floor plans) and pages 13 to 15 (unit distribution).",
  },
];
