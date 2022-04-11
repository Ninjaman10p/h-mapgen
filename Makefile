outfile=h-mapgen.html

$(outfile): build.sh js/script.js
	npx tsc
	./build.sh
