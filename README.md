# SimpleMD

Typora 스타일의 크로스 플랫폼 WYSIWYG 마크다운 에디터.

CodeMirror 6 + Electron 기반으로, 마크다운을 입력하면 실시간으로 렌더링되는 편집 환경을 제공합니다.

## Features

- **WYSIWYG 편집** — 마크다운 문법이 입력 즉시 렌더링
- **멀티 탭** — 여러 문서를 탭으로 동시에 열기 (`Ctrl+T`, `Ctrl+W`, `Ctrl+Tab`)
- **닫은 탭 복원** — `Ctrl+Shift+T`로 최근 닫은 탭 다시 열기
- **탭 드래그 정렬** — 드래그로 탭 순서 변경
- **탭 우클릭 메뉴** — Close, Close Others, Close Tabs to Right
- **사이드바 폴더 트리** — 연결선이 있는 계층 구조 폴더 탐색
- **사이드바 리사이즈** — 드래그로 폭 조절, 더블클릭으로 리셋
- **Mermaid 다이어그램** — flowchart, sequence, gantt 등 실시간 렌더링 + 풀스크린 보기
- **LaTeX 수식** — KaTeX 기반 인라인/블록 수식
- **코드 블록** — 구문 강조 + Copy 버튼
- **다크 모드** — 시스템 설정 자동 감지 + 수동 전환
- **최근 파일** — `Cmd+R`로 최근 열었던 파일 빠르게 열기
- **외부 변경 감지** — 다른 프로그램에서 파일 수정 시 자동 리로드
- **Diff/Patch 뷰어** — `.diff`, `.patch` 파일 자동 감지 + 뷰어 모드
- **Export** — HTML, PDF 내보내기
- **CLI 지원** — `simplemd file.md` 로 터미널에서 바로 열기

## Screenshots

| 편집 모드 | 뷰어 모드 |
|-----------|-----------|
| 마크다운 입력 즉시 렌더링 | 읽기 전용 깔끔한 뷰 |

## 설치

### macOS / Windows / Linux — 빌드된 앱 사용

[Releases](https://github.com/HDPark95/simpleMd/releases) 페이지에서 플랫폼에 맞는 설치 파일을 다운로드하세요.

### 소스에서 빌드

```bash
git clone https://github.com/HDPark95/simpleMd.git
cd simpleMd
npm install
npm run build
npm run package:mac    # macOS
npm run package:win    # Windows
npm run package:linux  # Linux
```

## 개발

```bash
npm run dev   # Electron + Vite 개발 서버 (핫 리로드)
```

## CLI 사용법

```bash
# 파일 열기
simplemd README.md

# 뷰어 모드로 열기
simplemd --md-mode view README.md

# 특정 라인으로 이동
simplemd --md-line 42 README.md

# stdin 파이프
git diff | simplemd --md-mode view
```

## 단축키

| 단축키 | 동작 |
|--------|------|
| `Cmd+T` | 새 탭 |
| `Cmd+W` | 현재 탭 닫기 |
| `Cmd+Tab` | 다음 탭 |
| `Cmd+Shift+Tab` | 이전 탭 |
| `Cmd+Shift+T` | 닫은 탭 다시 열기 |
| `Cmd+E` | 편집/뷰어 모드 전환 |
| `Cmd+R` | 최근 파일 목록 |
| `Cmd+\` | 사이드바 토글 |
| `Cmd+B` | Bold |
| `Cmd+I` | Italic |
| `Cmd+S` | 저장 |
| `Cmd+P` | PDF 내보내기 |

> Windows/Linux에서는 `Cmd` 대신 `Ctrl`을 사용합니다.

## 기술 스택

- **Electron** — 크로스 플랫폼 데스크톱 앱
- **CodeMirror 6** — 에디터 코어 (WYSIWYG 확장)
- **Vite** — 빌드 도구 (electron-vite)
- **TypeScript** — 전체 코드베이스
- **Mermaid** — 다이어그램 렌더링
- **KaTeX** — 수식 렌더링
- **highlight.js** — 코드 구문 강조

## 프로젝트 구조

```
simpleMd/
├── electron/          # Electron main + preload
│   ├── main.ts        # 메인 프로세스 (IPC, 파일 I/O, 메뉴)
│   ├── preload.ts     # contextBridge API
│   └── menu.ts        # 애플리케이션 메뉴
├── src/               # 렌더러 (프론트엔드)
│   ├── main.ts        # 앱 초기화 + 상태 관리
│   ├── components/    # UI 컴포넌트
│   │   ├── tabbar.ts  # 멀티 탭 관리
│   │   ├── sidebar.ts # 폴더 트리
│   │   ├── toolbar.ts # 포맷 툴바
│   │   ├── outline.ts # 아웃라인 패널
│   │   └── statusbar.ts
│   ├── editor/        # CodeMirror 확장
│   ├── features/      # 기능 플러그인
│   │   ├── codeblock.ts  # 코드 블록 위젯
│   │   ├── diagram.ts    # Mermaid 다이어그램
│   │   ├── math.ts       # KaTeX 수식
│   │   ├── table.ts      # 테이블
│   │   └── ...
│   ├── styles/        # CSS
│   └── themes/        # 테마 정의
├── bin/simplemd.js    # CLI 엔트리
└── resources/         # 아이콘 등 리소스
```

## License

MIT
