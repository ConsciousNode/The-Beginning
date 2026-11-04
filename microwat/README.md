# MicroWAT 2 + wasm-kernels

**WASM-Kernel's assembler, grown up into something any Xinu app can paste in.**

WASM-Kernel (March 2026, in `../wasm-kernel/`) had a WebAssembly-text assembler written in plain JavaScript. This folder pulls that idea out on its own, with its bugs fixed and SIMD added, so a single-file app can carry hand-written WebAssembly as **text** and assemble it when the page loads. There's no toolchain, no binary blobs, and no dependencies.

| file | what |
|---|---|
| `microwat.js` | the assembler, ~19 KB. `MicroWAT.assemble(watText) → Uint8Array` |
| `kernels.js` | first kernels: matrix × vector for float32 and **ternary** (−1/0/+1, int8) weights, each as plain JS, scalar wasm and SIMD wasm |
| `bench.html` / `bench-node.js` | the benchmark, in a browser or in Node |
| `tests/` | `vs-wabt.js` (byte-for-byte against the reference assembler) and `kernels.js` (every version against JS) |

## Is it right?

**The assembler:** for the kernel modules plus eight syntax test cases, MicroWAT's output is **byte-identical to wabt's** (wabt is WebAssembly's reference toolkit). That includes the exact case that broke WASM-Kernel 1.0.
```
node tests/vs-wabt.js     # needs `npm i wabt` (test-only; the library itself has no dependencies)
→ ALL BYTE-IDENTICAL TO WABT
```

**The kernels:** across seven shapes, including empty ones, scalar wasm matches the JS reference **bit for bit**. SIMD matches within float rounding (max relative error 6 × 10⁻⁶ at 1024 columns), because it adds in a different order, as any SIMD sum does.
```
node tests/kernels.js
→ ALL KERNELS AGREE
```

## Is it faster?

Median time per call; speed-up relative to plain JS (`js natural`: a float64 accumulator, the way you'd normally write it). `js exact-f32` rounds every step to float32 so it matches wasm bit for bit, which is what it costs to make JS deterministic in the same way.

**Chromium 153**

| kernel | size | plain JS | scalar wasm | **SIMD wasm** |
|---|---|---|---|---|
| float32 | 256×256 | 0.348 ms | 0.076 ms (4.6×) | **0.016 ms (21×)** |
| float32 | 1024×1024 | 6.361 ms | 1.295 ms (4.9×) | **0.313 ms (20×)** |
| float32 | 4096×1024 | 23.76 ms | 5.720 ms (4.2×) | **2.020 ms (12×)** |
| ternary | 256×256 | 0.125 ms | 0.114 ms (1.1×) | **0.019 ms (6.6×)** |
| ternary | 1024×1024 | 2.005 ms | 1.197 ms (1.7×) | **0.329 ms (6.1×)** |
| ternary | 4096×1024 | 8.760 ms | 4.650 ms (1.9×) | **1.300 ms (6.7×)** |

**Node 22 (V8)**

| kernel | size | plain JS | scalar wasm | **SIMD wasm** |
|---|---|---|---|---|
| float32 | 256×256 | 0.159 ms | 0.076 ms (2.1×) | **0.016 ms (9.7×)** |
| float32 | 1024×1024 | 2.559 ms | 1.449 ms (1.8×) | **0.318 ms (8.0×)** |
| float32 | 4096×1024 | 10.64 ms | 5.557 ms (1.9×) | **1.750 ms (6.1×)** |
| ternary | 256×256 | 0.173 ms | 0.111 ms (1.6×) | **0.020 ms (8.6×)** |
| ternary | 1024×1024 | 2.682 ms | 1.151 ms (2.3×) | **0.333 ms (8.1×)** |
| ternary | 4096×1024 | 12.32 ms | 4.504 ms (2.7×) | **1.285 ms (9.6×)** |

How to read it:
- **The wasm and SIMD times are steady.** They're nearly identical in both engines, because wasm compiles ahead of time and doesn't depend on the JIT's mood. **The JS times are not**: the same JS function was 2.5× slower in Chromium than in Node for float32 here. So "how many times faster" depends mostly on how well the JS side happened to be optimized, and **the realistic range is about 6–20× for SIMD**.
- **SIMD is where the win is.** Scalar wasm alone gives roughly 1.1–5×.
- **The largest size is limited by memory**, not by maths: 16 MB of float32 weights have to stream through the cache on every call, so the gain shrinks. Ternary at int8 is a quarter of the bytes, which is one reason ternary holds its speed-up at size.
- The ternary SIMD kernel turns int8 weights into floats and multiplies. A version that never converts (bit masks: add x where the weight is +1, subtract where it's −1) might be faster still. That's the next experiment.

Measured November 4, 2026 in a 2-core cloud container (Intel Xeon @ 2.8 GHz). Your machine will give different numbers; open `bench.html` and press Run. Raw results are in `results/`.

## Using it
```html
<script src="microwat.js"></script>
<script src="kernels.js"></script>
<script>
(async () => {
  const K = await WasmKernels.create();          // picks SIMD > scalar wasm > JS automatically
  const W = K.alloc('i8', rows * cols), x = K.alloc('f32', cols), y = K.alloc('f32', rows);
  W.view.set(myTernaryWeights); x.view.set(myInput);
  K.matvec_t8(W, x, y, rows, cols);              // y.view now holds the result
})();
</script>
```
Arrays live inside the wasm memory, so nothing is copied per call. For a single-file app, paste both scripts inline.

## Where this could go
- **LEARNS:** matvec is the forward pass, and the backward pass needs the transposed version (`Wᵀ · g`) plus an outer-product update. Those are the next three kernels.
- **AuraGraph / AuraLoom:** an FFT kernel (Griffin-Lim and Helix refinement are mostly FFTs).
- **Webster / OmniVocal:** the waveguide-mesh update.
- **TabComp:** probably not, since its CPU loop is branchy interpreter code, which JS JITs already handle well. Measure before porting.

*Kehai Interim, November 4, 2026. Built on the assembler in Kham's WASM-Kernel.*
