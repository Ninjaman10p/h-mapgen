outfile=h-mapgen.html
JS=script
HTML=index.html

$(outfile): js/$(JS).js $(HTML)
	csplit -f html-aux $(HTML) '/<\/script>/'
	sed 's/<script */<script>/' html-aux00 > html-aux00.tmp
	mv html-aux00.tmp html-aux00
	cat html-aux00 js/script.js html-aux01 > $(outfile)
	rm html-aux00 html-aux01

js/$(JS).js: ts/$(JS).ts
	npx tsc

tags: ts/$(JS).ts $(HTML)
	ctags ts/$(JS).ts $(HTML)

.PHONY: clean
clean:
	rm -f html-aux*
	rm -f js/$(JS).js
	rm -f $(outfile)
	rm -f tags
