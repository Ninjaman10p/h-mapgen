"use strict"

interface Position
  { x: number
  , y: number
  }

type Color = string

interface Area
  { pos: Position
  , width: number
  , height: number
  , gap: number
  , rot: number
  , foreground: Color
  , background: Color
  , grid: { [key: string]: GridTile }
  , gen: AreaParameters
  }

interface PathPos
  { pos: Position
  , down: boolean
  }

interface AreaParameters
  { prob: number
  }

interface GridTile
  { down: boolean
  , right: boolean
  }

type renderer = null | CanvasRenderingContext2D

// shared state
const written: Array<Area> = []
const active: Area =
  { pos: { x: 0, y: 0 }
  , width: 20
  , height: 20
  , gap: 5
  , rot: 0
  , foreground: "green"
  , background: "grey"
  , grid: { }
  , gen:
    { prob: 20
    }
  }

// @ts-ignore
const canvas: HTMLCanvasElement = document.getElementById("main")
const ctx = canvas.getContext('2d')

// IO (shared)
function main(): void {
  refresh()
}
main();

// repeated IO (shared)
function draw(): void {
  for (const a of written)
    drawGrid(ctx, a)
  canvas.width = canvas.offsetWidth
  canvas.height = canvas.offsetHeight
  drawGrid(ctx, active)
  requestAnimationFrame(draw)
}
draw()

// IO from button
function refresh() {
  // @ts-ignore
  const fields: Array<HTMLInputElement> = document.querySelectorAll("#controls > input")
  for(const i of fields) {
    updateInput(i);
  }
  refreshActive()
}
{ 
  // @ts-ignore
  const button: null | HTMLButtonElement = document.getElementById("refresh-button")
  if(button != null) {
    button.addEventListener("click", refresh)
    button.type = "button"
  }
}

// IO
function updateInput(elem: HTMLInputElement) {
  const val = (elem.type == "number" ? parseInt : id)(elem.value)
  const target: Array<string> = elem.name.split(".")
  let current = { a: active }
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
function drawGrid(ctx: renderer, a: Area) {
  if (ctx == null) return;
  const prevFill = ctx.fillStyle
  ctx.translate(a.pos.x, a.pos.y)
  ctx.rotate(a.rot)
  const fullSq = { down: true, right: true }
  for(const key in a.grid) {
    const sqr = a.grid[key]
    const pos = toPos(key)
    if (pos == null) continue;
    const xPos = pos.x * (a.width + a.gap)
    const yPos = pos.y * (a.height + a.gap)
    for (const cx of [true, false])
      for (const cy of [true, false]) {
         let fill = (cx || sqr.right) && (cy || sqr.down)
         const rightSq = a.grid[fromPos({x: pos.x + 1, y: pos.y})]
         const downSq = a.grid[fromPos({x: pos.x, y: pos.y + 1})]
         if (!cx && !cy)
           fill &&= (rightSq ?? fullSq).down
                &&  (downSq ?? fullSq).right
         ctx.fillStyle = fill ? a.foreground : a.background
         if ((cy || downSq != undefined) && (cx || rightSq != undefined))
           ctx.fillRect
             ( xPos + (cx ? 0 : a.width)
             , yPos + (cy ? 0 : a.height)
             , cx ? a.width : a.gap
             , cy ? a.height : a.gap
             )
      } 
  }
  ctx.rotate(-a.rot)
  ctx.translate(-a.pos.x, -a.pos.y)
  ctx.fillStyle = prevFill
}

//IO
function refreshActive(): void {
  const grid: { [key: string]: GridTile } = { }
  for (let x = 0; x < 40; x++)
    for (let y = 0; y < 40; y++) {
      console.log(active.gen.prob)
      grid[fromPos({ x: x, y: y })] = 
        { down: wFlip(active.gen.prob / 100)
        , right: wFlip(active.gen.prob / 100) 
        }
    }

  active.grid = grid
}

function genPathGroups(area: Area): Array<Array<PathPos>> {
  const paths = getAllPaths(area)
}

function getAllPaths(area: Area): Array<PathPos> {
  return toList(area.grid)
    .flatMap((sqr: [string, GridTile]) => {
      const pos = toPos(sqr[0])
      if (pos == null)
        return []
      const glob = sqr[1]
      const out: Array<PathPos> = []
      if(!glob.down)
        out.push({ pos: pos, down: true })
      if(!glob.right)
        out.push({ pos: pos, down: false })
      return out
    });
}

// loses typing
function toList(o: object): Array<[any, any]> {
  // @ts-ignore
  return Object.keys(o).map(key => [key, o[key]])
}

function fromPos(pos: Position): string {
  return `${pos.x},${pos.y}`
}

function toPos (pos: string): Position | null {
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
