# LIFE

Lake's Interface For Everything — 일기, 프로젝트, 계획, 목표, 자산을 **하나의 Object + Relationship 구조**로 관리합니다.

## 실행

```bash
npm install
cp .env.example .env   # Alpha Vantage API 키 입력
npm run dev
```

GitHub Pages 배포 시 **Repository secret**으로 `ALPHA_VANTAGE_API_KEY`를 넣으세요.

Settings → Secrets and variables → Actions → **Repository secrets**  
(Environments 아래가 아닙니다.)

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
