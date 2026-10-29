import type React from 'react';

// textarea 자동 리스트 (노트 앱처럼)
// - 리스트 줄에서 Enter → 다음 줄에 같은 기호 자동 입력 (번호는 +1, 체크박스는 빈 칸으로)
// - 기호만 있는 빈 줄에서 Enter → 기호를 지우고 리스트 종료
// - 줄 맨 앞에서 "-"/"*" + Space → "• ", "[]" + Space → "☐ " 로 변환
// 값은 execCommand('insertText')로 바꿔서 onChange가 그대로 발화하고 Ctrl+Z 되돌리기도 유지됨

export const BULLET = '• ';
const LIST_PREFIX = /^(\s*)(• |☐ |☑ |(\d+)\. )/;

// 선택 영역을 text로 교체 (execCommand 실패 시 네이티브 setter + input 이벤트로 폴백)
const replaceRange = (el: HTMLTextAreaElement, start: number, end: number, text: string) => {
  el.setSelectionRange(start, end);
  const ok = text ? document.execCommand('insertText', false, text) : document.execCommand('delete');
  if (ok) return;
  const next = el.value.slice(0, start) + text + el.value.slice(end);
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(el, next);
  el.setSelectionRange(start + text.length, start + text.length);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

export const handleListKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  // 한글 조합 중 Enter/Space는 조합 확정용 — 여기서 처리하면 글자가 중복 입력됨
  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
  if (e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return;

  const el = e.currentTarget;
  const { selectionStart: pos, selectionEnd, value } = el;
  if (pos !== selectionEnd) return;

  const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
  const beforeCaret = value.slice(lineStart, pos);

  if (e.key === ' ') {
    const m = beforeCaret.match(/^(\s*)([-*]|\[\])$/);
    if (!m) return;
    e.preventDefault();
    replaceRange(el, lineStart + m[1].length, pos, m[2] === '[]' ? '☐ ' : BULLET);
    return;
  }

  if (e.key !== 'Enter') return;
  const m = beforeCaret.match(LIST_PREFIX);
  if (!m) return;
  e.preventDefault();

  const [prefix, indent, marker, num] = m;
  const lineEnd = value.indexOf('\n', pos);
  const lineText = value.slice(lineStart, lineEnd === -1 ? value.length : lineEnd);

  // 내용 없이 기호만 있는 줄 → 기호 제거하고 리스트 끝내기
  if (lineText.trim() === marker.trim()) {
    replaceRange(el, lineStart, lineStart + prefix.length, '');
    return;
  }

  const nextMarker = num ? `${Number(num) + 1}. ` : marker === '☑ ' ? '☐ ' : marker;
  replaceRange(el, pos, pos, `\n${indent}${nextMarker}`);
};

// 빈 메모에 포커스하면 첫 줄을 글머리 기호로 시작
export const startListOnFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
  const el = e.currentTarget;
  if (el.value === '') replaceRange(el, 0, 0, BULLET);
};

// 기호만 남은 메모는 비어 있는 것으로 취급 (저장·표시용)
export const isBlankList = (value: string) => value.replace(/^\s*(• |☐ |☑ |\d+\. )?/gm, '').trim() === '';
