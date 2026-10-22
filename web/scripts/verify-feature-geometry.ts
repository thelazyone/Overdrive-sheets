import assert from "node:assert/strict";
import { mm } from "../src/core/render/featureGeometry";
import { SHIELD_CENTRES, SHIELD_FLATS, SHIELD_HEXES, SHIELD_OUTLINE, SHIELD_RADIUS } from "../src/core/render/shieldGeometry";
import { REACTOR_CENTRES, REACTOR_DIAMETER, REACTOR_HULL, REACTOR_OUTLINE, REACTOR_RADIUS } from "../src/core/render/reactorGeometry";
import { fitSizeInBox, sheetRasterWidthPxForFormat } from "../src/core/render/exportFleetPdf";
import { SHEET_WIDTH } from "../src/core/render/constants";
const near = (a:number,b:number) => assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
near(SHIELD_FLATS,mm(5.2)*Math.sqrt(3));
assert.equal(SHIELD_CENTRES.length,9);
assert.equal(SHIELD_CENTRES.filter(c=>c.x===SHIELD_CENTRES[0].x).length,5);
for(const hex of SHIELD_HEXES) {
  near(Math.max(...hex.map(p=>p.x))-Math.min(...hex.map(p=>p.x)),SHIELD_FLATS);
  for(let i=0;i<6;i++) near(Math.hypot(hex[i].x-hex[(i+1)%6].x,hex[i].y-hex[(i+1)%6].y),SHIELD_RADIUS);
}
near(SHIELD_CENTRES[2].y-SHIELD_CENTRES[0].y,mm(9.5));
near(SHIELD_CENTRES[1].y-SHIELD_CENTRES[0].y,mm(4.75));
near(SHIELD_CENTRES[1].x-SHIELD_CENTRES[0].x,mm(4));
near(SHIELD_RADIUS,mm(5.2));
// Adjacent hexes overlap rather than merely touching; union is one closed loop.
assert.ok(Math.hypot(SHIELD_CENTRES[1].x-SHIELD_CENTRES[0].x,SHIELD_CENTRES[1].y-SHIELD_CENTRES[0].y)<SHIELD_FLATS);
assert.equal((SHIELD_OUTLINE.match(/M /g)||[]).length,1);
assert.equal((SHIELD_OUTLINE.match(/Z/g)||[]).length,1);
assert.ok(!SHIELD_OUTLINE.includes("NaN"));
near(REACTOR_DIAMETER,mm(10));
assert.equal(REACTOR_CENTRES.length,7);
assert.equal(REACTOR_CENTRES.filter(c=>c.x===REACTOR_CENTRES[0].x).length,3);
for(let i=0;i<7;i++) for(let j=i+1;j<7;j++) {
  assert.ok(Math.hypot(REACTOR_CENTRES[i].x-REACTOR_CENTRES[j].x,REACTOR_CENTRES[i].y-REACTOR_CENTRES[j].y)>=REACTOR_DIAMETER-1e-6);
}
assert.equal((REACTOR_OUTLINE.match(/ A /g)||[]).length,4);
assert.ok(REACTOR_OUTLINE.includes(`A ${REACTOR_RADIUS} ${REACTOR_RADIUS}`));
assert.equal(REACTOR_HULL.length,4);
for(const format of ["a4","letter"] as const) assert.equal(sheetRasterWidthPxForFormat(format),SHEET_WIDTH);
near(fitSizeInBox(210,148).drawW/SHEET_WIDTH*REACTOR_DIAMETER,10);
assert.throws(()=>fitSizeInBox(186,130));
console.log("Geometry OK: 5.2 mm hex sides, 9.5 mm pitch, 4 / 4.75 mm offsets, closed union, seven 10 mm circles, actual-size PDF.");
