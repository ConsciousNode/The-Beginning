/* Benchmark: matrix × vector, JS vs scalar wasm vs SIMD wasm. Works in Node and the browser. */
(function (root) {
  const now = typeof performance !== 'undefined' ? () => performance.now() : () => Number(process.hrtime.bigint()) / 1e6;
  // what an app would normally write: float64 accumulator, no fround
  const natural = {
    f32(W, x, y, rows, cols) { for (let r = 0, w = 0; r < rows; r++) { let a = 0; for (let c = 0; c < cols; c++) a += W[w++] * x[c]; y[r] = a; } },
    t8(W, x, y, rows, cols) { for (let r = 0, w = 0; r < rows; r++) { let a = 0; for (let c = 0; c < cols; c++) a += W[w++] * x[c]; y[r] = a; } }, // branchless: multiply by -1/0/+1
  };
  async function run(WK, log = console.log, sizes = [[256, 256], [1024, 1024], [4096, 1024]]) {
    const K = await WK.create({ pages: 1 });
    const out = [];
    for (const kind of ['f32', 't8']) for (const [rows, cols] of sizes) {
      K.reset();
      const W = K.alloc(kind === 'f32' ? 'f32' : 'i8', rows * cols), x = K.alloc('f32', cols), y = K.alloc('f32', rows);
      let s = 7; const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 31) - 1;
      const Wv = W.view; for (let i = 0; i < Wv.length; i++) Wv[i] = kind === 'f32' ? r() : Math.round(r() * 1.49);
      const xv = x.view; for (let i = 0; i < xv.length; i++) xv[i] = r();
      const contenders = {
        'js natural': () => natural[kind](W.view, x.view, y.view, rows, cols),
        'js exact-f32': () => K.use('js')['matvec_' + kind](W, x, y, rows, cols),
        'wasm': () => K.use('wasm')['matvec_' + kind](W, x, y, rows, cols),
        'wasm simd': () => K.use('simd')['matvec_' + kind](W, x, y, rows, cols),
      };
      const reps = Math.max(5, Math.round(4e7 / (rows * cols)));
      const row = { kind, size: `${rows}x${cols}` };
      for (const [name, fn] of Object.entries(contenders)) {
        if (name === 'wasm simd' && !K.simd) continue;
        for (let i = 0; i < 3; i++) fn(); // warm up the JIT / tier-up
        const t = [];
        for (let k = 0; k < 7; k++) { const t0 = now(); for (let i = 0; i < reps; i++) fn(); t.push((now() - t0) / reps); }
        t.sort((a, b) => a - b); row[name] = t[3]; // median ms per call
      }
      const base = row['js natural'];
      log(`${kind} ${row.size}`.padEnd(14) + Object.keys(contenders).filter(n => row[n] !== undefined)
        .map(n => `${n}: ${row[n].toFixed(3)} ms (${(base / row[n]).toFixed(2)}x)`).join('  |  '));
      out.push(row);
    }
    return out;
  }
  if (typeof module === 'object' && module.exports) module.exports = { run };
  else root.WasmBench = { run };
})(typeof globalThis !== 'undefined' ? globalThis : this);
