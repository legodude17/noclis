const regexes = {
  y: /^(y(ea)?r?s?)/,
  w: /^(w((ee)?k)?s?)$/,
  d: /^(d(ay)?s?)$/,
  h: /^(h((ou)?r)?s?)$/,
  m: /^(min(ute)?s?|m)$/,
  s: /^((sec(ond)?)s?|s)$/,
  ms: /^(milli(second)?s?|ms)$/,
  μs: /^(micro(second)?s?|μs)$/,
  ns: /^(nano(second)?s?|ns?)$/
};

const inputScales = {
  y: "365d",
  w: "7d",
  d: "24h",
  h: "60m",
  m: "60s",
  s: "1000ms",
  ms: "1000micro",
  μs: "1000ns",
  ns: "1"
};

const scales = {
  ns: 1n,
  ms: 0n,
  s: 0n,
  m: 0n,
  h: 0n,
  d: 0n,
  w: 0n,
  y: 0n
};

export function parse(str: string) {
  try {
    const n = BigInt(str);
    if (n !== 0n) return n;
  } catch {
    /* Ignored */
  }
  const arr = str.split(" ").map(s => s.trim());
  let result = 0n;
  for (const item of arr) {
    const match = item.match(/^(\d+)([a-z]+)$/);
    if (!match) continue;
    const [, nums, scaleName] = match;
    for (const [key, regex] of Object.entries(regexes)) {
      const scale = key as keyof typeof scales;
      if (regex.test(scaleName!)) {
        const mult =
          scales[scale] || (scales[scale] = parse(inputScales[scale]));
        try {
          result += BigInt(nums!) * mult;
        } catch {
          /* Ignored */
        }
      }
    }
  }
  return result;
}

scales.y = parse(inputScales.y);
scales.w = parse(inputScales.w);

export function format(ns: bigint, depth = 3) {
  let result = "";
  let count = 0;
  function largestScale(): [string, bigint] {
    let cur: [string, bigint] = ["ns", 1n];
    for (const entry of Object.entries(scales)) {
      if (entry[1] < ns && entry[1] > cur[1]) cur = entry;
    }
    return cur;
  }
  while (count < depth && ns > 0) {
    const [name, scale] = largestScale();
    result += ` ${ns / scale}${name}`;
    count++;
    ns = ns % scale;
  }
  return result.trim();
}
