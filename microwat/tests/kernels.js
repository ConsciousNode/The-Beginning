// Every kernel version must agree with the plain-JS reference.
// Scalar wasm: bit-for-bit. SIMD: sums in a different order, so within float rounding.
const WK = require('../kernels.js');
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32) * 2 - 1;
(async () => {
  const K = await WK.create({ pages: 1 });
  console.log(`wasm: ${K.wasm}  simd: ${K.simd}`);
  let fails = 0;
  for (const [rows, cols] of [[1, 16], [3, 32], [17, 48], [64, 256], [300, 1024], [5, 0], [0, 16]]) {
    for (const kind of ['f32', 't8']) {
      K.reset();
      const W = K.alloc(kind === 'f32' ? 'f32' : 'i8', rows * cols), x = K.alloc('f32', cols);
      const Wv = W.view; for (let i = 0; i < Wv.length; i++) Wv[i] = kind === 'f32' ? rnd() : Math.round(rnd() * 1.49);
      const xv = x.view; for (let i = 0; i < xv.length; i++) xv[i] = rnd();
      const ref = new Float32Array(rows); WK.JS['matvec_' + kind](W.view, x.view, ref, rows, cols);
      for (const mode of ['wasm', 'simd']) {
        if (!K[mode]) continue;
        const y = K.alloc('f32', rows); K.use(mode)['matvec_' + kind](W, x, y, rows, cols);
        const yv = y.view; let maxErr = 0, exact = true;
        for (let r = 0; r < rows; r++) { if (yv[r] !== ref[r]) exact = false; maxErr = Math.max(maxErr, Math.abs(yv[r] - ref[r]) / (1 + Math.abs(ref[r]))); }
        const ok = mode === 'wasm' ? exact : maxErr < 1e-5;
        if (!ok) fails++;
        console.log(`${ok ? 'ok  ' : 'FAIL'} ${kind} ${mode.padEnd(4)} ${rows}x${cols}`.padEnd(30) + (exact ? 'bit-exact' : `max rel err ${maxErr.toExponential(1)}`));
      }
    }
  }
  console.log(fails ? `${fails} FAILED` : 'ALL KERNELS AGREE');
  process.exit(fails ? 1 : 0);
})();
