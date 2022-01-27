"use strict";
// shared state
const global = { written: {},
    active: {},
    render: { offset: { x: 0, y: 0 },
        width: 20,
        height: 20,
        gap: 5
    },
    mapname: "New Map"
};
const param = { prob: 20,
    minsz: 5,
    globsz: 5,
    randCh: 3,
    foreground: "brown",
    background: "grey",
    colors: [],
    colorprobs: []
};
// @ts-ignore
const canvas = document.getElementById("main");
const ctx = canvas.getContext('2d');
let selected = [];
let clickPos = null;
// IO (shared)
function main() {
    refresh();
    addButtonEventByID("refresh-button", "click", refresh);
    addButtonEventByID("add-cust-color", "click", addCustColor);
    addButtonEventByID("save-button", "click", save);
    // @ts-ignore
    const updatable = document.querySelectorAll("#controls input");
    for (const i of updatable)
        i.addEventListener("change", updateInput.bind(null, i));
    canvas.addEventListener("mousedown", startClick);
    canvas.addEventListener("mouseup", endClick);
}
main();
// IO
function addButtonEventByID(id, event, f) {
    // @ts-ignore
    const button = document.getElementById(id);
    if (button != null) {
        button.addEventListener(event, f);
        button.type = "button";
    }
}
// IO
function startClick(event) {
    //@ts-ignore
    const target = event.target;
    const render = global.render;
    const x = Math.floor((event.clientX - target.getBoundingClientRect().x) / (render.width + render.gap));
    const y = Math.floor((event.clientY - target.getBoundingClientRect().y) / (render.height + render.gap));
    if (event.ctrlKey) {
        const col = toColor(param.foreground);
        if (col == null) {
            alert("Invalid color");
            return;
        }
        setColor({ x: x, y: y }, global.written, col);
    }
    clickPos =
        { pos: { x: x,
                y: y
            },
            shiftMod: event.shiftKey,
            ctrlMod: event.ctrlKey
        };
}
/// IO
function endClick(event) {
    //@ts-ignore
    const target = event.target;
    const render = global.render;
    const x = Math.floor((event.clientX - target.getBoundingClientRect().x) / (render.width + render.gap));
    const y = Math.floor((event.clientY - target.getBoundingClientRect().y) / (render.height + render.gap));
    if (clickPos == null || clickPos.ctrlMod)
        return;
    if (!clickPos.shiftMod)
        selected = [];
    for (let i = Math.min(clickPos.pos.x, x); i <= Math.max(clickPos.pos.x, x); i++)
        for (let j = Math.min(clickPos.pos.y, y); j <= Math.max(clickPos.pos.y, y); j++) {
            const reducer = (last, current) => last || (current.x == i) && (current.y == j);
            if (!clickPos.shiftMod || !selected.reduce(reducer, false))
                selected.push({ x: i, y: j });
        }
}
// IO
function setColor(pos, area, color) {
    const globs = genGlobs(area);
    const match = [];
    for (let i = 0; i < globs.nodes.length; i++) {
        if (posEq(globs.nodes[i], pos))
            match.push(i);
    }
    const change = subgraphWith(match, globs);
    for (const p of change.nodes) {
        const sqr = area[fromPos(p)];
        if (sqr == undefined)
            continue;
        sqr.foreground = color;
    }
}
// IO
function addCustColor() {
    const container = document.getElementById("cust-colors");
    if (container == null)
        return;
    const currentCount = document.getElementsByClassName("cust-color-val").length;
    const label1 = document.createElement("label");
    label1.htmlFor = `g.colors.${currentCount}`;
    label1.innerText = `colour ${currentCount}`;
    const input1 = document.createElement("input");
    input1.value = "red";
    input1.type = "text";
    input1.name = `g.colors.${currentCount}`;
    input1.classList.add("cust-color-val");
    const label2 = document.createElement("label");
    label2.htmlFor = `g.colorprobs.${currentCount}`;
    label2.innerHTML = "probability (&pertenk;)";
    const input2 = document.createElement("input");
    input2.value = "1";
    input2.type = "number";
    input2.name = `g.colorprobs.${currentCount}`;
    container.appendChild(label1);
    container.appendChild(input1);
    container.appendChild(document.createElement("br"));
    container.appendChild(label2);
    container.appendChild(input2);
    container.appendChild(document.createElement("br"));
    param.colors[currentCount] = "red";
    param.colorprobs[currentCount] = 1;
    input1.addEventListener("change", updateInput.bind(null, input1));
    input2.addEventListener("change", updateInput.bind(null, input1));
}
// repeated IO (shared)
function draw() {
    if (ctx == undefined)
        return;
    const render = global.render;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    drawGrid(ctx, global.written, global.render);
    ctx.globalAlpha = 0.7;
    drawGrid(ctx, global.active, render);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "blue";
    for (const pos of selected)
        ctx.fillRect(pos.x * (render.width + render.gap), pos.y * (render.height + render.gap), render.width + render.gap, render.height + render.gap);
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
}
draw();
//IO
function save() {
    const filename = `${global.mapname.replaceAll(/[^\w]/gi, "-")}.map.json`;
    const file = new File([JSON.stringify(global)], filename, { type: "text/JSON" });
    const download = document.createElement("a");
    download.href = URL.createObjectURL(file);
    download.download = filename;
    download.click();
}
// IO from button
function refresh() {
    // @ts-ignore
    const fields = document.querySelectorAll("#controls input");
    for (const i of fields) {
        updateInput(i);
    }
    refreshActive();
    commitActive();
}
function normaliseColours(area) {
    const globs = splitGraph(genGlobs(area));
    for (const glob of globs) {
        const pos = glob.nodes[Math.floor(Math.random() * glob.nodes.length)];
        if (pos == undefined)
            continue;
        const sqr = area[fromPos(pos)];
        if (sqr == undefined)
            continue;
        const fg = sqr.foreground;
        for (const t of glob.nodes) {
            const sqr = area[fromPos(t)];
            if (sqr == undefined)
                continue;
            sqr.foreground = fg;
        }
    }
}
// IO
function applyCustColor(col, prob, area) {
    const globs = splitGraph(genGlobs(area));
    for (const glob of globs) {
        if (Math.random() * 10000 < prob) {
            const pos = glob.nodes[0];
            if (pos == undefined)
                continue;
            setColor(pos, area, col);
        }
    }
}
// Random
function randomHue(s, l) {
    return toColor(`hsl(${Math.floor(Math.random() * 360)},${s},${l})`)
        ?? { red: 255, green: 0, blue: 0, alpha: 255 };
}
// IO
function updateInput(elem) {
    const val = (elem.type == "number" ? parseInt : id)(elem.value);
    const target = elem.name.split(".");
    let current = { a: global.active, r: global.render, g: param, gl: global };
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
function commitActive() {
    const a = global.active;
    for (const i in a)
        global.written[i] = a[i];
    global.active = {};
}
//IO
function drawGrid(ctx, a, r) {
    if (ctx == null)
        return;
    const prevFill = ctx.fillStyle;
    const fullSq = { down: true, right: true };
    for (const key in a) {
        const sqr = a[key];
        const pos = toPos(key);
        if (pos == null)
            continue;
        const xPos = pos.x * (r.width + r.gap);
        const yPos = pos.y * (r.height + r.gap);
        for (const cx of [true, false])
            for (const cy of [true, false]) {
                let fill = (cx || sqr.right) && (cy || sqr.down);
                const rightSq = a[fromPos({ x: pos.x + 1, y: pos.y })];
                const downSq = a[fromPos({ x: pos.x, y: pos.y + 1 })];
                if (!cx && !cy)
                    fill &&= (rightSq ?? fullSq).down
                        && (downSq ?? fullSq).right;
                ctx.fillStyle = fromColor(fill ? sqr.foreground : sqr.background);
                ctx.fillRect(xPos + (cx ? 0 : r.width), yPos + (cy ? 0 : r.height), cx ? r.width : r.gap, cy ? r.height : r.gap);
            }
    }
    ctx.fillStyle = prevFill;
}
//IO
function refreshActive() {
    const fg = toColor(param.foreground);
    const bg = toColor(param.background);
    if (fg == null)
        alert("Invalid building colour");
    if (bg == null)
        alert("Invalid street colour");
    if (fg == null || bg == null)
        return;
    const grid = {};
    if (Object.keys(global.active).length == 0)
        for (const i of selected) {
            grid[fromPos({ x: i.x, y: i.y })] =
                { down: wFlip(param.prob / 100),
                    right: wFlip(param.prob / 100),
                    foreground: fg,
                    background: bg
                };
            selected = [];
        }
    else
        for (const i in global.active)
            grid[i] =
                { down: wFlip(param.prob / 100),
                    right: wFlip(param.prob / 100),
                    foreground: fg,
                    background: bg
                };
    for (const i in grid) {
        const pos = toPos(i);
        if (pos == null)
            continue;
        if (grid[fromPos({ x: pos.x + 1, y: pos.y })] == undefined)
            grid[i].right = false;
        if (grid[fromPos({ x: pos.x, y: pos.y + 1 })] == undefined)
            grid[i].down = false;
    }
    global.active = grid;
    shrinkGlobs(param.globsz, global.active);
    for (let i = 0; i < param.minsz; i++) {
        const groups = genPathGroups(global.active);
        trimSuburbs(param.minsz, global.active, groups);
    }
    for (let i = 0; i < param.colors.length; i++) {
        const col = toColor(param.colors[i] ?? "");
        if (col == undefined)
            continue;
        if (param.colorprobs[i] == undefined)
            continue;
        applyCustColor(col, param.colorprobs[i], global.active);
    }
}
// IO
function trimSuburbs(num, area, pathGroups) {
    let removing = pathGroups.filter(el => el.length < num);
    while (removing.length > 0) {
        const next = removing.pop();
        if (next == undefined)
            continue;
        for (const p of next)
            remPath(p, area, pathGroups);
    }
}
// IO
function shrinkGlobs(size, area) {
    let globs = splitGraph(genGlobs(area));
    while (globs.length > 0) {
        globs = globs.filter(g => g.nodes.length > size).flatMap(glob => {
            const bridges = getBridges(glob);
            const bp = Math.floor(Math.random() * bridges.length);
            if (bridges[bp] == undefined || bridges.length == 0)
                return [];
            return splitGlob(findEdge(bridges[bp], glob)[0], area, glob);
        });
    }
}
function findEdge(edge, graph) {
    return graph.edges.flatMap((e, i) => e[0] == edge[0] && e[1] == edge[1] ? [i] : []);
}
// IO
function splitGlob(n, area, glob) {
    const rem = edgeToPath(glob.edges[n ?? 0], glob);
    const t = area[fromPos((rem ?? { pos: { x: 0, y: 0 }, down: true }).pos)];
    if (n == undefined || t == undefined || rem == null)
        return [];
    if (rem.down)
        t.down = false;
    else
        t.right = false;
    return splitGraph({ nodes: glob.nodes,
        edges: [...glob.edges.slice(0, n), ...glob.edges.slice(n + 1)]
    });
}
// IO/State
function remPath(p, area, pathGroups) {
    const t = area[fromPos(p.pos)];
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
    const t = area[fromPos(p.pos)];
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
function toColor(s) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx == null)
        return null;
    ctx.globalAlpha = 1;
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    const red = data[0];
    const green = data[1];
    const blue = data[2];
    const alpha = data[3];
    if (red == undefined || green == undefined || blue == undefined || alpha == undefined)
        return null;
    return {
        red: red,
        green: green,
        blue: blue,
        alpha: alpha
    };
}
function fromColor(c) {
    return `rgba(${c.red},${c.green},${c.blue},${c.alpha / 255})`;
}
function pathEq(p, c) {
    return posEq(p.pos, c.pos) && c.down == p.down;
}
/* Fails if there are identical nodes or if the
 * node values changed between the graphs
 */
function transferEdges(edges, out, g, eq) {
    return edges.flatMap(edge => {
        const nth = [0, 1].map(end => {
            const nodePtr = edge[end];
            const node = g.nodes[nodePtr ?? -1];
            if (nodePtr == undefined || node == undefined)
                return [];
            else
                return out.nodes.flatMap((el, i) => eq(el, node) ? [i] : []);
        });
        return pairs(nth[0], nth[1]);
    });
}
function pairs(a, b) {
    // @ts-ignore
    return a.map(a1 => b.map(b1 => [a1, b1]));
}
// broken graph -> graph
function renormaliseGraph(graph) {
    return resolveGraphProjection(projectGraph(graph), graph);
}
function edgeToPath(edge, graph) {
    // @ts-ignore
    const pos = edge.map(e => graph.nodes[e]);
    const x = pos[1].x - pos[0].x;
    const y = pos[1].y - pos[0].y;
    if (x + y < 0)
        pos.reverse();
    if (Math.abs(x) == 1 && Math.abs(y) == 0)
        return { pos: pos[0], down: false };
    else if (Math.abs(y) == 1 && Math.abs(x) == 0)
        return { pos: pos[0], down: true };
    else
        return null;
}
function projectGraph(graph) {
    return graph.nodes.flatMap((elem, i) => elem == undefined ? [] : [i]);
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
function getBridges(graph) {
    return getBridgePointers(graph).map(n => graph.edges[n]);
}
// assumes connected graph, otherwise will give all edges
function getBridgePointers(graph) {
    return graph.edges.map((e, i) => i).filter(i => {
        return !graphConnected({ nodes: graph.nodes,
            edges: [...graph.edges.slice(0, i), ...graph.edges.slice(i + 1)]
        });
    });
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
        Array.prototype.push.apply(removed, newsub);
        out.push(newsub);
    }
    return out.map(e => resolveGraphProjection(e, graph));
}
function graphConnected(graph) {
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
    for (const key in area) {
        const pos = toPos(key);
        if (pos == null)
            continue;
        for (let i = 0; i < graph.nodes.length; i++) {
            const node = graph.nodes[i];
            const sqr = area[fromPos(node)];
            if (sqr == undefined)
                continue;
            if (buildAdj([node, sqr], [pos, area[key]]))
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
    return toList(area).flatMap((sqr) => {
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
