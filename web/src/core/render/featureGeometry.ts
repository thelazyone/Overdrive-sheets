/** Physical geometry in the sheet's 300 DPI coordinate space. */
export const mm = (value: number) => value * 300 / 25.4;
export type Point = { x: number; y: number };
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const at = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t });
const key = (p: Point) => `${p.x.toFixed(5)},${p.y.toFixed(5)}`;
const xy = (p: Point) => `${p.x.toFixed(5)} ${p.y.toFixed(5)}`;

/** Union of overlapping convex polygons: keep only exposed edge intervals.
 * No internal hex edges survive in the resulting closed outline. */
export function polygonUnionPath(polygons: Point[][]): string {
  const edges: Array<[Point, Point]> = [];
  polygons.forEach((polygon, index) => polygon.forEach((a, edge) => {
    const b = polygon[(edge+1)%polygon.length];
    const direction = sub(b,a);
    const cuts = [0,1];
    polygons.forEach((other,j) => {
      if (index === j) return;
      other.forEach((c,k) => {
        const d = other[(k+1)%other.length];
        const delta = sub(d,c);
        const denominator = cross(direction,delta);
        if (Math.abs(denominator) < 1e-8) return;
        const t = cross(sub(c,a),delta)/denominator;
        const u = cross(sub(c,a),direction)/denominator;
        if (t > 1e-8 && t < 1-1e-8 && u >= -1e-8 && u <= 1+1e-8) cuts.push(t);
      });
    });
    cuts.sort((x,y) => x-y);
    for (let n=0;n<cuts.length-1;n++) {
      if (cuts[n+1]-cuts[n] < 1e-8) continue;
      const midpoint = at(a,b,(cuts[n]+cuts[n+1])/2);
      const hidden = polygons.some((other,j) => j !== index && other.every((c,k) =>
        cross(sub(other[(k+1)%other.length],c),sub(midpoint,c)) > 1e-7));
      if (!hidden) edges.push([at(a,b,cuts[n]),at(a,b,cuts[n+1])]);
    }
  }));
  const remaining = new Map(edges.map(edge => [key(edge[0]),edge]));
  const paths: string[] = [];
  while (remaining.size) {
    const first = remaining.values().next().value!;
    let edge: [Point,Point] | undefined = first;
    let path = `M ${xy(first[0])}`;
    while (edge) {
      remaining.delete(key(edge[0]));
      path += ` L ${xy(edge[1])}`;
      if (key(edge[1]) === key(first[0])) break;
      edge = remaining.get(key(edge[1]));
      if (!edge) throw new Error("Open feature outline");
    }
    paths.push(`${path} Z`);
  }
  return paths.join(" ");
}

/** Circle envelope: offset a counterclockwise convex hull by one radius.
 * The straight tangents and circular joins exactly enclose the slot circles. */
export function roundedEnvelope(hull: Point[], radius: number): string {
  const normals = hull.map((p,i) => {
    const d = sub(hull[(i+1)%hull.length],p);
    const length = Math.hypot(d.x,d.y);
    return { x:d.y/length*radius, y:-d.x/length*radius };
  });
  const shifted = (p:Point,n:Point):Point => ({x:p.x+n.x,y:p.y+n.y});
  let path = `M ${xy(shifted(hull[0],normals[hull.length-1]))}`;
  hull.forEach((p,i) => {
    path += ` A ${radius} ${radius} 0 0 1 ${xy(shifted(p,normals[i]))}`;
    path += ` L ${xy(shifted(hull[(i+1)%hull.length],normals[i]))}`;
  });
  return `${path} Z`;
}
