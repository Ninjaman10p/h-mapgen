#!/bin/sh
script=`cat js/script.js`
awk -vf2="$script" '/eof-js/{print f2;print;next}1' index.html \
  | sed 's/ src="js\/script.js"//g' \
  > h-mapgen.html
