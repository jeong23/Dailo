ROOT   := /Users/user/Desktop/workspace/Dailo
FRONT  := $(ROOT)/frontend/Dailo
STATIC := $(ROOT)/backend/Dailo/src/main/resources/static

.PHONY: deploy commit ship clean

# 프론트 빌드 + static 복사
deploy:
	rm -rf $(STATIC)/static $(STATIC)/index.html $(STATIC)/asset-manifest.html
	cd $(FRONT) && npm run build
	cp -r $(FRONT)/build/* $(STATIC)/

# git 커밋 (make commit m="메시지")
commit:
	git -C $(ROOT) add -A
	git -C $(ROOT) commit -m "$(m)"

# 배포 + 커밋 한 번에 (make ship m="메시지")
ship: deploy commit

# static 만 정리
clean:
	rm -rf $(STATIC)/static $(STATIC)/index.html $(STATIC)/asset-manifest.json