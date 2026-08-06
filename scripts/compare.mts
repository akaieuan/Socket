/**
 * The same instrument, through the WebAssembly build.
 *
 * Run alongside akaVST's `render` tool on the compiled plugin and compare the
 * numbers. Identical C++ compiled by two different toolchains for two
 * different targets should agree; where it does not, that is drift, and drift
 * in a shared engine is the exact thing the sharing exists to prevent.
 */
import { api, build, render, peak, rms, db, magAt, centroid, SR } from "./measure.mts";

api.prepare(SR, 128);

build(["osc", "filter", "env", "out"]);
api.setParam(0, 0, 0.0);    // Oscillator · Wave = Saw
api.setParam(0, 3, 0.8);    // Oscillator · Level
api.setParam(1, 1, 0.65);   // Filter · Cutoff
api.setParam(1, 2, 0.25);   // Filter · Reso
api.setParam(2, 0, 0.02);   // Envelope · A
api.setParam(2, 3, 0.35);   // Envelope · R
api.setParam(3, 0, 0.8);    // Output · Level

const x = render(1.0, { note: 60 });

console.log("build       : WebAssembly (Emscripten)");
console.log("peak        :", peak(x).toFixed(5));
console.log("rms         :", rms(x).toFixed(5));
console.log("centroid    :", centroid(x).toFixed(0), "Hz");
console.log("C4 partial  :", db(magAt(x, 261.63)).toFixed(1), "dB");
