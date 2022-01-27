"use strict"

interface Pos
  { x: number
  , y: number
  }

type Color = string

type Equivalence<A> = (a:A, b:A) => boolean

interface Area { [key: string]: GridTile }

interface Path
  { pos: Pos
  , down: boolean
  }

interface AreaParameters
  { prob: number
  , minsz: number
  , globsz: number
  }

interface GridTile
  { down: boolean
  , right: boolean
  , foreground: Color
  , background: Color
  }

type Edge = [number,number]

interface Graph<A>
  { nodes: A[]
  , edges: Edge[]
  }

type renderer = null | CanvasRenderingContext2D

interface ClickPos
  { pos: Pos
  , shiftMod: boolean
  }

interface RenderAttr
  { offset: Pos
  , width: number
  , height: number
  , gap: number
  }

interface Global
  { written: Area[]
  , active: 
    { grid: Area
    , foreground: Color
    , background: Color
    }
  , render: RenderAttr
  , mapname: string
  }

// shared state
const global: Global =
  { written: []
  , active:
    { foreground: "green"
    , background: "grey"
    , grid: { }
    }
  , render:
    { offset: {x: 0, y: 0}
    , width: 20
    , height: 20
    , gap: 5
    }
  , mapname: "New Map"
  }
const param: AreaParameters =
  { prob: 20
  , minsz: 5
  , globsz: 5
  }
const written: Array<Area> = []
let globalSize = 40
// @ts-ignore
const canvas: HTMLCanvasElement = document.getElementById("main")
const ctx = canvas.getContext('2d')
let selected: Pos[] = []
let clickPos: null | ClickPos = null

// IO (shared)
function main(): void {
  refresh()
  // @ts-ignore
  const refreshButton: null | HTMLButtonElement = document.getElementById("refresh-button")
  if(refreshButton != null) {
    refreshButton.addEventListener("click", refresh)
    refreshButton.type = "button"
  }
  // @ts-ignore
  const saveButton: null | HTMLButtonElement = document.getElementById("save-button")
  if(saveButton != null) {
    saveButton.addEventListener("click", save)
    saveButton.type = "button"
  }
  // @ts-ignore
  const updatable: HTMLInputElement[] = document.querySelectorAll("#controls > input")
  for(const i of updatable)
    i.addEventListener("change", updateInput.bind(null, i))
  // @ts-ignore
  const commitButton: null | HTMLButtonElement = document.getElementById("commit-active")
  if(commitButton!= null) {
    commitButton.addEventListener("click", commitActive)
    commitButton.type = "button"
  }
  canvas.addEventListener("mousedown", startClick)
  canvas.addEventListener("mouseup", endClick)
}
main();

// IO
function startClick(event: MouseEvent) {
  //@ts-ignore
  const target: HTMLElement = event.target
  const render = global.render
  const x = Math.floor(
        (event.clientX - target.getBoundingClientRect().x) / (render.width + render.gap))
  const y = Math.floor(
        (event.clientY - target.getBoundingClientRect().y) / (render.height + render.gap))
  clickPos =
    { pos: 
      { x: x
      , y: y
      }
    , shiftMod: event.shiftKey
    }
}

/// IO
function endClick(event: MouseEvent) {
  //@ts-ignore
  const target: HTMLElement = event.target
  const render = global.render
  const x = Math.floor(
        (event.clientX - target.getBoundingClientRect().x) / (render.width + render.gap))
  const y = Math.floor(
        (event.clientY - target.getBoundingClientRect().y) / (render.height + render.gap))
  if(clickPos == null)
    return
  if(!clickPos.shiftMod)
    selected = []
  for(let i = Math.min(clickPos.pos.x, x); i <= Math.max(clickPos.pos.x, x); i++)
    for(let j = Math.min(clickPos.pos.y, y); j <= Math.max(clickPos.pos.y, y); j++) {
      const reducer = (last: boolean, current: Pos) => last || (current.x == i) && (current.y == j)
      if(!clickPos.shiftMod || !selected.reduce(reducer, false))
        selected.push({ x: i, y: j })
    }
}

// repeated IO (shared)
function draw(): void {
  if(ctx == undefined)
    return
  const render = global.render
  canvas.width = canvas.offsetWidth
  canvas.height = canvas.offsetHeight
  for (const a of global.written) {
    drawGrid(ctx, a, global.render)
  }
  ctx.globalAlpha = 0.7
  drawGrid(ctx, global.active.grid, render)
  ctx.globalAlpha = 0.3
  ctx.fillStyle = "blue"
  for(const pos of selected)
    ctx.fillRect(
        pos.x * (render.width + render.gap)
      , pos.y * (render.height + render.gap)
      , render.width + render.gap
      , render.height + render.gap)
  requestAnimationFrame(draw)
}
draw()

//IO
function save() {
  const filename = `${global.mapname.replaceAll(/[^\w]/gi, "-")}.map.json`
  const file = new File([JSON.stringify(global)], filename, { type: "text/JSON" })
  const download = document.createElement("a");
  download.href = URL.createObjectURL(file)
  download.download = filename
  download.click()
}

// IO from button
function refresh() {
  // @ts-ignore
  const fields: HTMLInputElement[] = document.querySelectorAll("#controls > input")
  for(const i of fields) {
    updateInput(i);
  }
  refreshActive()
}

// IO
function updateInput(elem: HTMLInputElement) {
  const val = (elem.type == "number" ? parseInt : id)(elem.value)
  const target: Array<string> = elem.name.split(".")
  let current = { a: global.active, r: global.render, g: param, gl: global }
  while(target.length > 1) {
    const move = target.shift()
    if (move == undefined)
      return;
    // @ts-ignore
    current = current[move]
  }
  // @ts-ignore
  current[target[0]] = val;
}

//IO
function commitActive() {
  const a = global.active
  global.written.push(a.grid)
  global.active.grid = { }
}

//IO
function drawGrid(ctx: renderer, a: Area, r: RenderAttr) {
  if (ctx == null) return;
  const prevFill = ctx.fillStyle
  const fullSq = { down: true, right: true }
  for(const key in a) {
    const sqr = a[key]
    const pos = toPos(key)
    if (pos == null) continue;
    const xPos = pos.x * (r.width + r.gap)
    const yPos = pos.y * (r.height + r.gap)
    for (const cx of [true, false])
      for (const cy of [true, false]) {
         let fill = (cx || sqr.right) && (cy || sqr.down)
         const rightSq = a[fromPos({x: pos.x + 1, y: pos.y})]
         const downSq = a[fromPos({x: pos.x, y: pos.y + 1})]
         if (!cx && !cy)
           fill &&= (rightSq ?? fullSq).down
                &&  (downSq ?? fullSq).right
         ctx.fillStyle = fill ? sqr.foreground : sqr.background
         ctx.fillRect
           ( xPos + (cx ? 0 : r.width)
           , yPos + (cy ? 0 : r.height)
           , cx ? r.width : r.gap
           , cy ? r.height : r.gap
           )
      } 
  }
  ctx.fillStyle = prevFill
}

//IO
function refreshActive(): void {
  const grid: { [key: string]: GridTile } = { }
  if(Object.keys(global.active.grid).length == 0)
    for(const i of selected) {
      grid[fromPos({ x: i.x, y: i.y })] = 
        { down: wFlip(param.prob / 100)
        , right: wFlip(param.prob / 100) 
        , foreground: global.active.foreground
        , background: global.active.background
        }
      selected = []
    }
  else
    for(const i in global.active.grid)
      grid[i] =
        { down: wFlip(param.prob / 100)
        , right: wFlip(param.prob / 100)
        , foreground: global.active.foreground
        , background: global.active.background
        }
  for(const i in grid) {
    const pos = toPos(i)
    if(pos == null)
      continue
    if(grid[fromPos({x: pos.x + 1, y: pos.y})] == undefined)
      grid[i].right = false
    if(grid[fromPos({x: pos.x, y: pos.y + 1})] == undefined)
      grid[i].down = false
  }  
  global.active.grid = grid
  shrinkGlobs(param.globsz, global.active.grid)
  for(let i = 0;  i < param.minsz; i++) {
    const groups = genPathGroups(global.active.grid)
    trimSuburbs(param.minsz, global.active.grid, groups)
  }
}

// IO
function trimSuburbs(num: number, area: Area, pathGroups: Path[][]): void {
  let removing = pathGroups.filter(el => el.length < num)
  while(removing.length > 0) {
    const next = removing.pop()
    if (next == undefined)
      continue;
    for(const p of next)
      remPath(p, area, pathGroups)
  }
}

// IO
function shrinkGlobs(size: number, area: Area): void {
  let globs: Graph<Pos>[] = splitGraph(genGlobs(area))
  while(globs.length > 0) {
    globs = globs.filter(g => g.nodes.length > size).flatMap(glob => {
      const bridges = getBridges(glob)
      const bp = Math.floor(Math.random() * bridges.length)
      if(bridges[bp] == undefined || bridges.length == 0)
        return []
      return splitGlob(findEdge(bridges[bp], glob)[0], area, glob)
    })
  }
}

function findEdge<A>(edge: Edge, graph: Graph<A>): number[] {
  return graph.edges.flatMap((e: Edge, i: number) => 
    e[0] == edge[0] && e[1] == edge[1] ? [i] : [])
}

// IO
function splitGlob(n: null | number, area: Area, glob: Graph<Pos>): Graph<Pos>[] {
  const rem = edgeToPath(glob.edges[n ?? 0], glob)
  const t = area[fromPos((rem ?? { pos: {x:0,y:0},down: true }).pos)]
  if (n == undefined || t == undefined || rem == null)
    return []
  if(rem.down)
    t.down = false
  else
    t.right = false
  return splitGraph(
    { nodes: glob.nodes
    , edges: [...glob.edges.slice(0, n), ...glob.edges.slice(n+1)]
    })
}

// IO/State
function remPath(p: Path, area: Area, pathGroups: Path[][]): void {
  const t = area[fromPos(p.pos)]
  if(t == undefined)
    return
  if(p.down)
    t.down = true
  else
    t.right = true
  for(let g = 0; g < pathGroups.length; g++) {
    for(let i = 0; i < pathGroups[g].length; i++)
      if(p == pathGroups[g][i])
        pathGroups[g].splice(i,1)
    if(pathGroups[g].length == 0) {
      pathGroups.splice(g,1)
      g--
    }
  }
}

// IO
function insPath(p: Path, area: Area, pathGroups: Path[][]): void {
  const t = area[fromPos(p.pos)]
  if(t == undefined)
    return
  if(p.down)
    t.down = false
  else
    t.right = false
  updatePathGroups(p, pathGroups)
}

function findPathInGroups(p: Path, pathGroups: Path[][]): Path[][] {
  const reducer = (last: boolean, c: Path) => last || pathEq(p, c)
  return pathGroups.filter(el => 
    el.reduce(reducer, false)
  )
}

function pathEq(p: Path, c: Path): boolean {
  return posEq(p.pos, c.pos) && c.down == p.down
}

/* Fails if there are identical nodes or if the
 * node values changed between the graphs
 */
function transferEdges<A>(edges: Edge[], out: Graph<A>, g: Graph<A>, eq: Equivalence<A>): Edge[] {
  return edges.flatMap(edge => {
    const nth = [0,1].map(end => {
      const nodePtr = edge[end]
      const node = g.nodes[nodePtr ?? -1]
      if (nodePtr == undefined || node == undefined)
        return []
      else
        return out.nodes.flatMap((el, i) => eq(el, node) ? [i] : [])
    })
    return pairs(nth[0], nth[1])
  })
}

function pairs<A,B>(a: A[], b: B[]): [A,B][] {
  // @ts-ignore
  return a.map(a1 => b.map(b1 => [a1, b1]))
}

// broken graph -> graph
function renormaliseGraph<A>(graph: Graph<A>): Graph<A> {
  return resolveGraphProjection(projectGraph(graph), graph)
}

function edgeToPath(edge: Edge, graph: Graph<Pos>): null | Path {
  // @ts-ignore
  const pos: [Pos, Pos] = edge.map(e => graph.nodes[e])
  const x = pos[1].x - pos[0].x
  const y = pos[1].y - pos[0].y
  if(x+y < 0)
    pos.reverse()
  if(Math.abs(x) == 1 && Math.abs(y) == 0)
    return { pos: pos[0], down: false }
  else if(Math.abs(y) == 1 && Math.abs(x) == 0)
    return { pos: pos[0], down: true }
  else
    return null
}

function projectGraph<A>(graph: Graph<A>): number[] {
  return graph.nodes.flatMap((elem: A, i: number) => 
    elem == undefined ? [] : [i])
}

function genPathGroups(area: Area): Path[][] {
  const paths = getAllPaths(area)
  const pathGroups: Path[][] = []
  while(paths.length > 0) {
    const test = paths.pop();
    if (test == undefined)
      continue;
    updatePathGroups(test, pathGroups);
  }
  return pathGroups
}

function getBridges<A>(graph: Graph<A>): Edge[] {
  return getBridgePointers(graph).map(n => graph.edges[n])
}

// assumes connected graph, otherwise will give all edges
function getBridgePointers<A>(graph: Graph<A>): number[] {
  return graph.edges.map((e, i) => i).filter(i => {
    return !graphConnected(
      { nodes: graph.nodes
      , edges: [...graph.edges.slice(0, i), ...graph.edges.slice(i+1)]
      })
  })
}

function splitGraph<A>(graph: Graph<A>): Graph<A>[] {
  const removed: number[] = []
  const out: number[][] = []
  while(removed.length < graph.nodes.length) {
    let i = 0;
    while(removed.includes(i)) {
      if(i > graph.nodes.length) {
        return [] 
      }
      i++
    }
    const newsub = subgraphProjection([i], graph)
    Array.prototype.push.apply(removed, newsub)
    out.push(newsub)
  }
  return out.map(e => resolveGraphProjection(e, graph))
}

function graphConnected<A>(graph: Graph<A>): boolean {
  return graph.nodes.length == subgraphWith([0], graph).nodes.length
}

function nodeDegree<A>(elem: A, graph: Graph<A>, eq: (a:A,b:A) => boolean): number[] {
  return projectNode(elem, graph, eq).map(el =>
    graph.edges.filter(edge => edge[0] == el || edge[1] == el).length
  )
}

function subgraphWith<A>(start: number[], g: Graph<A>): Graph<A> {
  return resolveGraphProjection(subgraphProjection(start, g), g)
}

function subgraphProjection<A>( start: number[], g: Graph<A>): number[] {
  const projection = [...start]
  let old = [...projection]
  let next = [...projection]
  while(next.length != 0) {
    old = next
    next = []
   for(const e of g.edges) {
      for(const n of old) {
        let val: undefined | number; 
        if(n == e[0]) 
          val = e[1]
        else if (n == e[1])
          val = e[0]
        if(val != undefined && ![...projection,...next].includes(val)) {
          next.push(val)
        }
      } 
    }
    for(const i of next)
      projection.push(i)
  }
  return projection
}

function resolveGraphProjection<A>(p: number[], g: Graph<A>): Graph<A> {
  const nodes: [number, A][] = p.flatMap(n => g.nodes[n] == undefined ? [] : [[n,g.nodes[n]]])
  const mapped = nodes.map(a => a[0])
  const en = enumerate(mapped)
  const edges = g.edges.filter(e => mapped.includes(e[0]) && mapped.includes(e[1]))
  return { nodes: nodes.map(e => e[1])
         // @ts-ignore
         , edges: edges
             .flatMap(e => preimage(en, e[0]).map(l => [l, e[1]]))
             .flatMap(e => preimage(en, e[1]).map(r => [e[0], r]))
         }
}

function projectNode<A>(elem: A, g: Graph<A>, eq: (a:A,b:A) => boolean): number[] {
  const projection: number[] = []
  for(let n = 0; n < g.nodes.length; n++)
    if(eq(g.nodes[n], elem))
      projection.push(n)
  return projection
}

function enumerate<A>(arr: A[]): [number, A][] {
  return arr.map((elem, i) => [i, elem]);
}

function preimage<A,B>(f: [A,B][], b: B): A[] {
  return f.flatMap(p => p[1] == b ? p[0] : [])
}

function genGlobs(area: Area): Graph<Pos> {
  const graph: Graph<Pos> = { nodes: [], edges: [] }
  for(const key in area) {
    const pos = toPos(key)
    if(pos == null)
      continue
    for(let i = 0; i < graph.nodes.length; i++) {
      const node = graph.nodes[i]
      const sqr = area[fromPos(node)]
      if (sqr == undefined)
        continue;
      if(buildAdj([node, sqr], [pos, area[key]]))
        graph.edges.push([i, graph.nodes.length])
    }
    graph.nodes.push(pos)
  }
  return graph
}

function inGlob(pos: Pos, glob: Graph<Pos>): boolean {
  const reducer = (last: boolean, next: Pos) => last || posEq(next, pos)
  return glob.nodes.reduce(reducer, false)
}

function buildAdj(a: [Pos, GridTile], b: [Pos, GridTile]): boolean {
  const x = b[0].x - a[0].x
  const y = b[0].y - a[0].y
  const f = x + y > 0 ? a[1] : b[1]
  return (Math.abs(x) == 1 && f.right && y == 0) || (Math.abs(y) == 1 && f.down && x == 0)
}

function posEq(a: Pos, b: Pos) {
  return a.x == b.x && a.y == b.y
}

// Mutating
function updatePathGroups(path: Path, pathGroups: Path[][]): void {
  const included: number[] = []
  for(let g = 0; g < pathGroups.length; g++)
    for(const p of pathGroups[g])
      if(pathAdj(path, p)) {
        included.push(g)
        break;
      }
  while(included.length > 1) {
    const rem = included.pop()
    if(rem == undefined)
      continue;
    for(let i = 0; i < included.length; i++)
      if(included[i] > rem)
        included[i]--;
    const moving = pathGroups.splice(rem, 1)[0]
    for(const p of moving)
      pathGroups[included[0]].push(p) 
  }
  if(included.length == 1) {
    pathGroups[included[0]].push(path)
  } else {
    pathGroups.push([path])
  }
}

function pathAdj(a: Path, b: Path) {
  const xDiff = b.pos.x - a.pos.x
  const yDiff = b.pos.y - a.pos.y
  const tang = a.down ? xDiff : yDiff
  const norm =  a.down ? yDiff : xDiff
  if(b.down == a.down)
    return (Math.abs(tang) <= 1) && (norm == 0)
  else
    return (-1 <= tang && tang <= 0) && (0 <= norm && norm <= 1)
}

function getAllPaths(area: Area): Path[] {
  return toList(area).flatMap((sqr: [string, GridTile]) => {
    const pos = toPos(sqr[0])
    if (pos == null)
      return []
    const glob = sqr[1]
    const out: Path[] = []
    if(!glob.down)
      out.push({ pos: pos, down: true })
    if(!glob.right)
      out.push({ pos: pos, down: false })
    return out
  });
}

// loses typing
function toList(o: object): [any,any][] {
  // @ts-ignore
  return Object.keys(o).map(key => [key, o[key]])
}

function fromPos(pos: Pos): string {
  return `${pos.x},${pos.y}`
}

function toPos (pos: string): Pos | null {
  const split = pos.split(',')
  if (split.length !== 2) return null;
  return { x: parseInt(split[0]), y: parseInt(split[1]) };
}

// random
function wFlip(odds: number): boolean {
  return Math.random() < odds
}

function id<A>(x: A): A {
  return x
}
