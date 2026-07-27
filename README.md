# LIFE

Personal Life OS — 일기, 프로젝트, 운동, 공부, 목표, 자산을 **하나의 Object + Relationship 구조**로 관리합니다.

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
- 일기 / 프로젝트 / 운동 / 공부 / 목표 / 자산 모듈
- 객체 상세 및 목표 연결
- Local First (IndexedDB via Dexie)

규칙을 보려면 `PROJECTRULES.md`를 참고하세요.
