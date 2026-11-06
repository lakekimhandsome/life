# LIFE

Lake's Interface For Everything — 일기, 프로젝트, 계획, 목표, 자산을 **하나의 Object + Relationship 구조**로 관리합니다.

## 실행

```bash
npm install
cp .env.example .env   # Supabase URL과 공개 키 입력
npm run dev
```

GitHub Pages 배포에는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` repository secrets가 필요합니다.
시세 API 키는 클라이언트에 포함하지 않고 Supabase Vault의 `life_alpha_vantage_api_key`에 저장합니다.
웹과 macOS는 `get_life_market_quote` RPC로 서버가 검증한 공용 시세를 받습니다.

## MVP 범위

- 홈 (삶의 영역 허브)
- 일기 / 프로젝트 / 계획 / 목표 / 자산 모듈
- 객체 상세 및 목표 연결
- Local First (IndexedDB via Dexie)

규칙을 보려면 `PROJECTRULES.md`를 참고하세요.

## 자정 자산 기록

`daily-asset-snapshots`는 매일 한국 시각 00:00에
`private.snapshot_daily_assets()`를 실행합니다. 모든 사용자의 자산에 필요한
주식·금속·환율을 중복 없이 Alpha Vantage에서 다시 조회한 다음 기록합니다.
요청은 12초 간격이며, 조회 실패 시 전체 실행을 롤백하고 이전 시세로 기록하지 않습니다.
기존 날짜의 기록은 덮어쓰지 않습니다.

서버용 API 키는 Supabase Vault의 `life_alpha_vantage_api_key` secret에 별도로
설정해야 합니다. 키 값은 마이그레이션에 넣지 않습니다.

회귀 검증은 postgres 권한으로 `supabase/tests/daily_asset_snapshots.sql`을 실행합니다.
HTTP 응답을 트랜잭션 안에서 대체하여 여러 사용자·중복 종목·환율·금 환산·조회 실패·
기존 기록 보존을 확인하고, 모든 테스트 변경을 롤백합니다.

## 웹·MCP 동기화와 저장 충돌

객체·폴더·관계 변경은 사용자별 private Realtime 채널로 전달됩니다.
웹은 편집 중인 초안을 유지하고, 저장 시 `updated_at`이 바뀌었으면 덮어쓰기를 거부합니다.
MCP `update_object`에도 마지막 조회 결과의 `updated_at`을 `expectedUpdatedAt`으로 전달해야 합니다.
`find_objects`의 `nextBefore`는 시간과 ID를 담은 커서이므로 변환 없이 다음 요청의 `before`에 전달합니다.

`supabase/tests/sync_and_data_integrity.sql`은 시세 쓰기 권한·서버 조회·저장 버전·관계 복원을
검증합니다. postgres 권한으로 실행하며 외부 HTTP는 대체하고 모든 변경은 롤백합니다.
이미 삭제되어 보관되지 않은 과거 관계는 이 변경으로 복구되지 않습니다.

MCP `list_deleted_objects`는 휴지통의 기록과 삭제 시각을 페이지별로 반환합니다.
`restore_object({ id })`는 기존 복원 함수를 사용하며, 공유를 해제한 비공개 상태로 복원합니다.
