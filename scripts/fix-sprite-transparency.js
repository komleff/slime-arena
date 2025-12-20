/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function colorDistanceSq(a, b) {
    const dr = a[0] - b[0];
    const dg = a[1] - b[1];
    const db = a[2] - b[2];
    return dr * dr + dg * dg + db * db;
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pickBackgroundColor(png) {
    const w = png.width;
    const h = png.height;
    const points = [
        [0, 0],
        [w - 1, 0],
        [0, h - 1],
        [w - 1, h - 1],
        [Math.floor(w / 2), 0],
        [Math.floor(w / 2), h - 1],
        [0, Math.floor(h / 2)],
        [w - 1, Math.floor(h / 2)],
    ];

    const rs = [];
    const gs = [];
    const bs = [];
    for (const [x, y] of points) {
        const idx = (png.width * y + x) << 2;
        rs.push(png.data[idx]);
        gs.push(png.data[idx + 1]);
        bs.push(png.data[idx + 2]);
    }
    return [median(rs), median(gs), median(bs)];
}

function hasAnyTransparency(png) {
    for (let i = 3; i < png.data.length; i += 4) {
        if (png.data[i] < 255) return true;
    }
    return false;
}

function processPngBuffer(buffer, opts) {
    const png = PNG.sync.read(buffer);
    if (hasAnyTransparency(png)) {
        return { changed: false, buffer };
    }

    const bg = pickBackgroundColor(png);
    const threshold = clamp(Number(opts.threshold ?? 28), 0, 255);
    const feather = clamp(Number(opts.feather ?? 20), 0, 255);
    const thresholdSq = threshold * threshold;
    const featherSq = (threshold + feather) * (threshold + feather);

    let changed = false;
    for (let i = 0; i < png.data.length; i += 4) {
        const pixel = [png.data[i], png.data[i + 1], png.data[i + 2]];
        const distSq = colorDistanceSq(pixel, bg);
        if (distSq <= thresholdSq) {
            if (png.data[i + 3] !== 0) {
                png.data[i + 3] = 0;
                changed = true;
            }
        } else if (feather > 0 && distSq <= featherSq) {
            const t = (distSq - thresholdSq) / Math.max(1, featherSq - thresholdSq);
            const alpha = Math.round(255 * clamp(t, 0, 1));
            if (alpha < png.data[i + 3]) {
                png.data[i + 3] = alpha;
                changed = true;
            }
        }
    }

    if (!changed) return { changed: false, buffer };
    return { changed: true, buffer: PNG.sync.write(png) };
}

function main() {
    const argv = process.argv.slice(2);
    const opts = {
        threshold: 28,
        feather: 20,
        dir: "assets/sprites/slimes/base",
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--dir") opts.dir = argv[++i];
        else if (arg === "--threshold") opts.threshold = Number(argv[++i]);
        else if (arg === "--feather") opts.feather = Number(argv[++i]);
    }

    const dir = path.resolve(process.cwd(), opts.dir);
    const entries = fs.readdirSync(dir).filter((name) => name.toLowerCase().endsWith(".png"));

    let changedCount = 0;
    for (const name of entries) {
        const filePath = path.join(dir, name);
        const raw = fs.readFileSync(filePath);
        const result = processPngBuffer(raw, opts);
        if (result.changed) {
            fs.writeFileSync(filePath, result.buffer);
            changedCount += 1;
            console.log(`fixed alpha: ${opts.dir}/${name}`);
        }
    }

    console.log(`done: ${changedCount}/${entries.length} updated`);
}

main();

