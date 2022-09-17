# h-mapgen
Original Author: Peter Gow

Licence: GPLv3 or later

Developer Contact: petergow@live.com.au

## Usage
To use, open index.html in the distributed folder. The webpage should have a dark blue
canvas and a list of settings

### Canvas Controls
* lmb (drag): select an area
* shift+lmb (drag): add to your previous selection
* ctrl+shift+lmb (drag): move the visual area
* ctrl+lmb: Change the colour of a building to the currently set "building color" setting
* rmb: View the contents of a note
* shift+rmb: Add or edit a note

### Settings
* name: The name of the map
* building color: The main building color of newly generated sections
* street color: The color of streets in newly generated sections
* street width: The width of streets in all sections (even previously generated ones)
* block width/height: the size of squares in all sections
* globbing (%): How often buildings will be connected. 100% results in a single building for the entire area
    * Warning: Higher globbing values combined with large areas may freeze the program
* maximum glob size: The maximum size of buildings
    * The program will attempt to split up buildings larger than this size
    * Due to a technical limitation, this may fail to break up buildings that are shaped with wider sections
    * If this occurs, you can regenerate that building by selecting it and hitting "Generate"
* minimum suburb size: If there are streets with less area than this, the program will remove them
    * Warning: Higher values may slow down the program

### Custom colours
The "Add Color" button adds a pair of fields "colour N" and "probability (‱)".
The first of these fiels allows you to specify a colour that will be randomly applied to buildings
with the probability specified in the probability field (A probability of 100 = 1%, 
so for 100% change set probability to 10000)

### Buttons
* "Add color" generates a color, as explained above
* "Generate" generates a map section in the currently selected area on the canvas, potentially overriding previously generated sections
* "Save" saves the current layout as a .json file, which can be loaded with "Load"
    * Warning: load will override the currently open map
* "Export (PNG)" will export the current map as a PNG file

## Building
The program will run fine by opening "index.html"; however, if you want to store it as a standalone html file, you can do this by following the instructions below
to embed the JavaScript file

### Linux/MacOS
If you are on a system with GNU Make installed, run the following command while in the project directory:
```bash
$ make h-mapgen.html
```

### Windows/Other
If you don't have access to a POSIX compliant shell,
copy `index.html` to a file called `h-mapgen.html`,
and then copy the contents of `js/script.js` between the `<script></script>` tags
