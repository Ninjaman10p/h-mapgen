"use strict";
// shared state
const written = [];
const active = { pos: { x: 0, y: 0 },
    width: 20,
    height: 20,
    gap: 5,
    rot: 0,
    foreground: "green",
    background: "grey",
    grid: {},
    gen: { prob: 20,
        maxg: 5,
        minsz: 5,
        globst: 16
    }
};
// @ts-ignore
const canvas = document.getElementById("main");
const ctx = canvas.getContext('2d');
// IO (shared)
function main() {
    refresh();
}
main();
// repeated IO (shared)
function draw() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    for (const a of written)
        drawGrid(ctx, a);
    drawGrid(ctx, active);
    requestAnimationFrame(draw);
}
draw();
// IO from button
function refresh() {
    // @ts-ignore
    const fields = document.querySelectorAll("#controls > input");
    for (const i of fields) {
        updateInput(i);
    }
    refreshActive();
}
{
    // @ts-ignore
    const button = document.getElementById("refresh-button");
    if (button != null) {
        button.addEventListener("click", refresh);
        button.type = "button";
    }
}
// IO
function updateInput(elem) {
    const val = (elem.type == "number" ? parseInt : id)(elem.value);
    const target = elem.name.split(".");
    let current = { a: active };
    while (target.length > 1) {
        const move = target.shift();
        if (move == undefined)
            return;
        // @ts-ignore
        current = current[move];
    }
    // @ts-ignore
    current[target[0]] = val;
}
//IO
function drawGrid(ctx, a) {
    if (ctx == null)
        return;
    const prevFill = ctx.fillStyle;
    ctx.translate(a.pos.x, a.pos.y);
    ctx.rotate(a.rot);
    const fullSq = { down: true, right: true };
    for (const key in a.grid) {
        const sqr = a.grid[key];
        const pos = toPos(key);
        if (pos == null)
            continue;
        const xPos = pos.x * (a.width + a.gap);
        const yPos = pos.y * (a.height + a.gap);
        for (const cx of [true, false])
            for (const cy of [true, false]) {
                let fill = (cx || sqr.right) && (cy || sqr.down);
                const rightSq = a.grid[fromPos({ x: pos.x + 1, y: pos.y })];
                const downSq = a.grid[fromPos({ x: pos.x, y: pos.y + 1 })];
                if (!cx && !cy)
                    fill && (fill = (rightSq !== null && rightSq !== void 0 ? rightSq : fullSq).down
                        && (downSq !== null && downSq !== void 0 ? downSq : fullSq).right);
                ctx.fillStyle = fill ? a.foreground : a.background;
                if ((cy || downSq != undefined) && (cx || rightSq != undefined))
                    ctx.fillRect(xPos + (cx ? 0 : a.width), yPos + (cy ? 0 : a.height), cx ? a.width : a.gap, cy ? a.height : a.gap);
            }
    }
    ctx.rotate(-a.rot);
    ctx.translate(-a.pos.x, -a.pos.y);
    ctx.fillStyle = prevFill;
}
//IO
function refreshActive() {
    const grid = {};
    for (let x = 0; x < 40; x++)
        for (let y = 0; y < 40; y++)
            grid[fromPos({ x: x, y: y })] =
                { down: wFlip(active.gen.prob / 100),
                    right: wFlip(active.gen.prob / 100)
                };
    active.grid = grid;
    //const groups = genPathGroups(active)
    //trimGroupsOnSize(active.gen.minsz, active, groups)
}
// State
function trimGroupsOnSize(num, area, pathGroups) {
    let removing = pathGroups.filter(el => el.length < num);
    while (removing.length > 0) {
        const next = removing.pop();
        if (next == undefined)
            continue;
        for (const p of next)
            remPath(p, area, pathGroups);
    }
}
// IO/State
function remPath(p, area, pathGroups) {
    const t = area.grid[fromPos(p.pos)];
    if (t == undefined)
        return;
    if (p.down)
        t.down = true;
    else
        t.right = true;
    for (let g = 0; g < pathGroups.length; g++) {
        for (let i = 0; i < pathGroups[g].length; i++)
            if (p == pathGroups[g][i])
                pathGroups[g].splice(i, 1);
        if (pathGroups[g].length == 0) {
            pathGroups.splice(g, 1);
            g--;
        }
    }
}
// IO
function insPath(p, area, pathGroups) {
    const t = area.grid[fromPos(p.pos)];
    if (t == undefined)
        return;
    if (p.down)
        t.down = false;
    else
        t.right = false;
    updatePathGroups(p, pathGroups);
}
function findPathInGroups(p, pathGroups) {
    const reducer = (last, c) => last || pathEq(p, c);
    return pathGroups.filter(el => el.reduce(reducer, false));
}
function pathEq(p, c) {
    return posEq(p.pos, c.pos) && c.down == p.down;
}
function genPathGroups(area) {
    const paths = getAllPaths(area);
    const pathGroups = [];
    while (paths.length > 0) {
        const test = paths.pop();
        if (test == undefined)
            continue;
        updatePathGroups(test, pathGroups);
    }
    return pathGroups;
}
function splitGraph(graph) {
    const removed = [];
    const out = [];
    while (removed.length < graph.nodes.length) {
        let i = 0;
        while (removed.includes(i)) {
            if (i > graph.nodes.length) {
                return [];
            }
            i++;
        }
        const newsub = subgraphProjection([i], graph);
        for (const n of newsub)
            removed.push(n);
        out.push(newsub);
    }
    return out.map(e => resolveGraphProjection(e, graph));
}
function graphConnected(graph, eq) {
    return graph.nodes.length == subgraphWith([0], graph).nodes.length;
}
function nodeDegree(elem, graph, eq) {
    return projectNode(elem, graph, eq).map(el => graph.edges.filter(edge => edge[0] == el || edge[1] == el).length);
}
function subgraphWith(start, g) {
    return resolveGraphProjection(subgraphProjection(start, g), g);
}
function subgraphProjection(start, g) {
    const projection = [...start];
    let old = [...projection];
    let next = [...projection];
    while (next.length != 0) {
        old = next;
        next = [];
        for (const e of g.edges) {
            for (const n of old) {
                let val;
                if (n == e[0])
                    val = e[1];
                else if (n == e[1])
                    val = e[0];
                if (val != undefined && ![...projection, ...next].includes(val)) {
                    next.push(val);
                }
            }
        }
        for (const i of next)
            projection.push(i);
    }
    return projection;
}
function resolveGraphProjection(p, g) {
    const nodes = p.flatMap(n => g.nodes[n] == undefined ? [] : [[n, g.nodes[n]]]);
    const mapped = nodes.map(a => a[0]);
    const en = enumerate(mapped);
    const edges = g.edges.filter(e => mapped.includes(e[0]) && mapped.includes(e[1]));
    return { nodes: nodes.map(e => e[1])
        // @ts-ignore
        ,
        edges: edges
            .flatMap(e => preimage(en, e[0]).map(l => [l, e[1]]))
            .flatMap(e => preimage(en, e[1]).map(r => [e[0], r]))
    };
}
function projectNode(elem, g, eq) {
    const projection = [];
    for (let n = 0; n < g.nodes.length; n++)
        if (eq(g.nodes[n], elem))
            projection.push(n);
    return projection;
}
function enumerate(arr) {
    return arr.map((elem, i) => [i, elem]);
}
function preimage(f, b) {
    return f.flatMap(p => p[1] == b ? p[0] : []);
}
function genGlobs(area) {
    const graph = { nodes: [], edges: [] };
    for (const key in area.grid) {
        const pos = toPos(key);
        if (pos == null)
            continue;
        for (let i = 0; i < graph.nodes.length; i++) {
            const node = graph.nodes[i];
            const sqr = area.grid[fromPos(node)];
            if (sqr == undefined)
                continue;
            if (buildAdj([node, sqr], [pos, area.grid[key]]))
                graph.edges.push([i, graph.nodes.length]);
        }
        graph.nodes.push(pos);
    }
    return graph;
}
function inGlob(pos, glob) {
    const reducer = (last, next) => last || posEq(next, pos);
    return glob.nodes.reduce(reducer, false);
}
function buildAdj(a, b) {
    const x = b[0].x - a[0].x;
    const y = b[0].y - a[0].y;
    const f = x + y > 0 ? a[1] : b[1];
    return (Math.abs(x) == 1 && f.right && y == 0) || (Math.abs(y) == 1 && f.down && x == 0);
}
function posEq(a, b) {
    return a.x == b.x && a.y == b.y;
}
// Mutating
function updatePathGroups(path, pathGroups) {
    const included = [];
    for (let g = 0; g < pathGroups.length; g++)
        for (const p of pathGroups[g])
            if (pathAdj(path, p)) {
                included.push(g);
                break;
            }
    while (included.length > 1) {
        const rem = included.pop();
        if (rem == undefined)
            continue;
        for (let i = 0; i < included.length; i++)
            if (included[i] > rem)
                included[i]--;
        const moving = pathGroups.splice(rem, 1)[0];
        for (const p of moving)
            pathGroups[included[0]].push(p);
    }
    if (included.length == 1) {
        pathGroups[included[0]].push(path);
    }
    else {
        pathGroups.push([path]);
    }
}
function pathAdj(a, b) {
    const xDiff = b.pos.x - a.pos.x;
    const yDiff = b.pos.y - a.pos.y;
    const tang = a.down ? xDiff : yDiff;
    const norm = a.down ? yDiff : xDiff;
    if (b.down == a.down)
        return (Math.abs(tang) <= 1) && (norm == 0);
    else
        return (-1 <= tang && tang <= 0) && (0 <= norm && norm <= 1);
}
function getAllPaths(area) {
    return toList(area.grid).flatMap((sqr) => {
        const pos = toPos(sqr[0]);
        if (pos == null)
            return [];
        const glob = sqr[1];
        const out = [];
        if (!glob.down)
            out.push({ pos: pos, down: true });
        if (!glob.right)
            out.push({ pos: pos, down: false });
        return out;
    });
}
// loses typing
function toList(o) {
    // @ts-ignore
    return Object.keys(o).map(key => [key, o[key]]);
}
function fromPos(pos) {
    return `${pos.x},${pos.y}`;
}
function toPos(pos) {
    const split = pos.split(',');
    if (split.length !== 2)
        return null;
    return { x: parseInt(split[0]), y: parseInt(split[1]) };
}
// random
function wFlip(odds) {
    return Math.random() < odds;
}
function id(x) {
    return x;
}
