ROOT   := /Users/user/Desktop/workspace/Dailo
FRONT  := $(ROOT)/frontend/Dailo
STATIC := $(ROOT)/backend/Dailo/src/main/resources/static

.PHONY: deploy commit ship clean

# 프론트 빌드 + static 복사
deploy:
	rm -rf $(STATIC)/static $(STATIC)/index.html $(STATIC)/asset-manifest.json
	cd $(FRONT) && npm run build
	cp -r $(FRONT)/build/* $(STATIC)/

# git 커밋 (make commit m="메시지") — 메시지는 환경변수로 넘김: $(m)을 명령줄에 펼치면 여러 줄·따옴표 메시지에서 셸이 깨짐
# $(value m) + := 로 make가 메시지 속 $를 변수로 읽지 않게 (그냥 export m이면 $HOME → OME)
export COMMIT_MSG := $(value m)
commit:
	@test -n "$$COMMIT_MSG" || { echo 'm="커밋 메시지"를 넣어주세요'; exit 1; }
	git -C $(ROOT) add -A
	printf '%s\n' "$$COMMIT_MSG" | git -C $(ROOT) commit -F -

# 배포 + 커밋 한 번에 (make ship m="메시지")
ship: deploy commit

# static 만 정리
clean:
	rm -rf $(STATIC)/static $(STATIC)/index.html $(STATIC)/asset-manifest.json