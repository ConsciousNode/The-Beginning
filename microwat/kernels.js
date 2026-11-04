/* wasm-kernels — hot inner loops as WebAssembly text, assembled by MicroWAT.
 * ConsciousNode SoftWorks · MIT
 *
 * First kernels: matrix × vector, for float32 weights and for ternary
 * weights {-1, 0, +1} stored one per int8 (the LEARNS / BitNet b1.58 case).
 * Each comes in three versions with identical results:
 *   js      plain JavaScript (the fallback, always available)
 *   wasm    scalar WebAssembly
 *   simd    WebAssembly SIMD, 4 floats per instruction
 *
 *   y[r] = Σ_c W[r*cols + c] · x[c]      (row-major W)
 *
 * Usage:
 *   const K = await WasmKernels.create({ pages: 64 });   // 64 × 64 KiB of memory
 *   const W = K.alloc('f32', rows*cols), x = K.alloc('f32', cols), y = K.alloc('f32', rows);
 *   ...fill W.view, x.view...
 *   K.matvec_f32(W, x, y, rows, cols);                    // best available version
 * Arrays live inside the wasm memory, so nothing is copied per call.
 * K.simd / K.wasm say what the browser supports; K.use('js'|'wasm'|'simd') forces one.
 */
(function (root) {
  'use strict';
  const MicroWAT = root.MicroWAT || (typeof require === 'function' ? require('./microwat.js') : null);

  // ---- scalar kernels ------------------------------------------------------
  const WAT_SCALAR = `
(module
  (import "env" "mem" (memory 1))

  ;; float32 weights
  (func (export "matvec_f32") (param $W i32) (param $x i32) (param $y i32) (param $rows i32) (param $cols i32)
    (local $r i32) (local $c i32) (local $w i32) (local $acc f32)
    local.get $W
    local.set $w
    block $done
      local.get $rows
      i32.eqz
      br_if $done
      loop $row
        f32.const 0
        local.set $acc
        i32.const 0
        local.set $c
        block $rowdone
          local.get $cols
          i32.eqz
          br_if $rowdone
          loop $col
            ;; acc += W[w] * x[c]
            local.get $acc
            local.get $w
            f32.load
            local.get $c
            i32.const 2
            i32.shl
            local.get $x
            i32.add
            f32.load
            f32.mul
            f32.add
            local.set $acc
            local.get $w
            i32.const 4
            i32.add
            local.set $w
            local.get $c
            i32.const 1
            i32.add
            local.tee $c
            local.get $cols
            i32.lt_u
            br_if $col
          end
        end
        ;; y[r] = acc
        local.get $r
        i32.const 2
        i32.shl
        local.get $y
        i32.add
        local.get $acc
        f32.store
        local.get $r
        i32.const 1
        i32.add
        local.tee $r
        local.get $rows
        i32.lt_u
        br_if $row
      end
    end)

  ;; ternary weights, one int8 each (-1, 0, +1): add, skip or subtract
  (func (export "matvec_t8") (param $W i32) (param $x i32) (param $y i32) (param $rows i32) (param $cols i32)
    (local $r i32) (local $c i32) (local $w i32) (local $acc f32) (local $t i32) (local $xv f32)
    local.get $W
    local.set $w
    block $done
      local.get $rows
      i32.eqz
      br_if $done
      loop $row
        f32.const 0
        local.set $acc
        i32.const 0
        local.set $c
        block $rowdone
          local.get $cols
          i32.eqz
          br_if $rowdone
          loop $col
            local.get $w
            i32.load8_s
            local.tee $t
            if
              local.get $c
              i32.const 2
              i32.shl
              local.get $x
              i32.add
              f32.load
              local.set $xv
              local.get $t
              i32.const 0
              i32.gt_s
              if
                local.get $acc
                local.get $xv
                f32.add
                local.set $acc
              else
                local.get $acc
                local.get $xv
                f32.sub
                local.set $acc
              end
            end
            local.get $w
            i32.const 1
            i32.add
            local.set $w
            local.get $c
            i32.const 1
            i32.add
            local.tee $c
            local.get $cols
            i32.lt_u
            br_if $col
          end
        end
        local.get $r
        i32.const 2
        i32.shl
        local.get $y
        i32.add
        local.get $acc
        f32.store
        local.get $r
        i32.const 1
        i32.add
        local.tee $r
        local.get $rows
        i32.lt_u
        br_if $row
      end
    end)
)`;

  // ---- SIMD kernels (cols must be a multiple of 4 for f32, 16 for t8) ------
  // Note: SIMD sums in a different order (4 partial sums), so results can
  // differ from the scalar ones in the last bits, as any float reordering does.
  const WAT_SIMD = `
(module
  (import "env" "mem" (memory 1))

  (func (export "matvec_f32") (param $W i32) (param $x i32) (param $y i32) (param $rows i32) (param $cols i32)
    (local $r i32) (local $c i32) (local $w i32) (local $acc v128)
    local.get $W
    local.set $w
    block $done
      local.get $rows
      i32.eqz
      br_if $done
      loop $row
        f32.const 0
        f32x4.splat
        local.set $acc
        i32.const 0
        local.set $c
        block $rowdone
          local.get $cols
          i32.eqz
          br_if $rowdone
          loop $col
            local.get $acc
            local.get $w
            v128.load align=4
            local.get $c
            i32.const 2
            i32.shl
            local.get $x
            i32.add
            v128.load align=4
            f32x4.mul
            f32x4.add
            local.set $acc
            local.get $w
            i32.const 16
            i32.add
            local.set $w
            local.get $c
            i32.const 4
            i32.add
            local.tee $c
            local.get $cols
            i32.lt_u
            br_if $col
          end
        end
        local.get $r
        i32.const 2
        i32.shl
        local.get $y
        i32.add
        ;; horizontal sum (a0 + a1) + (a2 + a3)
        local.get $acc
        f32x4.extract_lane 0
        local.get $acc
        f32x4.extract_lane 1
        f32.add
        local.get $acc
        f32x4.extract_lane 2
        local.get $acc
        f32x4.extract_lane 3
        f32.add
        f32.add
        f32.store
        local.get $r
        i32.const 1
        i32.add
        local.tee $r
        local.get $rows
        i32.lt_u
        br_if $row
      end
    end)

;; ternary, four rows at a time (rows must be a multiple of 4): each slice of x is
  ;; loaded once and used for four rows. 1.3-1.7x faster than one row at a time, and
  ;; bit-identical to it. Generated by experiments/t8-variants.js (the "convert_x4" variant).
  (func (export "matvec_t8_x4") (param $W i32) (param $x i32) (param $y i32) (param $rows i32) (param $cols i32)
    (local $r i32) (local $c i32) (local $xp i32) (local $b v128) (local $w4 v128) (local $zero v128) (local $sign v128)
    (local $x0 v128) (local $x1 v128) (local $x2 v128) (local $x3 v128)
    (local $acc0 v128) (local $acc1 v128) (local $acc2 v128) (local $acc3 v128) (local $w0 i32) (local $w1 i32) (local $w2 i32) (local $w3 i32)
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
        local.get $r
        i32.const 0
        i32.add
        local.get $cols
        i32.mul
        local.get $W
        i32.add
        local.set $w0
        local.get $r
        i32.const 1
        i32.add
        local.get $cols
        i32.mul
        local.get $W
        i32.add
        local.set $w1
        local.get $r
        i32.const 2
        i32.add
        local.get $cols
        i32.mul
        local.get $W
        i32.add
        local.set $w2
        local.get $r
        i32.const 3
        i32.add
        local.get $cols
        i32.mul
        local.get $W
        i32.add
        local.set $w3
        f32.const 0
        f32x4.splat
        local.set $acc0
        f32.const 0
        f32x4.splat
        local.set $acc1
        f32.const 0
        f32x4.splat
        local.set $acc2
        f32.const 0
        f32x4.splat
        local.set $acc3
        i32.const 0
        local.set $c
        block $rowdone
          local.get $cols
          i32.eqz
          br_if $rowdone
          loop $col
            local.get $c
            i32.const 2
            i32.shl
            local.get $x
            i32.add
            local.set $xp
            local.get $xp
            v128.load offset=0 align=4
            local.set $x0
            local.get $xp
            v128.load offset=16 align=4
            local.set $x1
            local.get $xp
            v128.load offset=32 align=4
            local.set $x2
            local.get $xp
            v128.load offset=48 align=4
            local.set $x3
            local.get $w0
            local.get $c
            i32.add
            v128.load align=1
            local.set $b
            local.get $b
            i16x8.extend_low_i8x16_s
            i32x4.extend_low_i16x8_s
            local.set $w4
            local.get $acc0
            local.get $w4
            f32x4.convert_i32x4_s
            local.get $x0
            f32x4.mul
            f32x4.add
            local.set $acc0
            local.get $b
            i16x8.extend_low_i8x16_s
            i32x4.extend_high_i16x8_s
            local.set $w4
            local.get $acc0
            local.get $w4
            f32x4.convert_i32x4_s
            local.get $x1
            f32x4.mul
            f32x4.add
            local.set $acc0
            local.get $b
            i16x8.extend_high_i8x16_s
            i32x4.extend_low_i16x8_s
            local.set $w4
            local.get $acc0
            local.get $w4
            f32x4.convert_i32x4_s
            local.get $x2
            f32x4.mul
            f32x4.add
            local.set $acc0
            local.get $b
            i16x8.extend_high_i8x16_s
            i32x4.extend_high_i16x8_s
            local.set $w4
            local.get $acc0
            local.get $w4
            f32x4.convert_i32x4_s
            local.get $x3
            f32x4.mul
            f32x4.add
            local.set $acc0
            local.get $w1
            local.get $c
            i32.add
            v128.load align=1
            local.set $b
            local.get $b
            i16x8.extend_low_i8x16_s
            i32x4.extend_low_i16x8_s
            local.set $w4
            local.get $acc1
            local.get $w4
            f32x4.convert_i32x4_s
            local.get $x0
            f32x4.mul
            f32x4.add
            local.set $acc1
            local.get $b
            i16x8.extend_low_i8x16_s
            i32x4.extend_high_i16x8_s
            local.set $w4
            local.get $acc1
            local.get $w4
            f32x4.convert_i32x4_s
            local.get $x1
            f32x4.mul
            f32x4.add
            local.set $acc1
            local.get $b
            i16x8.extend_high_i8x16_s
            i32x4.extend_low_i16x8_s
            local.set $w4
            local.get $acc1
            local.get $w4
            f32x4.convert_i32x4_s
            local.get $x2
            f32x4.mul
            f32x4.add
            local.set $acc1
            local.get $b
            i16x8.extend_high_i8x16_s
            i32x4.extend_high_i16x8_s
            local.set $w4
            local.get $acc1
            local.get $w4
            f32x4.convert_i32x4_s
            local.get $x3
            f32x4.mul
            f32x4.add
            local.set $acc1
            local.get $w2
            local.get $c
            i32.add
            v128.load align=1
            local.set $b
            local.get $b
            i16x8.extend_low_i8x16_s
            i32x4.extend_low_i16x8_s
            local.set $w4
            local.get $acc2
            local.get $w4
            f32x4.convert_i32x4_s
            local.get $x0
            f32x4.mul
            f32x4.add
            local.set $acc2
            local.get $b
            i16x8.extend_low_i8x16_s
            i32x4.extend_high_i16x8_s
            local.set $w4
            local.get $acc2
            local.get $w4
            f32x4.convert_i32x4_s
            local.get $x1
            f32x4.mul
            f32x4.add
            local.set $acc2
            local.get $b
            i16x8.extend_high_i8x16_s
            i32x4.extend_low_i16x8_s
            local.set $w4
            local.get $acc2
            local.get $w4
            f32x4.convert_i32x4_s
            local.get $x2
            f32x4.mul
            f32x4.add
            local.set $acc2
            local.get $b
            i16x8.extend_high_i8x16_s
            i32x4.extend_high_i16x8_s
            local.set $w4
            local.get $acc2
            local.get $w4
            f32x4.convert_i32x4_s
            local.get $x3
            f32x4.mul
            f32x4.add
            local.set $acc2
            local.get $w3
            local.get $c
            i32.add
            v128.load align=1
            local.set $b
            local.get $b
            i16x8.extend_low_i8x16_s
            i32x4.extend_low_i16x8_s
            local.set $w4
            local.get $acc3
            local.get $w4
            f32x4.convert_i32x4_s
            local.get $x0
            f32x4.mul
            f32x4.add
            local.set $acc3
            local.get $b
            i16x8.extend_low_i8x16_s
            i32x4.extend_high_i16x8_s
            local.set $w4
            local.get $acc3
            local.get $w4
            f32x4.convert_i32x4_s
            local.get $x1
            f32x4.mul
            f32x4.add
            local.set $acc3
            local.get $b
            i16x8.extend_high_i8x16_s
            i32x4.extend_low_i16x8_s
            local.set $w4
            local.get $acc3
            local.get $w4
            f32x4.convert_i32x4_s
            local.get $x2
            f32x4.mul
            f32x4.add
            local.set $acc3
            local.get $b
            i16x8.extend_high_i8x16_s
            i32x4.extend_high_i16x8_s
            local.set $w4
            local.get $acc3
            local.get $w4
            f32x4.convert_i32x4_s
            local.get $x3
            f32x4.mul
            f32x4.add
            local.set $acc3
            local.get $c
            i32.const 16
            i32.add
            local.tee $c
            local.get $cols
            i32.lt_u
            br_if $col
          end
        end
        local.get $r
        i32.const 0
        i32.add
        i32.const 2
        i32.shl
        local.get $y
        i32.add
        local.get $acc0
        f32x4.extract_lane 0
        local.get $acc0
        f32x4.extract_lane 1
        f32.add
        local.get $acc0
        f32x4.extract_lane 2
        local.get $acc0
        f32x4.extract_lane 3
        f32.add
        f32.add
        f32.store
        local.get $r
        i32.const 1
        i32.add
        i32.const 2
        i32.shl
        local.get $y
        i32.add
        local.get $acc1
        f32x4.extract_lane 0
        local.get $acc1
        f32x4.extract_lane 1
        f32.add
        local.get $acc1
        f32x4.extract_lane 2
        local.get $acc1
        f32x4.extract_lane 3
        f32.add
        f32.add
        f32.store
        local.get $r
        i32.const 2
        i32.add
        i32.const 2
        i32.shl
        local.get $y
        i32.add
        local.get $acc2
        f32x4.extract_lane 0
        local.get $acc2
        f32x4.extract_lane 1
        f32.add
        local.get $acc2
        f32x4.extract_lane 2
        local.get $acc2
        f32x4.extract_lane 3
        f32.add
        f32.add
        f32.store
        local.get $r
        i32.const 3
        i32.add
        i32.const 2
        i32.shl
        local.get $y
        i32.add
        local.get $acc3
        f32x4.extract_lane 0
        local.get $acc3
        f32x4.extract_lane 1
        f32.add
        local.get $acc3
        f32x4.extract_lane 2
        local.get $acc3
        f32x4.extract_lane 3
        f32.add
        f32.add
        f32.store
        local.get $r
        i32.const 4
        i32.add
        local.tee $r
        local.get $rows
        i32.lt_u
        br_if $row
      end
    end)

    ;; ternary: 16 int8 weights per load, widened to four f32x4 groups
  (func (export "matvec_t8") (param $W i32) (param $x i32) (param $y i32) (param $rows i32) (param $cols i32)
    (local $r i32) (local $c i32) (local $w i32) (local $acc v128) (local $b v128) (local $h v128) (local $xp i32)
    local.get $W
    local.set $w
    block $done
      local.get $rows
      i32.eqz
      br_if $done
      loop $row
        f32.const 0
        f32x4.splat
        local.set $acc
        i32.const 0
        local.set $c
        block $rowdone
          local.get $cols
          i32.eqz
          br_if $rowdone
          loop $col
            local.get $w
            v128.load align=1
            local.set $b
            local.get $c
            i32.const 2
            i32.shl
            local.get $x
            i32.add
            local.set $xp
            ;; low 8 bytes -> 8 x i16 -> 2 groups of 4 x f32
            local.get $b
            i16x8.extend_low_i8x16_s
            local.set $h
            local.get $acc
            local.get $h
            i32x4.extend_low_i16x8_s
            f32x4.convert_i32x4_s
            local.get $xp
            v128.load align=4
            f32x4.mul
            f32x4.add
            local.get $h
            i32x4.extend_high_i16x8_s
            f32x4.convert_i32x4_s
            local.get $xp
            v128.load offset=16 align=4
            f32x4.mul
            f32x4.add
            ;; high 8 bytes
            local.get $b
            i16x8.extend_high_i8x16_s
            local.set $h
            local.get $h
            i32x4.extend_low_i16x8_s
            f32x4.convert_i32x4_s
            local.get $xp
            v128.load offset=32 align=4
            f32x4.mul
            f32x4.add
            local.get $h
            i32x4.extend_high_i16x8_s
            f32x4.convert_i32x4_s
            local.get $xp
            v128.load offset=48 align=4
            f32x4.mul
            f32x4.add
            local.set $acc
            local.get $w
            i32.const 16
            i32.add
            local.set $w
            local.get $c
            i32.const 16
            i32.add
            local.tee $c
            local.get $cols
            i32.lt_u
            br_if $col
          end
        end
        local.get $r
        i32.const 2
        i32.shl
        local.get $y
        i32.add
        local.get $acc
        f32x4.extract_lane 0
        local.get $acc
        f32x4.extract_lane 1
        f32.add
        local.get $acc
        f32x4.extract_lane 2
        local.get $acc
        f32x4.extract_lane 3
        f32.add
        f32.add
        f32.store
        local.get $r
        i32.const 1
        i32.add
        local.tee $r
        local.get $rows
        i32.lt_u
        br_if $row
      end
    end)
)`;

  // ---- plain JavaScript fallbacks ------------------------------------------
  const JS = {
    matvec_f32(W, x, y, rows, cols) {
      for (let r = 0, w = 0; r < rows; r++) {
        let acc = 0;
        for (let c = 0; c < cols; c++, w++) acc = Math.fround(acc + Math.fround(W[w] * x[c]));
        y[r] = acc;
      }
    },
    matvec_t8(W, x, y, rows, cols) {
      for (let r = 0, w = 0; r < rows; r++) {
        let acc = 0;
        for (let c = 0; c < cols; c++, w++) { const t = W[w]; if (t) acc = Math.fround(t > 0 ? acc + x[c] : acc - x[c]); }
        y[r] = acc;
      }
    },
  };

  const SIMD_PROBE = '(module (func (result v128) f32.const 0 f32x4.splat))';

  async function create({ pages = 16, maxPages = 16384 } = {}) {
    const mem = new WebAssembly.Memory({ initial: pages, maximum: maxPages });
    let wasm = null, simd = null;
    try { wasm = (await WebAssembly.instantiate(MicroWAT.assemble(WAT_SCALAR), { env: { mem } })).instance.exports; } catch (e) { wasm = null; }
    try {
      if (WebAssembly.validate(MicroWAT.assemble(SIMD_PROBE)))
        simd = (await WebAssembly.instantiate(MicroWAT.assemble(WAT_SIMD), { env: { mem } })).instance.exports;
    } catch (e) { simd = null; }

    let top = 64; // bump allocator; 0..63 left unused
    const CTOR = { f32: Float32Array, i8: Int8Array, i32: Int32Array };
    const K = {
      memory: mem, wasm: !!wasm, simd: !!simd, mode: simd ? 'simd' : wasm ? 'wasm' : 'js',
      use(m) { if ((m === 'simd' && !simd) || (m === 'wasm' && !wasm)) throw new Error(m + ' not available'); this.mode = m; return this; },
      alloc(type, n) {
        const C = CTOR[type]; top = (top + 15) & ~15; const bytes = n * C.BYTES_PER_ELEMENT;
        const need = Math.ceil((top + bytes) / 65536) - mem.buffer.byteLength / 65536;
        if (need > 0) mem.grow(need);
        const a = { ptr: top, length: n, type, get view() { return new C(mem.buffer, this.ptr, this.length); } };
        top += bytes; return a;
      },
      reset() { top = 64; },
    };
    for (const name of ['matvec_f32', 'matvec_t8']) {
      K[name] = function (W, x, y, rows, cols) {
        const m = this.mode;
        if (m === 'simd' && cols % (name === 'matvec_t8' ? 16 : 4) === 0) {
          if (name === 'matvec_t8' && rows % 4 === 0) return simd.matvec_t8_x4(W.ptr, x.ptr, y.ptr, rows, cols);
          return simd[name](W.ptr, x.ptr, y.ptr, rows, cols);
        }
        if (m !== 'js') return wasm[name](W.ptr, x.ptr, y.ptr, rows, cols);
        return JS[name](W.view, x.view, y.view, rows, cols);
      };
    }
    return K;
  }

  const WasmKernels = { create, JS, WAT_SCALAR, WAT_SIMD, version: '0.2.0' };
  if (typeof module === 'object' && module.exports) module.exports = WasmKernels;
  else root.WasmKernels = WasmKernels;
})(typeof globalThis !== 'undefined' ? globalThis : this);
