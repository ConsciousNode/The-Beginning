// Dev-only check: MicroWAT's bytes must equal wabt's (the reference assembler)
// for the kernel modules and a set of syntax cases. Needs `npm i wabt` somewhere
// on NODE_PATH; the library itself has no dependencies.
const MicroWAT = require('../microwat.js');
const K = require('../kernels.js');
const CASES = {
  kernels_scalar: K.WAT_SCALAR,
  kernels_simd: K.WAT_SIMD,
  folded_if: `(module (func (export "f") (param $a i32) (result i32)
     (if (result i32) (i32.gt_s (local.get $a) (i32.const 35)) (then (i32.const 1)) (else (i32.const -1)))))`,
  // the bug that broke WASM-Kernel 1.0: operands that look like opcodes
  operand_35: `(module (global $g (mut i32) (i32.const 0)) (func (export "f") (result i32)
     i32.const 35 global.set $g i32.const 0x23 i32.const 0x1000 i32.add global.get $g i32.add))`,
  memory_export_data: `(module (memory (export "mem") 1 4) (data (i32.const 16) "hi\\0a\\00")
     (func (export "g") (result i32) i32.const 16 i32.load8_u offset=1))`,
  floats_globals_calls: `(module (global $s (export "s") (mut f32) (f32.const 1.5))
     (func $sq (param f32) (result f32) local.get 0 local.get 0 f32.mul)
     (func (export "h") (param $x f64) (result f32) local.get $x f32.demote_f64 call $sq global.get $s f32.add))`,
  i64_and_labels: `(module (func (export "k") (result i64) (local $i i32)
     block $out loop $in local.get $i i32.const 1 i32.add local.tee $i i32.const 10 i32.ge_s br_if $out br $in end end
     i64.const -5000000000))`,
  imports: `(module (import "env" "log" (func $log (param i32))) (import "env" "mem" (memory 2 8))
     (import "env" "g" (global $g i32)) (func (export "m") global.get $g call $log))`,
};
(async () => {
  const wabt = await require('wabt')();
  let bad = 0;
  for (const [name, src] of Object.entries(CASES)) {
    const ref = Buffer.from(wabt.parseWat(name + '.wat', src, { simd: true }).toBinary({}).buffer);
    const ours = Buffer.from(MicroWAT.assemble(src));
    const same = ref.equals(ours);
    if (!same) bad++;
    console.log((same ? 'SAME ' : 'DIFF ') + name.padEnd(22) + ` ${ours.length} B` + (same ? '' : ` (wabt ${ref.length} B)`));
  }
  console.log(bad ? `${bad} DIFFERENT` : 'ALL BYTE-IDENTICAL TO WABT');
  process.exit(bad ? 1 : 0);
})();
