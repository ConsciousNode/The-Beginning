/* Experiment: which ternary (int8 −1/0/+1) SIMD matvec is fastest?
 *
 *   convert  widen int8 → i32 → f32, multiply by x, add      (what kernels.js ships)
 *   mask     never touch floats: flip x's sign bit where w = −1, zero it where w = 0, add
 *            (x XOR (w AND 0x80000000)) AND (w ≠ 0)   (w = −1 is all ones, so only it has the sign bit)
 *   …×4      the same, but four rows at once, so each slice of x is loaded once
 *            and reused four times (rows must be a multiple of 4)
 *
 * Run: node experiments/t8-variants.js   (checks every variant against JS, then times them)
 */
const MicroWAT = require('../microwat.js');
const WK = require('../kernels.js');

// One group of 4 lanes: weights in v128 local `w4` (i32x4), x slice on the stack-free local `xs`.
const lane = {
  convert: (acc, w4, xs) => `
            local.get ${acc}
            local.get ${w4}
            f32x4.convert_i32x4_s
            local.get ${xs}
            f32x4.mul
            f32x4.add
            local.set ${acc}`,
  mask: (acc, w4, xs) => `
            local.get ${acc}
            local.get ${xs}
            local.get ${w4}
            local.get $sign
            v128.and
            v128.xor
            local.get ${w4}
            local.get $zero
            i32x4.ne
            v128.and
            f32x4.add
            local.set ${acc}`,
};

function kernel(name, style, R) {
  const accs = [...Array(R).keys()].map(i => `$acc${i}`);
  const rowsW = [...Array(R).keys()].map(i => `$w${i}`);
  let body = '';
  // per 16 columns: load 4 x slices once, then for each row widen 16 weights into 4 groups
  body += `
            local.get $c
            i32.const 2
            i32.shl
            local.get $x
            i32.add
            local.set $xp`;
  for (let q = 0; q < 4; q++) body += `
            local.get $xp
            v128.load offset=${q * 16} align=4
            local.set $x${q}`;
  rowsW.forEach((w, i) => {
    body += `
            local.get ${w}
            local.get $c
            i32.add
            v128.load align=1
            local.set $b`;
    const groups = [['i16x8.extend_low_i8x16_s', 'i32x4.extend_low_i16x8_s'], ['i16x8.extend_low_i8x16_s', 'i32x4.extend_high_i16x8_s'],
                    ['i16x8.extend_high_i8x16_s', 'i32x4.extend_low_i16x8_s'], ['i16x8.extend_high_i8x16_s', 'i32x4.extend_high_i16x8_s']];
    groups.forEach(([h, l], q) => {
      body += `
            local.get $b
            ${h}
            ${l}
            local.set $w4` + lane[style](accs[i], '$w4', `$x${q}`);
    });
  });
  const hsum = acc => `
        local.get ${acc}
        f32x4.extract_lane 0
        local.get ${acc}
        f32x4.extract_lane 1
        f32.add
        local.get ${acc}
        f32x4.extract_lane 2
        local.get ${acc}
        f32x4.extract_lane 3
        f32.add
        f32.add`;
  let store = '';
  accs.forEach((a, i) => store += `
        local.get $r
        i32.const ${i}
        i32.add
        i32.const 2
        i32.shl
        local.get $y
        i32.add` + hsum(a) + `
        f32.store`);
  return `
  (func (export "${name}") (param $W i32) (param $x i32) (param $y i32) (param $rows i32) (param $cols i32)
    (local $r i32) (local $c i32) (local $xp i32) (local $b v128) (local $w4 v128) (local $zero v128) (local $sign v128)
    (local $x0 v128) (local $x1 v128) (local $x2 v128) (local $x3 v128)
    ${accs.map(a => `(local ${a} v128)`).join(' ')} ${rowsW.map(w => `(local ${w} i32)`).join(' ')}
    i32.const 0
    i32x4.splat
    local.set $zero
    i32.const 0x80000000
    i32x4.splat
    local.set $sign
    block $done
      local.get $rows
      i32.eqz
      br_if $done
      loop $row
        ;; row base pointers: W + (r + i) * cols
        ${rowsW.map((w, i) => `local.get $r
        i32.const ${i}
        i32.add
        local.get $cols
        i32.mul
        local.get $W
        i32.add
        local.set ${w}`).join('\n        ')}
        ${accs.map(a => `f32.const 0
        f32x4.splat
        local.set ${a}`).join('\n        ')}
        i32.const 0
        local.set $c
        block $rowdone
          local.get $cols
          i32.eqz
          br_if $rowdone
          loop $col${body}
            local.get $c
            i32.const 16
            i32.add
            local.tee $c
            local.get $cols
            i32.lt_u
            br_if $col
          end
        end${store}
        local.get $r
        i32.const ${R}
        i32.add
        local.tee $r
        local.get $rows
        i32.lt_u
        br_if $row
      end
    end)`;
}

const VARIANTS = [['convert', 'convert', 1], ['mask', 'mask', 1], ['convert_x4', 'convert', 4], ['mask_x4', 'mask', 4]];
const WAT = `(module\n  (import "env" "mem" (memory 1))${VARIANTS.map(([n, s, R]) => kernel(n, s, R)).join('')}\n)`;
module.exports = { WAT, VARIANTS };

if (require.main === module) (async () => {
  const now = () => Number(process.hrtime.bigint()) / 1e6;
  const K = await WK.create({ pages: 1 });
  const ex = (await WebAssembly.instantiate(MicroWAT.assemble(WAT), { env: { mem: K.memory } })).instance.exports;
  let s = 99; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 31) - 1;
  let ok = true;
  for (const [rows, cols] of [[4, 16], [8, 48], [64, 256], [256, 1024]]) {
    K.reset();
    const W = K.alloc('i8', rows * cols), x = K.alloc('f32', cols), y = K.alloc('f32', rows);
    W.view.forEach((_, i, a) => a[i] = Math.round(rnd() * 1.49)); x.view.forEach((_, i, a) => a[i] = rnd());
    const ref = new Float32Array(rows); WK.JS.matvec_t8(W.view, x.view, ref, rows, cols);
    K.use('simd').matvec_t8(W, x, y, rows, cols); const shipped = Float32Array.from(y.view);
    for (const [n] of VARIANTS) {
      ex[n](W.ptr, x.ptr, y.ptr, rows, cols);
      const v = y.view; let err = 0, same = true;
      for (let r = 0; r < rows; r++) { err = Math.max(err, Math.abs(v[r] - ref[r]) / (1 + Math.abs(ref[r]))); if (v[r] !== shipped[r]) same = false; }
      if (err > 1e-5) ok = false;
      console.log(`${err > 1e-5 ? 'FAIL' : 'ok  '} ${n.padEnd(11)} ${rows}x${cols}`.padEnd(32) + `max rel err ${err.toExponential(1)}${same ? ', identical to shipped SIMD' : ''}`);
    }
  }
  if (!ok) { console.log('VARIANTS DISAGREE'); process.exit(1); }
  console.log('');
  for (const [rows, cols] of [[256, 256], [1024, 1024], [4096, 1024], [4096, 4096]]) {
    K.reset();
    const W = K.alloc('i8', rows * cols), x = K.alloc('f32', cols), y = K.alloc('f32', rows);
    W.view.forEach((_, i, a) => a[i] = Math.round(rnd() * 1.49)); x.view.forEach((_, i, a) => a[i] = rnd());
    const reps = Math.max(5, Math.round(6e7 / (rows * cols)));
    const time = fn => { for (let i = 0; i < 3; i++) fn(); const t = []; for (let k = 0; k < 7; k++) { const t0 = now(); for (let i = 0; i < reps; i++) fn(); t.push((now() - t0) / reps); } return t.sort((a, b) => a - b)[3]; };
    const base = time(() => ex.convert(W.ptr, x.ptr, y.ptr, rows, cols));
    console.log(`${rows}x${cols}`.padEnd(10) + VARIANTS.map(([n]) => { const t = n === 'convert' ? base : time(() => ex[n](W.ptr, x.ptr, y.ptr, rows, cols)); return `${n}: ${t.toFixed(3)} ms (${(base / t).toFixed(2)}x)`; }).join('  |  '));
  }
})();
