"use strict";
// IO
function main() {
    const canvas = document.getElementsByTagName("canvas")[0];
    const ctx = canvas.getContext('2d');
    drawGrid(ctx, { pos: { x: 10, y: 10 },
        width: 40,
        height: 40,
        gap: 10,
        rot: 0,
        foreground: "green",
        background: "grey",
        grid: { "0-0": { down: false, right: true },
            "0-1": { down: false, right: false },
            "1-0": { down: false, right: false },
            "1-1": { down: false, right: false }
        }
    });
}
main();
//IO
function drawGrid(ctx, a) {
    if (ctx == null)
        return;
    const prevFill = ctx.fillStyle;
    for (const key in a.grid) {
        const sqr = a.grid[key];
        const pos = toPos(key);
        if (pos == null)
            continue;
        const xPos = pos.x * (a.width + a.gap);
        const yPos = pos.y * (a.height + a.gap);
        for (const cx of [true, false])
            for (const cy of [true, false]) {
                ctx.fillStyle = (cx || sqr.right) && (cy || sqr.down) ? a.foreground : a.background;
                ctx.fillRect(xPos + (cx ? 0 : a.width), yPos + (cy ? 0 : a.height), cx ? a.height : a.gap, cy ? a.height : a.gap);
            }
    }
    ctx.fillStyle = prevFill;
}
function fromPos(pos) {
    return `${pos.x}-${pos.y}`;
}
function toPos(pos) {
    const split = pos.split('-');
    if (split.length !== 2)
        return null;
    return { x: parseInt(split[0]), y: parseInt(split[1]) };
}
