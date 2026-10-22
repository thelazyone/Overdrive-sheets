/** Nine mask apertures, including off. Capacity only changes their markings. */
export function shieldSteps(values: number[]): Array<"off" | "empty" | "recharge" | "disabled"> {
  const steps: Array<"off" | "empty" | "recharge" | "disabled"> = ["off"];
  for (const value of values) {
    for (let n = 0; n < value; n++) steps.push("empty");
    steps.push("recharge");
  }
  while (steps.length < 9) steps.push("disabled");
  return steps.slice(0, 9);
}

