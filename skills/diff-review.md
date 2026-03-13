Analyze the git diff and display the result in SimpleMD.

Steps:
1. Run `git diff $ARGUMENTS` (default: unstaged changes. Examples: HEAD~1, HEAD~3, main..feature)
2. If the diff is empty, try `git diff --cached` (staged changes)
3. If still empty, say "No changes to analyze"
4. Analyze the diff thoroughly and write a markdown review with this structure:

```
# Diff Review

## Summary
1-2 sentence overview of what changed and why.

## Files Changed
| File | +/- | Description |
|------|-----|-------------|
| path/to/file.ext | +12 / -3 | Brief description |

## Key Changes

### 1. 변경 그룹 제목 (관련 티켓이 있으면 표시)

**변경 목적**: 왜 이 변경이 필요한지 설명

**주요 코드 변경**:

`path/to/file.ext`
\```java
// Before
public void oldMethod(String param) {
    doSomething(param);
}

// After
public void newMethod(String param, int option) {
    validate(param);
    doSomethingBetter(param, option);
}
\```

- `oldMethod` → `newMethod`로 변경, `option` 파라미터 추가
- `validate()` 호출 추가로 입력값 검증 강화

`path/to/another-file.ext`
\```xml
<!-- 추가된 코드 -->
<select id="newQuery" parameterType="map" resultType="int">
    SELECT COUNT(*) FROM table WHERE condition = #{value}
</select>
\```

- 신규 쿼리 `newQuery` 추가 — 조건별 카운트 조회

### 2. 다음 변경 그룹...

(위와 동일한 패턴으로 반복)

## Potential Issues
- Flag risks, missing tests, inconsistencies
- "No issues detected." if clean

## Suggestions
- Optional improvements or follow-up items
```

5. Write the markdown to a temp file: `/tmp/simplemd-review-{timestamp}.md`
6. Open it in SimpleMD: `open -a SimpleMD /tmp/simplemd-review-{timestamp}.md`

Rules:
- Use Korean for all descriptions
- MUST include actual code snippets (before/after) for every significant change
- Show the file path above each code block so the reader knows where to look
- Use the appropriate language tag for code blocks (java, xml, sql, js, jsp, css, etc.)
- Explain WHAT changed AND WHY in bullet points after each code block
- Group related changes together under numbered headings
- For new files, show the key parts of the code (not the entire file)
- For deleted code, show what was removed and explain the impact
- If the diff is very large (>500 lines), prioritize showing code for the most important changes and summarize trivial ones (config, formatting) in a table
- DO NOT just list bullet point summaries without code — the whole point is to see the actual code changes
- DO NOT use mermaid diagrams — they break easily with special characters in code identifiers. Use plain text or tables instead for flow descriptions
