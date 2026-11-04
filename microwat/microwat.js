/* MicroWAT 2 — a tiny WebAssembly-text assembler in plain JavaScript.
 * ConsciousNode SoftWorks · MIT
 *
 * Grown from the assembler inside WASM-Kernel (March 2026), with its bugs
 * fixed and SIMD added, so any single-file Xinu app can carry hand-written
 * WebAssembly as *text* and assemble it at load time: no toolchain, no
 * binary blobs, no dependencies.
 *
 * Supports a deliberately small subset of WAT:
 *   (module ...) with func, import (func | memory), memory, global, export, data
 *   params / results / locals, named ($x) or numbered
 *   flat or folded instructions; block / loop / if with optional (result t)
 *   i32, i64 (const only + basic), f32, f64 arithmetic and comparisons
 *   loads / stores with offset= / align=
 *   SIMD (v128): load / store, splat, extract_lane, f32x4 math,
 *   integer widening, conversions
 *
 * Usage:  const bytes = MicroWAT.assemble(watText);
 *         const { instance } = await WebAssembly.instantiate(bytes, imports);
 */
(function (root) {
  'use strict';

  const T = { i32: 0x7F, i64: 0x7E, f32: 0x7D, f64: 0x7C, v128: 0x7B };

  // name -> [opcode, immediateKind]. Kinds:
  //  none · i32 (sleb) · i64 (sleb) · f32 · f64 · local · global · func · label
  //  block (blocktype) · mem (memarg, natural align given) · lane (1 byte)
  // Opcodes >= 0xFD00 are SIMD: 0xFD prefix + uleb(op & 0xFFF... see emit).
  const OPS = {};
  const def = (list, kind) => { for (const [n, op, a] of list) OPS[n] = [op, kind, a]; };

  def([['unreachable', 0x00], ['nop', 0x01], ['else', 0x05], ['end', 0x0B], ['return', 0x0F],
       ['drop', 0x1A], ['select', 0x1B]], 'none');
  def([['block', 0x02], ['loop', 0x03], ['if', 0x04]], 'block');
  def([['br', 0x0C], ['br_if', 0x0D]], 'label');
  def([['call', 0x10]], 'func');
  def([['local.get', 0x20], ['local.set', 0x21], ['local.tee', 0x22]], 'local');
  def([['global.get', 0x23], ['global.set', 0x24]], 'global');
  def([['i32.load', 0x28, 2], ['i64.load', 0x29, 3], ['f32.load', 0x2A, 2], ['f64.load', 0x2B, 3],
       ['i32.load8_s', 0x2C, 0], ['i32.load8_u', 0x2D, 0], ['i32.load16_s', 0x2E, 1], ['i32.load16_u', 0x2F, 1],
       ['i32.store', 0x36, 2], ['i64.store', 0x37, 3], ['f32.store', 0x38, 2], ['f64.store', 0x39, 3],
       ['i32.store8', 0x3A, 0], ['i32.store16', 0x3B, 1]], 'mem');
  def([['memory.size', 0x3F], ['memory.grow', 0x40]], 'memidx');
  def([['i32.const', 0x41]], 'i32');
  def([['i64.const', 0x42]], 'i64');
  def([['f32.const', 0x43]], 'f32');
  def([['f64.const', 0x44]], 'f64');
  def([
    ['i32.eqz', 0x45], ['i32.eq', 0x46], ['i32.ne', 0x47], ['i32.lt_s', 0x48], ['i32.lt_u', 0x49],
    ['i32.gt_s', 0x4A], ['i32.gt_u', 0x4B], ['i32.le_s', 0x4C], ['i32.le_u', 0x4D], ['i32.ge_s', 0x4E], ['i32.ge_u', 0x4F],
    ['f32.eq', 0x5B], ['f32.ne', 0x5C], ['f32.lt', 0x5D], ['f32.gt', 0x5E], ['f32.le', 0x5F], ['f32.ge', 0x60],
    ['f64.eq', 0x61], ['f64.ne', 0x62], ['f64.lt', 0x63], ['f64.gt', 0x64], ['f64.le', 0x65], ['f64.ge', 0x66],
    ['i32.clz', 0x67], ['i32.ctz', 0x68], ['i32.popcnt', 0x69],
    ['i32.add', 0x6A], ['i32.sub', 0x6B], ['i32.mul', 0x6C], ['i32.div_s', 0x6D], ['i32.div_u', 0x6E],
    ['i32.rem_s', 0x6F], ['i32.rem_u', 0x70], ['i32.and', 0x71], ['i32.or', 0x72], ['i32.xor', 0x73],
    ['i32.shl', 0x74], ['i32.shr_s', 0x75], ['i32.shr_u', 0x76], ['i32.rotl', 0x77], ['i32.rotr', 0x78],
    ['i64.add', 0x7C], ['i64.sub', 0x7D], ['i64.mul', 0x7E],
    ['f32.abs', 0x8B], ['f32.neg', 0x8C], ['f32.ceil', 0x8D], ['f32.floor', 0x8E], ['f32.sqrt', 0x91],
    ['f32.add', 0x92], ['f32.sub', 0x93], ['f32.mul', 0x94], ['f32.div', 0x95], ['f32.min', 0x96], ['f32.max', 0x97],
    ['f64.abs', 0x99], ['f64.neg', 0x9A], ['f64.sqrt', 0x9F],
    ['f64.add', 0xA0], ['f64.sub', 0xA1], ['f64.mul', 0xA2], ['f64.div', 0xA3],
    ['i32.wrap_i64', 0xA7], ['i32.trunc_f32_s', 0xA8], ['i64.extend_i32_s', 0xAC], ['i64.extend_i32_u', 0xAD],
    ['f32.convert_i32_s', 0xB2], ['f32.convert_i32_u', 0xB3], ['f32.demote_f64', 0xB6],
    ['f64.convert_i32_s', 0xB7], ['f64.promote_f32', 0xBB],
    ['i32.reinterpret_f32', 0xBC], ['f32.reinterpret_i32', 0xBE],
  ], 'none');

  // SIMD (0xFD prefix). Stored as 0xFD00 | op.
  const S = op => 0xFD00 | op;
  def([['v128.load', S(0x00), 4], ['v128.store', S(0x0B), 4]], 'mem');
  def([['f32x4.extract_lane', S(0x1F)], ['i32x4.extract_lane', S(0x1B)]], 'lane');
  def([
    ['i8x16.splat', S(0x0F)], ['i16x8.splat', S(0x10)], ['i32x4.splat', S(0x11)], ['f32x4.splat', S(0x13)],
    ['v128.not', S(0x4D)], ['v128.and', S(0x4E)], ['v128.andnot', S(0x4F)], ['v128.or', S(0x50)], ['v128.xor', S(0x51)],
    ['v128.bitselect', S(0x52)],
    ['i8x16.eq', S(0x23)], ['i32x4.eq', S(0x37)],
    ['i16x8.extend_low_i8x16_s', S(0x87)], ['i16x8.extend_high_i8x16_s', S(0x88)],
    ['i32x4.extend_low_i16x8_s', S(0xA7)], ['i32x4.extend_high_i16x8_s', S(0xA8)],
    ['i32x4.add', S(0xAE)], ['i32x4.sub', S(0xB1)], ['i32x4.mul', S(0xB5)],
    ['f32x4.abs', S(0xE0)], ['f32x4.neg', S(0xE1)], ['f32x4.sqrt', S(0xE3)],
    ['f32x4.add', S(0xE4)], ['f32x4.sub', S(0xE5)], ['f32x4.mul', S(0xE6)], ['f32x4.div', S(0xE7)],
    ['f32x4.min', S(0xE8)], ['f32x4.max', S(0xE9)],
    ['f32x4.convert_i32x4_s', S(0xFA)],
  ], 'none');

  // ---------- encoding helpers ----------
  const uleb = v => { const b = []; v = v >>> 0; do { let x = v & 0x7f; v >>>= 7; if (v) x |= 0x80; b.push(x); } while (v); return b; };
  const sleb = v => { // works for i32 and (BigInt) i64
    const big = typeof v === 'bigint'; const b = [];
    for (;;) {
      const x = Number(big ? (v & 0x7fn) : (v & 0x7f));
      v = big ? (v >> 7n) : (v >> 7);
      const done = big ? ((v === 0n && !(x & 0x40)) || (v === -1n && (x & 0x40)))
                       : ((v === 0 && !(x & 0x40)) || (v === -1 && (x & 0x40)));
      b.push(done ? x : x | 0x80); if (done) return b;
    }
  };
  const f32b = v => [...new Uint8Array(new Float32Array([v]).buffer)];
  const f64b = v => [...new Uint8Array(new Float64Array([v]).buffer)];
  const str = s => { const u = new TextEncoder().encode(s); return [...uleb(u.length), ...u]; };
  const vec = items => [...uleb(items.length), ...items.flat()];
  const section = (id, items) => items.length ? (b => [id, ...uleb(b.length), ...b])(vec(items)) : [];
  const int = s => { if (typeof s !== 'string') throw new Error('MicroWAT: expected a number, got ' + JSON.stringify(s)); return parseInt(s.replace(/_/g, ''), s.startsWith('0x') || s.startsWith('-0x') ? 16 : 10); };
  const num = s => { s = s.replace(/_/g, ''); if (/^-?0x/.test(s)) return parseInt(s, 16); if (s === 'inf') return Infinity; if (s === '-inf') return -Infinity; if (s === 'nan') return NaN; return parseFloat(s); };

  // ---------- reader ----------
  function tokenize(src) {
    const t = []; let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === '(' && src[i + 1] === ';') { const j = src.indexOf(';)', i); i = j < 0 ? src.length : j + 2; }
      else if (c === '(' || c === ')') { t.push(c); i++; }
      else if (/\s/.test(c)) i++;
      else if (c === ';' && src[i + 1] === ';') { while (i < src.length && src[i] !== '\n') i++; }
      else if (c === '"') {
        let s = []; i++;
        while (i < src.length && src[i] !== '"') {
          if (src[i] === '\\') {
            const n = src[i + 1];
            if (/[0-9a-fA-F]/.test(n) && /[0-9a-fA-F]/.test(src[i + 2])) { s.push(parseInt(src.substr(i + 1, 2), 16)); i += 3; continue; }
            s.push(...new TextEncoder().encode({ n: '\n', t: '\t', '\\': '\\', '"': '"', "'": "'" }[n] ?? n)); i += 2; continue;
          }
          const cp = src.codePointAt(i); const ch = String.fromCodePoint(cp);
          s.push(...new TextEncoder().encode(ch)); i += ch.length;
        }
        t.push({ bytes: s, text: new TextDecoder().decode(new Uint8Array(s)) }); i++;
      } else { let w = ''; while (i < src.length && !/[\s()";]/.test(src[i])) w += src[i++]; t.push(w); }
    }
    return t;
  }
  function parse(tokens) {
    let p = 0;
    const read = () => {
      const t = tokens[p++];
      if (t === '(') { const l = []; while (tokens[p] !== ')') { if (p >= tokens.length) throw new Error('MicroWAT: missing )'); l.push(read()); } p++; return l; }
      if (t === ')') throw new Error('MicroWAT: unexpected )');
      return t;
    };
    const top = read(); if (!Array.isArray(top) || top[0] !== 'module') throw new Error('MicroWAT: root must be (module ...)');
    return top;
  }

  // ---------- assembler ----------
  function assemble(src) {
    const mod = parse(tokenize(src));
    const types = [], imports = [], funcs = [], mems = [], globals = [], exports = [], datas = [];
    const funcIdx = {}, globalIdx = {}, memIdx = {};
    let nFunc = 0, nGlobal = 0, nMem = 0;
    const typeOf = (params, results) => {
      const key = params.join(',') + '>' + results.join(',');
      let i = types.findIndex(t => t.key === key);
      if (i < 0) { i = types.length; types.push({ key, params, results }); }
      return i;
    };
    const isName = x => typeof x === 'string' && x[0] === '$';
    const sig = items => { // reads (param ...) (result ...) → {params, results, names}
      const params = [], results = [], names = [];
      for (const it of items) {
        if (!Array.isArray(it)) continue;
        if (it[0] === 'param') {
          if (isName(it[1])) { names.push(it[1]); params.push(T[it[2]]); }
          else for (const ty of it.slice(1)) { names.push(null); params.push(T[ty]); }
        } else if (it[0] === 'result') for (const ty of it.slice(1)) results.push(T[ty]);
      }
      return { params, results, names };
    };
    const inlineExport = (items, kind, index) => {
      for (const it of items) if (Array.isArray(it) && it[0] === 'export') exports.push({ name: it[1].text, kind, index });
    };

    // pass 1: imports, then index every definition (imports come first in index spaces)
    for (const n of mod.slice(1)) if (n[0] === 'import') {
      const [, m, f, d] = n; const name = isName(d[1]) ? d[1] : null;
      if (d[0] === 'func') { const s = sig(d.slice(1)); imports.push([...str(m.text), ...str(f.text), 0, ...uleb(typeOf(s.params, s.results))]); if (name) funcIdx[name] = nFunc; nFunc++; }
      else if (d[0] === 'memory') { const lim = d.filter(x => typeof x === 'string' && /^\d+$/.test(x)).map(Number); imports.push([...str(m.text), ...str(f.text), 2, ...(lim.length > 1 ? [1, ...uleb(lim[0]), ...uleb(lim[1])] : [0, ...uleb(lim[0])])]); if (name) memIdx[name] = nMem; nMem++; }
      else if (d[0] === 'global') { const ty = d[d.length - 1]; const mut = Array.isArray(ty) && ty[0] === 'mut'; imports.push([...str(m.text), ...str(f.text), 3, T[mut ? ty[1] : ty], mut ? 1 : 0]); if (name) globalIdx[name] = nGlobal; nGlobal++; }
      else throw new Error('MicroWAT: unsupported import ' + d[0]);
    }
    for (const n of mod.slice(1)) {
      if (n[0] === 'func') { if (isName(n[1])) funcIdx[n[1]] = nFunc; n.index = nFunc++; }
      else if (n[0] === 'global') { if (isName(n[1])) globalIdx[n[1]] = nGlobal; n.index = nGlobal++; }
      else if (n[0] === 'memory') { if (isName(n[1])) memIdx[n[1]] = nMem; n.index = nMem++; }
    }

    // pass 2: definitions
    for (const n of mod.slice(1)) {
      const k = n[0];
      if (k === 'memory') {
        const lim = n.filter(x => typeof x === 'string' && /^\d+$/.test(x)).map(Number);
        mems.push(lim.length > 1 ? [1, ...uleb(lim[0]), ...uleb(lim[1])] : [0, ...uleb(lim[0])]);
        inlineExport(n, 2, n.index);
      } else if (k === 'global') {
        const rest = n.slice(isName(n[1]) ? 2 : 1).filter(x => !(Array.isArray(x) && x[0] === 'export'));
        const [ty, init] = rest; const mut = Array.isArray(ty) && ty[0] === 'mut';
        globals.push([T[mut ? ty[1] : ty], mut ? 1 : 0, ...constExpr(init), 0x0B]);
        inlineExport(n, 3, n.index);
      } else if (k === 'export') {
        const d = n[2]; const kind = { func: 0, memory: 2, global: 3 }[d[0]];
        const map = { 0: funcIdx, 2: memIdx, 3: globalIdx }[kind];
        exports.push({ name: n[1].text, kind, index: isName(d[1]) ? map[d[1]] : int(d[1]) });
      } else if (k === 'data') {
        const off = n.find(x => Array.isArray(x)); const bytes = n.filter(x => x && x.bytes).flatMap(x => x.bytes);
        datas.push([0, ...constExpr(off), 0x0B, ...uleb(bytes.length), ...bytes]);
      } else if (k === 'func') {
        const items = n.slice(isName(n[1]) ? 2 : 1);
        const s = sig(items);
        const locals = {}; s.names.forEach((nm, i) => { if (nm) locals[nm] = i; });
        const localTypes = []; let li = s.params.length; let bodyStart = 0;
        for (let j = 0; j < items.length; j++) {
          const it = items[j];
          if (Array.isArray(it) && ['export', 'param', 'result', 'local', 'type'].includes(it[0])) {
            if (it[0] === 'local') {
              if (isName(it[1])) { locals[it[1]] = li++; localTypes.push(T[it[2]]); }
              else for (const ty of it.slice(1)) { li++; localTypes.push(T[ty]); }
            }
            bodyStart = j + 1;
          } else break;
        }
        inlineExport(items, 0, n.index);
        const ctx = { locals, funcIdx, globalIdx, labels: [] };
        const code = [];
        emitSeq(items.slice(bodyStart), code, ctx);
        code.push(0x0B);
        const groups = []; for (const t of localTypes) { const g = groups[groups.length - 1]; if (g && g[1] === t) g[0]++; else groups.push([1, t]); }
        const body = [...vec(groups.map(([c, t]) => [...uleb(c), t])), ...code];
        funcs.push({ type: typeOf(s.params, s.results), body });
      } else if (k !== 'import' && k !== 'type') throw new Error('MicroWAT: unsupported module field ' + k);
    }

    function constExpr(e) {
      if (!Array.isArray(e)) throw new Error('MicroWAT: expected a constant expression');
      const [op, v] = e;
      if (op === 'i32.const') return [0x41, ...sleb(int(v) | 0)];
      if (op === 'i64.const') return [0x42, ...sleb(BigInt(v))];
      if (op === 'f32.const') return [0x43, ...f32b(num(v))];
      if (op === 'f64.const') return [0x44, ...f64b(num(v))];
      if (op === 'global.get') return [0x23, ...uleb(isName(v) ? globalIdx[v] : int(v))];
      throw new Error('MicroWAT: unsupported constant expression ' + op);
    }

    // Instructions: a flat stream of words plus folded (op args...) lists.
    function emitSeq(list, out, ctx) {
      for (let i = 0; i < list.length; i++) {
        const x = list[i];
        if (Array.isArray(x)) { emitFolded(x, out, ctx); continue; }
        const spec = OPS[x]; if (!spec) throw new Error('MicroWAT: unknown instruction "' + x + '"');
        const [, kind] = spec;
        const imm = [];
        if (kind === 'block') { // optional $label, optional (result t)
          if (isName(list[i + 1])) imm.push(list[++i]);
          if (Array.isArray(list[i + 1]) && list[i + 1][0] === 'result') imm.push(list[++i]);
        } else if (kind === 'mem') { while (typeof list[i + 1] === 'string' && /^(offset|align)=/.test(list[i + 1])) imm.push(list[++i]); }
        else if (kind !== 'none' && kind !== 'memidx') imm.push(list[++i]);
        emitOp(x, imm, out, ctx);
      }
    }
    function emitFolded(x, out, ctx) {
      const op = x[0];
      if (op === 'block' || op === 'loop') {
        let j = 1; const imm = [];
        if (isName(x[j])) imm.push(x[j++]);
        if (Array.isArray(x[j]) && x[j][0] === 'result') imm.push(x[j++]);
        emitOp(op, imm, out, ctx); emitSeq(x.slice(j), out, ctx); emitOp('end', [], out, ctx); return;
      }
      if (op === 'if') {
        let j = 1; const imm = [];
        if (isName(x[j])) imm.push(x[j++]);
        if (Array.isArray(x[j]) && x[j][0] === 'result') imm.push(x[j++]);
        const rest = x.slice(j);
        const thenI = rest.findIndex(y => Array.isArray(y) && y[0] === 'then');
        const elseI = rest.findIndex(y => Array.isArray(y) && y[0] === 'else');
        for (const c of rest.slice(0, thenI < 0 ? rest.length : thenI)) emitFolded(c, out, ctx); // condition
        emitOp('if', imm, out, ctx);
        if (thenI >= 0) emitSeq(rest[thenI].slice(1), out, ctx);
        if (elseI >= 0) { emitOp('else', [], out, ctx); emitSeq(rest[elseI].slice(1), out, ctx); }
        emitOp('end', [], out, ctx); return;
      }
      const spec = OPS[op]; if (!spec) throw new Error('MicroWAT: unknown instruction "' + op + '"');
      const kind = spec[1]; let j = 1; const imm = [];
      if (kind === 'mem') { while (typeof x[j] === 'string' && /^(offset|align)=/.test(x[j])) imm.push(x[j++]); }
      else if (kind !== 'none' && kind !== 'memidx') imm.push(x[j++]);
      for (const a of x.slice(j)) { if (Array.isArray(a)) emitFolded(a, out, ctx); else throw new Error('MicroWAT: stray operand "' + a + '" in (' + op + ' ...)'); }
      emitOp(op, imm, out, ctx);
    }
    function emitOp(name, imm, out, ctx) {
      const [op, kind, natAlign] = OPS[name];
      if (op >= 0xFD00) out.push(0xFD, ...uleb(op & 0xFF)); else out.push(op);
      const ref = (v, map, what) => { if (isName(v)) { if (!(v in map)) throw new Error('MicroWAT: unknown ' + what + ' ' + v); return map[v]; } return int(v); };
      switch (kind) {
        case 'none': break;
        case 'i32': out.push(...sleb(int(imm[0]) | 0)); break;
        case 'i64': out.push(...sleb(BigInt(imm[0]))); break;
        case 'f32': out.push(...f32b(num(imm[0]))); break;
        case 'f64': out.push(...f64b(num(imm[0]))); break;
        case 'local': out.push(...uleb(ref(imm[0], ctx.locals, 'local'))); break;
        case 'global': out.push(...uleb(ref(imm[0], ctx.globalIdx, 'global'))); break;
        case 'func': out.push(...uleb(ref(imm[0], ctx.funcIdx, 'function'))); break;
        case 'memidx': out.push(0x00); break;
        case 'lane': out.push(int(imm[0])); break;
        case 'label': {
          const v = imm[0];
          if (isName(v)) { const d = ctx.labels.length - 1 - ctx.labels.lastIndexOf(v); if (d > ctx.labels.length - 1) throw new Error('MicroWAT: unknown label ' + v); out.push(...uleb(d)); }
          else out.push(...uleb(int(v)));
          break;
        }
        case 'block': {
          let label = null, bt = 0x40;
          for (const v of imm) { if (isName(v)) label = v; else if (Array.isArray(v)) bt = T[v[1]]; }
          out.push(bt); ctx.labels.push(label); break;
        }
        case 'mem': {
          let offset = 0, align = natAlign;
          for (const v of imm) { const [k, n] = v.split('='); if (k === 'offset') offset = int(n); else align = Math.log2(int(n)); }
          out.push(...uleb(align), ...uleb(offset)); break;
        }
      }
      if (name === 'end' && ctx.labels.length) ctx.labels.pop();
    }

    return new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      ...section(1, types.map(t => [0x60, ...uleb(t.params.length), ...t.params, ...uleb(t.results.length), ...t.results])),
      ...section(2, imports),
      ...section(3, funcs.map(f => uleb(f.type))),
      ...section(5, mems),
      ...section(6, globals),
      ...section(7, exports.map(e => [...str(e.name), e.kind, ...uleb(e.index)])),
      ...section(10, funcs.map(f => [...uleb(f.body.length), ...f.body])),
      ...section(11, datas),
    ]);
  }

  const MicroWAT = { assemble, version: '2.0.0' };
  if (typeof module === 'object' && module.exports) module.exports = MicroWAT;
  else root.MicroWAT = MicroWAT;
})(typeof globalThis !== 'undefined' ? globalThis : this);
