/*
This file is part of h-mapgen.

h-mapgen is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

h-mapgen is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with
h-mapgen. If not, see <https://www.gnu.org/licenses/>.
*/

"use strict";

interface Pos {
    x: number;
    y: number;
}

interface Color {
    red: number;
    green: number;
    blue: number;
    alpha: number;
}

type Equivalence<A> = (a: A, b: A) => boolean;

interface Area {
    [key: string]: GridTile;
}

interface Path {
    pos: Pos;
    down: boolean;
}

interface AreaParameters {
    prob: number;
    minsz: number;
    globsz: number;
    foreground: string;
    background: string;
    colors: string[];
    colorprobs: number[];
}

interface GridTile {
    down: boolean;
    right: boolean;
    foreground: Color;
    background: Color;
}

type Edge = [number, number];

interface Graph<A> {
    nodes: A[];
    edges: Edge[];
}

type renderer = null | CanvasRenderingContext2D;

interface ClickPos {
    pos: Pos;
    shiftMod: boolean;
    ctrlMod: boolean;
}

interface RenderAttr {
    offset: Pos;
    width: number;
    height: number;
    gap: number;
}

interface Annotation {
    pos: Pos;
    contents: string;
}

interface Global {
    written: { [key: string]: Area };
    notes: Annotation[];
    active: Area;
    render: RenderAttr;
    mapname: string;
    chunkSize: number;
}

// shared state
const global: Global = {
    written: {},
    active: {},
    render: { offset: { x: 0, y: 0 }, width: 20, height: 20, gap: 5 },
    mapname: "New Map",
    chunkSize: 16,
    notes: [],
};
const param: AreaParameters = {
    prob: 20,
    minsz: 5,
    globsz: 5,
    foreground: "brown",
    background: "grey",
    colors: [],
    colorprobs: [],
};
// @ts-ignore
const canvas: HTMLCanvasElement = document.getElementById("main");
const ctx = canvas.getContext("2d");
let selected: Pos[] = [];
let clickPos: null | ClickPos = null;

// IO (shared)
function main(): void {
    initInputs();
    generate();
    addButtonEventByID("generate-button", "click", generate);
    addButtonEventByID("add-cust-color", "click", addCustColor);
    addButtonEventByID("save-button", "click", save);
    addButtonEventByID("load-button", "click", load);
    addButtonEventByID("export-button", "click", exportMap);
    // @ts-ignore
    const updatable: HTMLInputElement[] =
        document.querySelectorAll("#controls input");
    for (const i of updatable)
        i.addEventListener("change", updateInput.bind(null, i));
    canvas.addEventListener("mousedown", startClick);
    canvas.addEventListener("mouseup", endClick);
    canvas.addEventListener("mousemove", moveClick);
    canvas.addEventListener("contextmenu", preventEvent);
}
main();

// IO
function initInputs(): void {
    const container = document.getElementById("inputs");
    if (container == null) return;
    const inputs = [
        makeNewInput("gl.mapname", "name", "New Map", "text"),
        makeNewInput("g.foreground", "building color", "#4D2D23", "text", true),
        makeNewInput("g.background", "street color", "#656872", "text", true),
        makeNewInput("r.gap", "street width", "1", "number"),
        makeNewInput("r.width", "block width", "20", "number"),
        makeNewInput("r.height", "block height", "20", "number"),
        makeNewInput("g.prob", "globbing (%)", "40", "number"),
        makeNewInput("g.globst", "maximum glob size", "5", "number"),
        makeNewInput("g.minsz", "minimum suburb size", "4", "number"),
    ];
    inputs.forEach((input: HTMLTableRowElement) => {
        container.appendChild(input);
    });
}

// IO
function addButtonEventByID(id: string, event: string, f: EventListener) {
    // @ts-ignore
    const button: null | HTMLButtonElement = document.getElementById(id);
    if (button != null) {
        button.addEventListener(event, f);
        button.type = "button";
    }
}

function preventEvent(event: Event) {
    event.preventDefault();
    return false;
}

// IO
function startClick(event: MouseEvent) {
    //@ts-ignore
    const target: HTMLElement = event.target;
    const render = global.render;
    const x =
        Math.floor(
            (event.clientX - target.getBoundingClientRect().x) /
                (render.width + render.gap)
        ) - global.render.offset.x;
    const y =
        Math.floor(
            (event.clientY - target.getBoundingClientRect().y) /
                (render.height + render.gap)
        ) - global.render.offset.y;
    if (event.button == 0) {
        if (event.ctrlKey && !event.shiftKey) {
            const col = toColor(param.foreground);
            if (col == null) {
                alert("Invalid color");
                return;
            }
            const chunk: Pos = { x: Math.floor(x / 16), y: Math.floor(y / 16) };
            const clump = pairs([-1, 0, 1], [-1, 0, 1]).map(
                (p: [number, number]) => {
                    return (
                        global.written[
                            fromPos({ x: chunk.x + p[0], y: chunk.y + p[1] })
                        ] ?? {}
                    );
                }
            );
            setColor({ x: x, y: y }, mergeChunks(clump), col);
        }
        clickPos = {
            pos: { x: x, y: y },
            shiftMod: event.shiftKey,
            ctrlMod: event.ctrlKey,
        };
    } else if (event.button == 2) {
        if (event.shiftKey) {
            const toEdit: number[] = [];
            for (let i = 0; i < global.notes.length; i++) {
                const note = global.notes[i];
                if (posEq(note.pos, { x: x, y: y })) {
                    toEdit.push(i);
                }
            }
            if (toEdit.length > 0)
                for (const i of toEdit) {
                    const note = global.notes[i];
                    const edit = prompt("Edit annotation", note.contents);
                    if (edit == null) return;
                    else if (edit == "") global.notes.splice(i, 1);
                    else note.contents = edit;
                }
            else {
                const annotation = prompt("Enter annotation");
                if (annotation == null) return;
                global.notes.push({
                    pos: { x: x, y: y },
                    contents: annotation,
                });
            }
        } else {
            for (const note of global.notes)
                if (posEq(note.pos, { x: x, y: y })) alert(note.contents);
        }
    }
}

// IO
function moveClick(event: MouseEvent) {
    if (clickPos == null) return;
    //@ts-ignore
    const target: HTMLElement = event.target;
    const render = global.render;
    const x =
        Math.floor(
            (event.clientX - target.getBoundingClientRect().x) /
                (render.width + render.gap)
        ) - global.render.offset.x;
    const y =
        Math.floor(
            (event.clientY - target.getBoundingClientRect().y) /
                (render.height + render.gap)
        ) - global.render.offset.y;
    if (clickPos.shiftMod && clickPos.ctrlMod) {
        global.render.offset.x += x - clickPos.pos.x;
        global.render.offset.y += y - clickPos.pos.y;
    }
}

// IO
function endClick(event: MouseEvent) {
    //@ts-ignore
    const target: HTMLElement = event.target;
    const render = global.render;
    const x =
        Math.floor(
            (event.clientX - target.getBoundingClientRect().x) /
                (render.width + render.gap)
        ) - global.render.offset.x;
    const y =
        Math.floor(
            (event.clientY - target.getBoundingClientRect().y) /
                (render.height + render.gap)
        ) - global.render.offset.y;
    if (clickPos == null || clickPos.ctrlMod) {
        clickPos = null;
        return;
    }
    if (!clickPos.shiftMod) selected = [];
    for (
        let i = Math.min(clickPos.pos.x, x);
        i <= Math.max(clickPos.pos.x, x);
        i++
    )
        for (
            let j = Math.min(clickPos.pos.y, y);
            j <= Math.max(clickPos.pos.y, y);
            j++
        ) {
            const reducer = (last: boolean, current: Pos) =>
                last || (current.x == i && current.y == j);
            if (!clickPos.shiftMod || !selected.reduce(reducer, false))
                selected.push({ x: i, y: j });
        }
    clickPos = null;
}

// IO
function setColor(pos: Pos, area: Area, color: Color) {
    const globs = genGlobs(area);
    const match: number[] = [];
    for (let i = 0; i < globs.nodes.length; i++) {
        if (posEq(globs.nodes[i], pos)) match.push(i);
    }
    const change = subgraphWith(match, globs);
    for (const p of change.nodes) {
        const sqr = area[fromPos(p)];
        if (sqr == undefined) continue;
        sqr.foreground = color;
    }
}

function mergeChunks(chunks: Area[]): Area {
    const merger: Area = {};
    for (const chunk of chunks) for (const i in chunk) merger[i] = chunk[i];
    return merger;
}

// IO
function exportMap() {
    const render = global.render;
    const oldOffset = { x: global.render.offset.x, y: global.render.offset.y };
    const canvas = document.createElement("canvas");
    const total = mergeChunks(Object.values(global.written));
    const dims = getDimensions(total);
    global.render.offset = { x: -dims[0].x, y: -dims[0].y };
    canvas.width =
        (1 + Math.abs(dims[1].x - dims[0].x)) * (render.width + render.gap);
    canvas.height =
        (1 + Math.abs(dims[1].y - dims[0].y)) * (render.height + render.gap);
    draw(canvas, false);
    const image = canvas
        .toDataURL("image/png")
        .replace("image/png", "image/octet-stream");
    window.open(image, "_blank");
    global.render.offset = oldOffset;
}

function makeNewInput(
    inputName: string,
    labelText: string,
    defaultVal: string = "1",
    inputType: string = "number",
    isColor: boolean = false
): HTMLTableRowElement {
    const row = document.createElement("tr");

    const label = document.createElement("label");
    label.htmlFor = inputName;
    label.innerHTML = labelText;

    const label_td = document.createElement("td");
    label_td.appendChild(label);

    const input = document.createElement("input");
    input.name = inputName;
    input.value = defaultVal;
    input.type = inputType;
    input.addEventListener("change", updateInput.bind(null, input));
    if (isColor) input.classList.add("color-input");
    
    updateInput(input)

    const input_td = document.createElement("td");
    input_td.appendChild(input);

    row.appendChild(label_td);
    row.appendChild(input_td);

    return row;
}

// IO
function addCustColor() {
    // const container = document.getElementById("cust-colors")
    const container = document.getElementById("inputs");
    if (container == null) return;
    const currentCount =
        document.getElementsByClassName("cust-color-val").length;

    const input1 = makeNewInput(
        `g.colors.${currentCount}`,
        `colour ${currentCount}`,
        "#434D23",
        "text",
        true
    );
    // Keep track of how many custom colours we have
    input1.classList.add("cust-color-val");
    const input2 = makeNewInput(
        `g.colorprobs.${currentCount}`,
        "probability (&pertenk;)",
        "25"
    );

    container.appendChild(input1);
    container.appendChild(input2);
}

// repeated IO (shared)
function draw(canvas: HTMLCanvasElement, cont: boolean): void {
    const ctx = canvas.getContext("2d");
    if (ctx == undefined) return;
    const render = global.render;
    if (canvas.offsetWidth != 0) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(
        render.offset.x * (render.width + render.gap),
        render.offset.y * (render.height + render.gap)
    );
    if (cont) {
        const startChunk: Pos = {
            x: Math.floor(-render.offset.x / 16),
            y: Math.floor(-render.offset.y / 16),
        };
        const endChunk: Pos = {
            x:
                2 +
                startChunk.x +
                Math.ceil(
                    canvas.width /
                        (global.chunkSize * render.width * render.gap)
                ),
            y:
                2 +
                startChunk.y +
                Math.ceil(
                    canvas.height /
                        (global.chunkSize * render.height * render.gap)
                ),
        };
        for (let cx = startChunk.x; cx <= endChunk.x; cx++)
            for (let cy = startChunk.y; cy <= endChunk.y; cy++) {
                const cPos: Pos = { x: cx, y: cy };
                drawGrid(ctx, global.written[fromPos(cPos)] ?? {}, render);
            }
    } else {
        for (const chunk in global.written)
            drawGrid(ctx, global.written[chunk] ?? {}, render);
    }
    ctx.globalAlpha = 0.7;
    drawGrid(ctx, global.active, render);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "blue";
    for (const pos of selected)
        ctx.fillRect(
            pos.x * (render.width + render.gap),
            pos.y * (render.height + render.gap),
            render.width + render.gap,
            render.height + render.gap
        );
    ctx.globalAlpha = 1;
    ctx.translate(
        -render.offset.x * (render.width + render.gap),
        -render.offset.y * (render.height + render.gap)
    );
    for (let i = 0; i < global.notes.length; i++) {
        const note = global.notes[i];
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(
            (note.pos.x + render.offset.x) * (render.width + render.gap) +
                render.width / 2,
            (note.pos.y + render.offset.y) * (render.height + render.gap) +
                render.height / 2,
            3 * Math.max(2, 1 + Math.floor(Math.log10(i + 0.5))),
            0,
            2 * Math.PI
        );
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "black";
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.fillText(
            <string>(<unknown>i),
            (note.pos.x + render.offset.x) * (render.width + render.gap) +
                render.width / 2,
            (note.pos.y + render.offset.y) * (render.height + render.gap) +
                render.height / 2
        );
    }
    if (cont) requestAnimationFrame(draw.bind(null, canvas, true));
}
draw(canvas, true);

// IO
function save() {
    const filename = `${global.mapname.replaceAll(/[^\w]/g, "-")}.map.json`;
    const file = new File([JSON.stringify(global)], filename, {
        type: "text/JSON",
    });
    const download = document.createElement("a");
    download.href = URL.createObjectURL(file);
    download.download = filename;
    download.click();
}

function getDimensions(area: Area): [Pos, Pos] {
    let min: null | Pos = null;
    let max: null | Pos = null;
    for (const i in area) {
        const pos = toPos(i);
        if (pos == null) continue;
        if (min == null) min = { x: pos.x, y: pos.y };
        if (max == null) max = { x: pos.x, y: pos.y };
        min.x = Math.min(min.x, pos.x);
        max.x = Math.max(max.x, pos.x);
        min.y = Math.min(min.y, pos.y);
        max.y = Math.max(max.y, pos.y);
    }
    if (min == null || max == null)
        return [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
        ];
    return [min, max];
}

// IO from button
function generate() {
    // @ts-ignore
    const fields: HTMLInputElement[] =
        document.querySelectorAll("#controls input");
    for (const i of fields) {
        updateInput(i);
    }
    generateActive();
    commitActive();
}

// IO
function normaliseColours(area: Area) {
    const globs: Graph<Pos>[] = splitGraph(genGlobs(area));
    for (const glob of globs) {
        const pos = glob.nodes[Math.floor(Math.random() * glob.nodes.length)];
        if (pos == undefined) continue;
        const sqr = area[fromPos(pos)];
        if (sqr == undefined) continue;
        const fg = sqr.foreground;
        for (const t of glob.nodes) {
            const sqr = area[fromPos(t)];
            if (sqr == undefined) continue;
            sqr.foreground = fg;
        }
    }
}

// IO
function applyCustColor(col: Color, prob: number, area: Area) {
    const globs = splitGraph(genGlobs(area));
    for (const glob of globs) {
        if (Math.random() * 10000 < prob) {
            const pos = glob.nodes[0];
            if (pos == undefined) continue;
            setColor(pos, area, col);
        }
    }
}

// IO
function load() {
    const loader = document.createElement("input");
    loader.type = "file";
    loader.addEventListener("change", () => {
        if (loader.files == null) return;
        const file = loader.files[0];
        if (file == undefined) return;
        const fr = new FileReader();
        fr.onload = () => {
            if (fr.result == undefined || fr.result instanceof ArrayBuffer)
                return;
            const newGlobal = JSON.parse(fr.result);
            // @ts-ignore
            for (const i in newGlobal) global[i] = newGlobal[i];
            // @ts-ignore
            const mapname: HTMLInputElement =
                document.getElementsByName("gl.mapname")[0];
            mapname.value = global.mapname;
        };
        fr.readAsText(file);
    });
    loader.click();
}

// Random
function randomHue(s: number, l: number): Color {
    return (
        toColor(`hsl(${Math.floor(Math.random() * 360)},${s},${l})`) ?? {
            red: 255,
            green: 0,
            blue: 0,
            alpha: 255,
        }
    );
}

// IO
function updateInput(elem: HTMLInputElement) {
    const val = (elem.type == "number" ? parseInt : id)(elem.value);
    const target: Array<string> = elem.name.split(".");
    let current = { a: global.active, r: global.render, g: param, gl: global };
    while (target.length > 1) {
        const move = target.shift();
        if (move == undefined) return;
        // @ts-ignore
        current = current[move];
    }
    // @ts-ignore
    current[target[0]] = val;
    // If this has errors then I want the default js behaviour anyways
    if (elem.classList.contains("color-input"))
        // @ts-ignore
        elem.style.backgroundColor = val;
}

// IO
function commitActive() {
    const a = global.active;
    for (const i in a) {
        const pos = toPos(i);
        if (pos == null) continue;
        const chunk: Pos = {
            x: Math.floor(pos.x / global.chunkSize),
            y: Math.floor(pos.y / global.chunkSize),
        };
        if (global.written[fromPos(chunk)] == undefined)
            global.written[fromPos(chunk)] = {};
        global.written[fromPos(chunk)][i] = a[i];
    }
    global.active = {};
}

// IO
function drawGrid(ctx: renderer, a: Area, r: RenderAttr) {
    const render = global.render;
    if (ctx == null) return;
    const prevFill = ctx.fillStyle;
    const fullSq = { down: true, right: true };
    for (const key in a) {
        const sqr = a[key];
        const pos = toPos(key);
        if (pos == null) continue;
        const xPos = pos.x * (r.width + r.gap);
        const yPos = pos.y * (r.height + r.gap);
        for (const cx of [true, false])
            for (const cy of [true, false]) {
                let fill = (cx || sqr.right) && (cy || sqr.down);
                const rightSq = a[fromPos({ x: pos.x + 1, y: pos.y })];
                const downSq = a[fromPos({ x: pos.x, y: pos.y + 1 })];
                if (!cx && !cy)
                    fill &&=
                        (rightSq ?? fullSq).down && (downSq ?? fullSq).right;
                ctx.fillStyle = fromColor(
                    fill ? sqr.foreground : sqr.background
                );
                ctx.fillRect(
                    xPos + (cx ? 0 : r.width),
                    yPos + (cy ? 0 : r.height),
                    cx ? r.width : r.gap,
                    cy ? r.height : r.gap
                );
            }
    }
    ctx.fillStyle = prevFill;
}

// IO
function generateActive(): void {
    const fg = toColor(param.foreground);
    const bg = toColor(param.background);
    if (fg == null) alert("Invalid building colour");
    if (bg == null) alert("Invalid street colour");
    if (fg == null || bg == null) return;
    const grid: { [key: string]: GridTile } = {};
    if (Object.keys(global.active).length == 0)
        for (const i of selected) {
            grid[fromPos({ x: i.x, y: i.y })] = {
                down: wFlip(param.prob / 100),
                right: wFlip(param.prob / 100),
                foreground: fg,
                background: bg,
            };
            selected = [];
        }
    else
        for (const i in global.active)
            grid[i] = {
                down: wFlip(param.prob / 100),
                right: wFlip(param.prob / 100),
                foreground: fg,
                background: bg,
            };
    for (const i in grid) {
        const pos = toPos(i);
        if (pos == null) continue;
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
        if (col == undefined) continue;
        if (param.colorprobs[i] == undefined) continue;
        applyCustColor(col, param.colorprobs[i], global.active);
    }
}

// IO
function trimSuburbs(num: number, area: Area, pathGroups: Path[][]): void {
    let removing = pathGroups.filter((el) => el.length < num);
    while (removing.length > 0) {
        const next = removing.pop();
        if (next == undefined) continue;
        for (const p of next) remPath(p, area, pathGroups);
    }
}

// IO
function shrinkGlobs(size: number, area: Area): void {
    let globs: Graph<Pos>[] = splitGraph(genGlobs(area));
    while (globs.length > 0) {
        globs = globs
            .filter((g) => g.nodes.length > size)
            .flatMap((glob) => {
                const bridges = getBridges(glob);
                const bp = Math.floor(Math.random() * bridges.length);
                if (bridges[bp] == undefined || bridges.length == 0) return [];
                return splitGlob(findEdge(bridges[bp], glob)[0], area, glob);
            });
    }
}

function findEdge<A>(edge: Edge, graph: Graph<A>): number[] {
    return graph.edges.flatMap((e: Edge, i: number) =>
        e[0] == edge[0] && e[1] == edge[1] ? [i] : []
    );
}

// IO
function splitGlob(
    n: null | number,
    area: Area,
    glob: Graph<Pos>
): Graph<Pos>[] {
    const rem = edgeToPath(glob.edges[n ?? 0], glob);
    const t = area[fromPos((rem ?? { pos: { x: 0, y: 0 }, down: true }).pos)];
    if (n == undefined || t == undefined || rem == null) return [];
    if (rem.down) t.down = false;
    else t.right = false;
    return splitGraph({
        nodes: glob.nodes,
        edges: [...glob.edges.slice(0, n), ...glob.edges.slice(n + 1)],
    });
}

// IO/State
function remPath(p: Path, area: Area, pathGroups: Path[][]): void {
    const t = area[fromPos(p.pos)];
    if (t == undefined) return;
    if (p.down) t.down = true;
    else t.right = true;
    for (let g = 0; g < pathGroups.length; g++) {
        for (let i = 0; i < pathGroups[g].length; i++)
            if (p == pathGroups[g][i]) pathGroups[g].splice(i, 1);
        if (pathGroups[g].length == 0) {
            pathGroups.splice(g, 1);
            g--;
        }
    }
}

// IO
function insPath(p: Path, area: Area, pathGroups: Path[][]): void {
    const t = area[fromPos(p.pos)];
    if (t == undefined) return;
    if (p.down) t.down = false;
    else t.right = false;
    updatePathGroups(p, pathGroups);
}

function findPathInGroups(p: Path, pathGroups: Path[][]): Path[][] {
    const reducer = (last: boolean, c: Path) => last || pathEq(p, c);
    return pathGroups.filter((el) => el.reduce(reducer, false));
}

function toColor(s: string): null | Color {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (ctx == null) return null;
    ctx.globalAlpha = 1;
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    const red = data[0];
    const green = data[1];
    const blue = data[2];
    const alpha = data[3];
    if (
        red == undefined ||
        green == undefined ||
        blue == undefined ||
        alpha == undefined
    )
        return null;
    return {
        red: red,
        green: green,
        blue: blue,
        alpha: alpha,
    };
}

function fromColor(c: Color): string {
    return `rgba(${c.red},${c.green},${c.blue},${c.alpha / 255})`;
}

function pathEq(p: Path, c: Path): boolean {
    return posEq(p.pos, c.pos) && c.down == p.down;
}

/* Fails if there are identical nodes or if the
 * node values changed between the graphs
 */
function transferEdges<A>(
    edges: Edge[],
    out: Graph<A>,
    g: Graph<A>,
    eq: Equivalence<A>
): Edge[] {
    return edges.flatMap((edge) => {
        const nth = [0, 1].map((end) => {
            const nodePtr = edge[end];
            const node = g.nodes[nodePtr ?? -1];
            if (nodePtr == undefined || node == undefined) return [];
            else return out.nodes.flatMap((el, i) => (eq(el, node) ? [i] : []));
        });
        return pairs(nth[0], nth[1]);
    });
}

function pairs<A, B>(a: A[], b: B[]): [A, B][] {
    // @ts-ignore
    return a.flatMap((a1) => b.map((b1) => [a1, b1]));
}

// broken graph -> graph
function renormaliseGraph<A>(graph: Graph<A>): Graph<A> {
    return resolveGraphProjection(projectGraph(graph), graph);
}

function edgeToPath(edge: Edge, graph: Graph<Pos>): null | Path {
    // @ts-ignore
    const pos: [Pos, Pos] = edge.map((e) => graph.nodes[e]);
    const x = pos[1].x - pos[0].x;
    const y = pos[1].y - pos[0].y;
    if (x + y < 0) pos.reverse();
    if (Math.abs(x) == 1 && Math.abs(y) == 0)
        return { pos: pos[0], down: false };
    else if (Math.abs(y) == 1 && Math.abs(x) == 0)
        return { pos: pos[0], down: true };
    else return null;
}

function projectGraph<A>(graph: Graph<A>): number[] {
    return graph.nodes.flatMap((elem: A, i: number) =>
        elem == undefined ? [] : [i]
    );
}

function genPathGroups(area: Area): Path[][] {
    const paths = getAllPaths(area);
    const pathGroups: Path[][] = [];
    while (paths.length > 0) {
        const test = paths.pop();
        if (test == undefined) continue;
        updatePathGroups(test, pathGroups);
    }
    return pathGroups;
}

function getBridges<A>(graph: Graph<A>): Edge[] {
    return getBridgePointers(graph).map((n) => graph.edges[n]);
}

// assumes connected graph, otherwise will give all edges
function getBridgePointers<A>(graph: Graph<A>): number[] {
    return graph.edges
        .map((e, i) => i)
        .filter((i) => {
            return !graphConnected({
                nodes: graph.nodes,
                edges: [
                    ...graph.edges.slice(0, i),
                    ...graph.edges.slice(i + 1),
                ],
            });
        });
}

function splitGraph<A>(graph: Graph<A>): Graph<A>[] {
    const removed: number[] = [];
    const out: number[][] = [];
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
    return out.map((e) => resolveGraphProjection(e, graph));
}

function graphConnected<A>(graph: Graph<A>): boolean {
    return graph.nodes.length == subgraphWith([0], graph).nodes.length;
}

function nodeDegree<A>(
    elem: A,
    graph: Graph<A>,
    eq: (a: A, b: A) => boolean
): number[] {
    return projectNode(elem, graph, eq).map(
        (el) =>
            graph.edges.filter((edge) => edge[0] == el || edge[1] == el).length
    );
}

function subgraphWith<A>(start: number[], g: Graph<A>): Graph<A> {
    return resolveGraphProjection(subgraphProjection(start, g), g);
}

function subgraphProjection<A>(start: number[], g: Graph<A>): number[] {
    const projection = [...start];
    let old = [...projection];
    let next = [...projection];
    while (next.length != 0) {
        old = next;
        next = [];
        for (const e of g.edges) {
            for (const n of old) {
                let val: undefined | number;
                if (n == e[0]) val = e[1];
                else if (n == e[1]) val = e[0];
                if (
                    val != undefined &&
                    ![...projection, ...next].includes(val)
                ) {
                    next.push(val);
                }
            }
        }
        for (const i of next) projection.push(i);
    }
    return projection;
}

function resolveGraphProjection<A>(p: number[], g: Graph<A>): Graph<A> {
    const nodes: [number, A][] = p.flatMap((n) =>
        g.nodes[n] == undefined ? [] : [[n, g.nodes[n]]]
    );
    const mapped = nodes.map((a) => a[0]);
    const en = enumerate(mapped);
    const edges = g.edges.filter(
        (e) => mapped.includes(e[0]) && mapped.includes(e[1])
    );
    return {
        nodes: nodes.map((e) => e[1]),
        // @ts-ignore
        edges: edges
            .flatMap((e) => preimage(en, e[0]).map((l) => [l, e[1]]))
            .flatMap((e) => preimage(en, e[1]).map((r) => [e[0], r])),
    };
}

function projectNode<A>(
    elem: A,
    g: Graph<A>,
    eq: (a: A, b: A) => boolean
): number[] {
    const projection: number[] = [];
    for (let n = 0; n < g.nodes.length; n++)
        if (eq(g.nodes[n], elem)) projection.push(n);
    return projection;
}

function enumerate<A>(arr: A[]): [number, A][] {
    return arr.map((elem, i) => [i, elem]);
}

function preimage<A, B>(f: [A, B][], b: B): A[] {
    return f.flatMap((p) => (p[1] == b ? p[0] : []));
}

function genGlobs(area: Area): Graph<Pos> {
    const graph: Graph<Pos> = { nodes: [], edges: [] };
    for (const key in area) {
        const pos = toPos(key);
        if (pos == null) continue;
        for (let i = 0; i < graph.nodes.length; i++) {
            const node = graph.nodes[i];
            const sqr = area[fromPos(node)];
            if (sqr == undefined) continue;
            if (buildAdj([node, sqr], [pos, area[key]]))
                graph.edges.push([i, graph.nodes.length]);
        }
        graph.nodes.push(pos);
    }
    return graph;
}

function inGlob(pos: Pos, glob: Graph<Pos>): boolean {
    const reducer = (last: boolean, next: Pos) => last || posEq(next, pos);
    return glob.nodes.reduce(reducer, false);
}

function buildAdj(a: [Pos, GridTile], b: [Pos, GridTile]): boolean {
    const x = b[0].x - a[0].x;
    const y = b[0].y - a[0].y;
    const f = x + y > 0 ? a[1] : b[1];
    return (
        (Math.abs(x) == 1 && f.right && y == 0) ||
        (Math.abs(y) == 1 && f.down && x == 0)
    );
}

function posEq(a: Pos, b: Pos) {
    return a.x == b.x && a.y == b.y;
}

// Mutating
function updatePathGroups(path: Path, pathGroups: Path[][]): void {
    const included: number[] = [];
    for (let g = 0; g < pathGroups.length; g++)
        for (const p of pathGroups[g])
            if (pathAdj(path, p)) {
                included.push(g);
                break;
            }
    while (included.length > 1) {
        const rem = included.pop();
        if (rem == undefined) continue;
        for (let i = 0; i < included.length; i++)
            if (included[i] > rem) included[i]--;
        const moving = pathGroups.splice(rem, 1)[0];
        for (const p of moving) pathGroups[included[0]].push(p);
    }
    if (included.length == 1) {
        pathGroups[included[0]].push(path);
    } else {
        pathGroups.push([path]);
    }
}

function pathAdj(a: Path, b: Path) {
    const xDiff = b.pos.x - a.pos.x;
    const yDiff = b.pos.y - a.pos.y;
    const tang = a.down ? xDiff : yDiff;
    const norm = a.down ? yDiff : xDiff;
    if (b.down == a.down) return Math.abs(tang) <= 1 && norm == 0;
    else return -1 <= tang && tang <= 0 && 0 <= norm && norm <= 1;
}

function getAllPaths(area: Area): Path[] {
    return toList(area).flatMap((sqr: [string, GridTile]) => {
        const pos = toPos(sqr[0]);
        if (pos == null) return [];
        const glob = sqr[1];
        const out: Path[] = [];
        if (!glob.down) out.push({ pos: pos, down: true });
        if (!glob.right) out.push({ pos: pos, down: false });
        return out;
    });
}

// loses typing
function toList(o: object): [any, any][] {
    // @ts-ignore
    return Object.keys(o).map((key) => [key, o[key]]);
}

function fromPos(pos: Pos): string {
    return `${pos.x},${pos.y}`;
}

function toPos(pos: string): Pos | null {
    const split = pos.split(",");
    if (split.length !== 2) return null;
    return { x: parseInt(split[0]), y: parseInt(split[1]) };
}

// random
function wFlip(odds: number): boolean {
    return Math.random() < odds;
}

function id<A>(x: A): A {
    return x;
}
