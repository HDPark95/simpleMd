# SimpleMD - Markdown Editor Specification

> Typora-inspired cross-platform WYSIWYG markdown editor built with Electron

## Typora 기능 분석 & 구현 우선순위

### Phase 1: MVP (2주)

| 기능 | Typora | 구현 | 기술 |
|------|--------|------|------|
| 실시간 WYSIWYG 편집 | O | O | CodeMirror 6 + markdown extension |
| 마크다운 기본 문법 | O | O | CommonMark + GFM |
| 헤딩 (H1-H6) | O | O | CM6 |
| 볼드/이탤릭/취소선 | O | O | CM6 |
| 링크/이미지 | O | O | CM6 |
| 코드 블록 (syntax highlight) | O | O | @codemirror/lang-* |
| 인라인 코드 | O | O | CM6 |
| 인용구 | O | O | CM6 |
| 리스트 (순서/비순서/체크) | O | O | CM6 |
| 수평선 | O | O | CM6 |
| 파일 열기/저장 | O | O | Electron dialog |
| 다크/라이트 테마 | O | O | CSS 변수 |
| 단축키 | O | O | CM6 keymap |
| 파일 트리 사이드바 | O | O | Electron + fs |
| 워드카운트 | O | O | CM6 state |

### Phase 2: 핵심 기능 (2주)

| 기능 | Typora | 구현 | 기술 |
|------|--------|------|------|
| 테이블 편집 (GUI) | O | O | prosemirror-tables or custom |
| 수학 수식 (LaTeX) | O | O | KaTeX |
| Mermaid 다이어그램 | O | O | mermaid.js |
| Flowchart 다이어그램 | O | O | flowchart.js |
| Sequence 다이어그램 | O | O | mermaid.js |
| TOC 자동 생성 | O | O | [TOC] 파싱 |
| 아웃라인 패널 | O | O | 헤딩 트리 |
| 이미지 드래그앤드롭 | O | O | Electron drop API |
| 이미지 리사이즈 | O | O | CSS + handle |
| YAML Front Matter | O | O | gray-matter |
| 각주 | O | O | remark-footnotes |
| 이모지 자동완성 | O | O | emoji data + popup |
| 포커스 모드 | O | O | CSS blur |
| 타이프라이터 모드 | O | O | scroll lock |
| 자동 저장 | O | O | fs.watch + debounce |

### Phase 3: 고급 기능 (2주)

| 기능 | Typora | 구현 | 기술 |
|------|--------|------|------|
| PDF 내보내기 (북마크) | O | O | Electron print + puppeteer |
| HTML 내보내기 | O | O | remark-html |
| DOCX 내보내기 | O | O | pandoc or docx.js |
| LaTeX 내보내기 | O | O | pandoc |
| EPUB 내보내기 | O | O | pandoc |
| 커스텀 CSS 테마 | O | O | theme loader |
| 스마트 구두점 | O | O | SmartyPants |
| 맞춤법 검사 | O | O | Electron spellcheck |
| RTL 지원 | O | O | CSS direction |
| 검색/바꾸기 | O | O | CM6 search |
| 줌 | O | O | Electron zoom |
| 버전 관리/복구 | O | O | file backup |

### Phase 4: 차별화 (Typora에 없는 기능)

| 기능 | 설명 |
|------|------|
| CLAUDE.md 전용 모드 | Claude Code 설정 파일 GUI 편집 |
| AI 문서 도우미 | Claude API 연동 문서 작성 지원 |
| 실시간 협업 | CRDT 기반 공동 편집 |
| 플러그인 시스템 | 사용자 확장 가능 |
| Git 통합 | 내장 git diff / commit |

## 기술 스택

```
Frontend:  CodeMirror 6 + TypeScript
Backend:   Electron 33+
Bundler:   electron-vite (Vite)
Markdown:  unified / remark / rehype
Math:      KaTeX
Diagrams:  mermaid.js
Themes:    CSS Custom Properties
Testing:   Vitest + Playwright
Package:   electron-builder (Mac/Win/Linux)
```

## 프로젝트 구조

```
simplemd/
├── electron/
│   ├── main.ts           # Electron main process
│   ├── preload.ts        # Preload script (IPC bridge)
│   └── menu.ts           # Application menu
├── src/
│   ├── editor/
│   │   ├── index.ts      # CodeMirror 6 setup
│   │   ├── markdown.ts   # Markdown extensions
│   │   ├── theme.ts      # Editor themes
│   │   ├── keymap.ts     # Keyboard shortcuts
│   │   └── wysiwyg.ts    # WYSIWYG rendering
│   ├── components/
│   │   ├── sidebar.ts    # File tree
│   │   ├── outline.ts    # Document outline
│   │   ├── statusbar.ts  # Word count, cursor pos
│   │   └── toolbar.ts    # Formatting toolbar
│   ├── features/
│   │   ├── export.ts     # PDF/HTML/DOCX export
│   │   ├── math.ts       # KaTeX integration
│   │   ├── diagram.ts    # Mermaid integration
│   │   ├── table.ts      # Table editor
│   │   ├── image.ts      # Image handling
│   │   └── toc.ts        # Table of contents
│   ├── themes/
│   │   ├── light.css
│   │   ├── dark.css
│   │   └── github.css
│   ├── styles/
│   │   └── global.css
│   ├── utils/
│   │   ├── file.ts       # File operations
│   │   ├── markdown.ts   # MD parsing utilities
│   │   └── config.ts     # App configuration
│   ├── index.html
│   └── main.ts           # Renderer entry
├── package.json
├── electron-builder.yml
├── tsconfig.json
├── vite.config.ts
└── SPEC.md
```
