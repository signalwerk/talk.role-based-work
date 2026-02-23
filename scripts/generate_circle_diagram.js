import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const width = 1000;
const height = 1000;
const cx = width / 2;
const cy = height / 2;

const baseR = Math.min(width, height) * 0.2; // 20% of min dimension

const orgData = {
  id: "allg",
  name: "Allgemeiner Kreis",
  roles: 8,
  r: baseR,
  children: [
    {
      id: "abt1",
      name: "Abteilungskreis",
      r: baseR * 0.55,
      angle: 220, // Angle relative to parent
      // overlap: 0.15, // Fraction of sum of radii to overlap
      children: [
        {
          id: "team1",
          name: "Team",
          r: baseR * 0.3,
          angle: 170,
          overlap: 0.15,
        },
        {
          id: "team2",
          name: "Team",
          r: baseR * 0.3,
          angle: 270,
          overlap: 0.15,
        },
      ],
    },
    {
      id: "abt2",
      name: "Abteilungskreis",
      r: baseR * 0.55,
      angle: 140,
      children: [],
    },
    {
      id: "abt3",
      name: "Abteilungskreis",
      r: baseR * 0.55,
      angle: 40,
      children: [
        {
          id: "team3",
          name: "Team",
          r: baseR * 0.3,
          angle: 350,
          overlap: 0.15,
        },
        { id: "team4", name: "Team", r: baseR * 0.3, angle: 90, overlap: 0.15 },
      ],
    },
  ],
};

function getIntersections(x0, y0, r0, x1, y1, r1) {
  let d = Math.hypot(x1 - x0, y1 - y0);
  if (d > r0 + r1 || d < Math.abs(r0 - r1) || d === 0) return null;

  let a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  let h = Math.sqrt(r0 * r0 - a * a);
  let x2 = x0 + (a * (x1 - x0)) / d;
  let y2 = y0 + (a * (y1 - y0)) / d;

  let rx = (-h * (y1 - y0)) / d;
  let ry = (h * (x1 - x0)) / d;

  return [
    { x: x2 + rx, y: y2 + ry },
    { x: x2 - rx, y: y2 - ry },
  ];
}

const circles = [];
const specialNodes = [];
const regularNodes = [];
const connections = [];

function processNode(node, parentCx, parentCy, parentR) {
  let currentCx = parentCx;
  let currentCy = parentCy;

  if (node.id !== "allg") {
    const dist = (parentR + node.r) * (1 - (node.overlap || 0.15));
    currentCx = parentCx + dist * Math.cos((node.angle * Math.PI) / 180);
    currentCy = parentCy + dist * Math.sin((node.angle * Math.PI) / 180);
  }

  const circleObj = {
    id: node.id,
    name: node.name,
    cx: currentCx,
    cy: currentCy,
    r: node.r,
    roles: node.roles || 5,
  };
  circles.push(circleObj);

  if (node.children) {
    node.children.forEach((child) => {
      const childDist = (node.r + child.r) * (1 - (child.overlap || 0.15));
      connections.push([
        circleObj,
        {
          id: child.id,
          cx: currentCx + childDist * Math.cos((child.angle * Math.PI) / 180),
          cy: currentCy + childDist * Math.sin((child.angle * Math.PI) / 180),
          r: child.r,
        },
      ]);
      processNode(child, currentCx, currentCy, node.r);
    });
  }
}

processNode(orgData, cx, cy, 0);

connections.forEach(([c1, c2]) => {
  let pts = getIntersections(c1.cx, c1.cy, c1.r, c2.cx, c2.cy, c2.r);
  if (pts) {
    specialNodes.push({
      x: pts[0].x,
      y: pts[0].y,
      type: "leiter",
      circles: [c1.id, c2.id],
    });
    specialNodes.push({
      x: pts[1].x,
      y: pts[1].y,
      type: "delegierter",
      circles: [c1.id, c2.id],
    });
  }
});

function addRegularNodes(circle, count) {
  let nodesOnCircle = specialNodes.filter((n) => n.circles.includes(circle.id));

  if (nodesOnCircle.length === 0) {
    for (let i = 0; i < count; i++) {
      let angle = (i / count) * Math.PI * 2;
      regularNodes.push({
        x: circle.cx + circle.r * Math.cos(angle),
        y: circle.cy + circle.r * Math.sin(angle),
        type: "regular",
      });
    }
    return;
  }

  let angles = nodesOnCircle
    .map((n) => {
      let a = Math.atan2(n.y - circle.cy, n.x - circle.cx);
      if (a < 0) a += Math.PI * 2;
      return a;
    })
    .sort((a, b) => a - b);

  let gaps = [];
  for (let i = 0; i < angles.length; i++) {
    let next = (i + 1) % angles.length;
    let diff = angles[next] - angles[i];
    if (diff < 0) diff += Math.PI * 2;
    gaps.push({ start: angles[i], diff: diff });
  }

  let totalGap = gaps.reduce((sum, g) => sum + g.diff, 0);
  gaps.forEach((gap) => {
    let nodesInGap = Math.round((gap.diff / totalGap) * count);
    for (let i = 1; i <= nodesInGap; i++) {
      let angle = gap.start + gap.diff * (i / (nodesInGap + 1));
      let nx = circle.cx + circle.r * Math.cos(angle);
      let ny = circle.cy + circle.r * Math.sin(angle);

      // Check if this node falls inside any other connected circle
      let isInsideOther = false;
      connections.forEach(([c1, c2]) => {
        if (c1.id === circle.id) {
          if (Math.hypot(nx - c2.cx, ny - c2.cy) < c2.r - 1)
            isInsideOther = true;
        } else if (c2.id === circle.id) {
          if (Math.hypot(nx - c1.cx, ny - c1.cy) < c1.r - 1)
            isInsideOther = true;
        }
      });

      if (!isInsideOther) {
        regularNodes.push({
          x: nx,
          y: ny,
          type: "regular",
        });
      }
    }
  });
}

circles.forEach((c) => addRegularNodes(c, c.roles));

function createTextPath(id, cx, cy, r, startDeg, endDeg) {
  let startAngle = (startDeg * Math.PI) / 180;
  let endAngle = (endDeg * Math.PI) / 180;
  let x1 = cx + r * Math.cos(startAngle);
  let y1 = cy + r * Math.sin(startAngle);
  let x2 = cx + r * Math.cos(endAngle);
  let y2 = cy + r * Math.sin(endAngle);
  let sweep = endDeg > startDeg ? 1 : 0;
  let largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `<path id="${id}" d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2}" fill="none" />`;
}

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">\n`;
svg += `<defs>
    <style type="text/css">
@font-face {
  font-family: "Work Sans";
  font-style: normal;
  font-weight: 100 900;
  font-stretch: 100%;
  font-display: swap;
  src: url("https://fonts.signalwerk.ch/assets/fonts/worksans/latest/WorkSans[wght@100..900][subset@latin].woff2")
    format("woff2-variations");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA,
    U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215,
    U+FEFF, U+FFFD;
}

.circle { fill: none; stroke: black; stroke-width: 2; }
.node { fill: white; stroke: black; stroke-width: 2; }
.text { font-family: 'Work Sans', sans-serif; font-size: 18px; fill: black; }
.title { font-family: 'Work Sans', sans-serif; font-size: 22px; fill: black; }
    </style>
</defs>\n`;

circles.forEach((c) => {
  svg += `<circle class="circle" cx="${c.cx}" cy="${c.cy}" r="${c.r}" />\n`;
});

function drawNode(n) {
  const r = 8;
  let s = "";
  if (n.type === "regular") {
    s += `<circle cx="${n.x}" cy="${n.y}" r="${r}" class="node"/>\n`;
  } else if (n.type === "leiter") {
    s += `<circle cx="${n.x}" cy="${n.y}" r="${r}" class="node"/>\n`;
    s += `<path d="M ${n.x - r} ${n.y} A ${r} ${r} 0 0 1 ${n.x + r} ${n.y} Z" fill="black"/>\n`;
  } else if (n.type === "delegierter") {
    s += `<circle cx="${n.x}" cy="${n.y}" r="${r}" class="node"/>\n`;
    s += `<path d="M ${n.x - r} ${n.y} A ${r} ${r} 0 0 0 ${n.x + r} ${n.y} Z" fill="black"/>\n`;
  }
  return s;
}

regularNodes.forEach((n) => (svg += drawNode(n)));
specialNodes.forEach((n) => (svg += drawNode(n)));

circles.forEach((c) => {
  svg += `<text class="text" x="${c.cx}" y="${c.cy + 6}" text-anchor="middle">${c.name}</text>\n`;
});

const lx = width - 220;
const ly = 150;
svg += drawNode({ x: lx, y: ly, type: "leiter" });
svg += `<text class="text" x="${lx + 20}" y="${ly + 6}">= Leiter</text>\n`;
svg += drawNode({ x: lx, y: ly + 40, type: "delegierter" });
svg += `<text class="text" x="${lx + 20}" y="${ly + 46}">= Delegierter</text>\n`;
svg += drawNode({ x: lx, y: ly + 80, type: "regular" });
svg += `<text class="text" x="${lx + 20}" y="${ly + 86}">= Rolle</text>\n`;

svg += `</svg>`;

fs.writeFileSync(
  resolve(join(__dirname, "../docs/img", "circle-diagram.svg")),
  svg,
);
console.log("circle-diagram.svg created successfully.");
