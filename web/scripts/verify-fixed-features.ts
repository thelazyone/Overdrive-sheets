import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { parseShipDocument, exportShipDocument, SystemSchema } from "../src/core/schema";
import { shieldSteps } from "../src/core/render/shieldTrack";

for (const file of readdirSync("src/presets").filter(f => f.endsWith(".json"))) {
  const raw = JSON.parse(readFileSync(`src/presets/${file}`, "utf8"));
  raw.presetId = file;
  const ship = parseShipDocument(raw);
  const saved = exportShipDocument(ship);
  assert.deepEqual(parseShipDocument(saved, [{ id: file, raw }]), ship);
  assert.ok(!("mess" in saved));
  for (const feature of [ship.reactor, ship.shields, ship.quarters]) {
    assert.ok(!("kind" in feature));
    assert.ok(!("electronics" in feature));
    assert.ok(!("life_support" in feature));
  }
  const legacy = {
    ...raw, quarters: undefined,
    mess: { kind: "system", system: { ...ship.quarters, name: "Mess", kind: "mess", life_support: true } },
    reactor: { kind: "slot", selectedIndex: null, options: [{ ...ship.reactor, kind: "reactor", electronics: true }] },
    shields: { ...ship.shields, kind: "shields", electronics: true },
  };
  assert.deepEqual(parseShipDocument(legacy), ship);
  // Loading a known class cannot override its fixed features through a save.
  const altered = { ...saved, presetId: file, reactor: { ...ship.reactor, circles: 999 } };
  assert.deepEqual(parseShipDocument(altered, [{ id: file, raw }]).reactor, ship.reactor);
  assert.throws(() => parseShipDocument({ ...raw, reactor: undefined }));
  assert.throws(() => parseShipDocument({ ...raw, shields: { ...ship.shields, front: [8] } }));
  for (const values of [ship.shields.front, ship.shields.rear]) {
    assert.equal(shieldSteps(values).length, 9);
    assert.equal(shieldSteps(values)[0], "off");
    assert.equal(shieldSteps(values).filter(x => x === "recharge").length, values.length);
  }
  console.log(`${file}: fixed features, legacy migration, export, shield capacity OK`);
}
for (const kind of ["mess", "quarters", "reactor", "shields"]) {
  assert.equal(SystemSchema.safeParse({ kind, name: "Not a system" }).success, false);
}
assert.deepEqual(shieldSteps([2, 1]), ["off", "empty", "empty", "recharge", "empty", "recharge", "disabled", "disabled", "disabled"]);
assert.deepEqual(shieldSteps([]), ["off", ...Array(8).fill("disabled")]);
