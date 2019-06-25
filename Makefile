SUBDIRS = dist build src
.PHONY: subdirs $(SUBDIRS)
subdirs: $(SUBDIRS)

build:
	rm -rf dist
	npx tsc
	mkdir dist/bin
	cp bin/exo dist/bin
	cp bin/exoskeleton dist/bin
	cp CHANGELOG.md dist
	cp README.md dist

rc: build
	TS_NODE_PROJECT=tsconfig.build.json npx ts-node ./scripts/publish.rc.ts

publish: build
	TS_NODE_PROJECT=tsconfig.build.json npx ts-node ./scripts/publish.ts
