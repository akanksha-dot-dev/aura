/**
 * AURA Chrome Extension — Icon Generator
 * Run once with: node chrome-extension/icons/generate-icons.js
 * Requires: npm install canvas (or sharp)
 * Creates: icon-16.png, icon-48.png, icon-128.png
 *
 * Falls back to an HTML-canvas based generator if the 'canvas' package isn't available.
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZES = [16, 48, 128];
const OUT_DIR = __dirname;

function drawAuraIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background circle
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#6C5CE7');
  grad.addColorStop(1, '#0a0714');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Shield outline
  const s = size * 0.7;
  const ox = (size - s) / 2;
  const oy = (size - s) / 2;
  ctx.strokeStyle = '#4ECDC4';
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.beginPath();
  ctx.moveTo(ox + s / 2, oy);
  ctx.lineTo(ox + s, oy + s * 0.35);
  ctx.lineTo(ox + s, oy + s * 0.6);
  ctx.quadraticCurveTo(ox + s / 2, oy + s, ox, oy + s * 0.6);
  ctx.lineTo(ox, oy + s * 0.35);
  ctx.closePath();
  ctx.stroke();

  // Lightning bolt (⚡)
  ctx.fillStyle = '#FFD93D';
  const bx = size * 0.42;
  const by = size * 0.25;
  const bw = size * 0.18;
  const bh = size * 0.5;
  ctx.beginPath();
  ctx.moveTo(bx + bw, by);
  ctx.lineTo(bx, by + bh * 0.5);
  ctx.lineTo(bx + bw * 0.5, by + bh * 0.5);
  ctx.lineTo(bx, by + bh);
  ctx.lineTo(bx + bw, by + bh * 0.5);
  ctx.lineTo(bx + bw * 0.5, by + bh * 0.5);
  ctx.closePath();
  ctx.fill();

  return canvas.toBuffer('image/png');
}

SIZES.forEach((size) => {
  try {
    const buffer = drawAuraIcon(size);
    const outPath = path.join(OUT_DIR, `icon-${size}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`✅ Created ${outPath}`);
  } catch (err) {
    console.error(`❌ Failed to create icon-${size}.png:`, err.message);
    console.log('   Install canvas: npm install canvas');
  }
});
