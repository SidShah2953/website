// Hero shader check: renders two versions of the Surface.astro fragment shader
// with identical uniforms, then reports GPU time per frame for each and how far
// apart the two images are. Use it before changing the shader, so a "faster"
// shader can be shown to draw the same picture.
//
//   node scripts/checks/shader.mjs <old Surface.astro> [new Surface.astro]
//   (new defaults to src/components/Surface.astro)
//
// Old can come straight from git:
//   git show main:src/components/Surface.astro > /tmp/old.astro
//
// Image difference is in 8-bit units of the premultiplied output: maxDiff is
// the worst single channel, meanDiff the average, and over2 the share of pixels
// where any channel moved by more than 2 (about the smallest step an eye can
// pick out in a dark gradient).
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const fsOf = (p) => {
  const m = readFileSync(p, "utf8").match(/const FS = `([\s\S]*?)`;/);
  if (!m) throw new Error(`no FS shader in ${p}`);
  return m[1];
};
const A = fsOf(process.argv[2]);
const B = fsOf(process.argv[3] || "src/components/Surface.astro");

// [width, height, time s, scroll 0..1, mouse x, mouse y]
const CASES = [
  [780, 1688, 3, 0, 0, 0], [780, 1688, 40, .5, .3, -.2], [780, 1688, 90, 1, -.5, .4],
  [2880, 1800, 3, 0, 0, 0], [2880, 1800, 40, .5, .3, -.2], [2880, 1800, 90, 1, -.5, .4],
];

const browser = await chromium.launch({ channel: "chrome", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"] });
const page = await browser.newPage();
const out = await page.evaluate(({ A, B, CASES }) => {
  const VS = `#version 300 es
  in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const cv = document.createElement("canvas");
  const gl = cv.getContext("webgl2", { antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
  const prog = (fs) => {
    const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  };
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const P = [prog(A), prog(B)];
  const px = new Uint8Array(4);
  const draw = (p, c) => {
    gl.useProgram(p);
    gl.uniform2f(gl.getUniformLocation(p, "uRes"), c[0], c[1]);
    gl.uniform1f(gl.getUniformLocation(p, "uTime"), c[2]);
    gl.uniform1f(gl.getUniformLocation(p, "uScroll"), c[3]);
    gl.uniform2f(gl.getUniformLocation(p, "uMouse"), c[4], c[5]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const time = (p, c) => {
    const t = [];
    for (let k = 0; k < 25; k++) {
      const s = performance.now(); draw(p, c);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); t.push(performance.now() - s);
    }
    t.sort((a, b) => a - b); return t[t.length >> 1];
  };
  const read = (p, c) => {
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); draw(p, c);
    const d = new Uint8Array(c[0] * c[1] * 4); gl.readPixels(0, 0, c[0], c[1], gl.RGBA, gl.UNSIGNED_BYTE, d); return d;
  };
  return CASES.map((c) => {
    cv.width = c[0]; cv.height = c[1]; gl.viewport(0, 0, c[0], c[1]);
    for (const p of P) time(p, c);                      // warm both
    const ta = time(P[0], c), tb = time(P[1], c);
    const a = read(P[0], c), b = read(P[1], c);
    let max = 0, sum = 0, over = 0;
    for (let i = 0; i < a.length; i += 4) {
      let m = 0;
      for (let k = 0; k < 4; k++) { const d = Math.abs(a[i + k] - b[i + k]); sum += d; if (d > m) m = d; }
      if (m > max) max = m; if (m > 2) over++;
    }
    return { size: `${c[0]}x${c[1]}`, time: c[2], scroll: c[3], oldMs: +ta.toFixed(2), newMs: +tb.toFixed(2),
      maxDiff: max, meanDiff: +(sum / a.length).toFixed(3), over2: +(100 * over / (a.length / 4)).toFixed(3) + "%" };
  });
}, { A, B, CASES });
console.log("GPU:", await page.evaluate(() => { const g = document.createElement("canvas").getContext("webgl2"); const e = g.getExtension("WEBGL_debug_renderer_info"); return g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER); }));
console.table(out);
await browser.close();
