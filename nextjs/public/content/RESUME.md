## [인적 사항]
| | |
| --- | --- |
| **이름** | 장춘림 ZHANG CHUNLIN |
| **직무** | 풀스택 소프트웨어 엔지니어 |
| **경력** | 중국 1년 + 한국 2년 10개월 |
| **생년월일** | 1994년 3월 7일 (만 32세) |
| **국적/민족** | 중국/조선족 |
| **비자** | F-4-14 (비단순노동 취업비자) |
| **가능한 언어** | 한국어, 중국어, 영어 |
| **연락처** | 010-7647-6376 |
| **이메일** | zangcunlim@gmail.com |
| **현 거주지** | 인천 미추홀구 주안동 |
| | |

## [소개]
- 신규제품의 프로토타이핑, 단일제품의 고도화를 위해 요구사항 수집, 기술 검토, 성능 최적화, 다양한 방안 제안 등 다양한 업무를 3년간 서버 운영부터 프로젝트 개발까지 전담한 실무 경험이 있습니다.
- 기술의 진보에 따라 유행은 쫓지 않지만 현대적이고 동시에 검증된 기술을 적극 도입해보고 있습니다. 예로 회사 업무 중 필요에 따라 Git, Docker, Vue.js, Xdebug 등 기술을 도입했었고 개인 프로젝트에서는 인프라 현대화, AI 개발, CI/CD 구축 등 업무 자동화를 시도해보았습니다.

---

## [기술 스택]

### 인프라 층
| | |
| --- | --- |
| **운영** | Linux(cloud server) + Docker + GitHub Actions CI/CD |
| **개발(신규)** | Linux(WSL2 + CloudFlare Tunnel), Docker, SonarQube, Promethus+Grafana, Hermes, Claude/Codex, anythingllm, Ollama |
| **개발(레거시)** | Mutagen + Git(local) + VSCode Remote SSH |
| | |

### 프로젝트 층
| | |
| --- | --- |
| **신규** | PHP Laravel + MySQL/PostgreSQL + Next.js/Vue.js(npm) |
| **레거시** | vanilla PHP + MySQL + jQuery/Vue.js(cdn) |
| | |

### 라이브러리
| | |
| --- | --- |
| **크롤링** | Puppeteer(Node.js + Express), Chrome Extension |
| **임베딩 검색** | [pgvector](https://hub.docker.com/r/pgvector/pgvector)([Ollama bge-m3](https://ollama.com/library/bge-m3) 벡터 결과값) |
| **외부 API** | [Ohoo 이미지 편집](https://studio.ohoolabs.com/), [1688 API SDK](https://open.1688.com/support/doc/index), CJ대한통운 송장정보 API |
| **AI 이미지 처리** | [rembg](https://github.com/danielgatis/rembg)(Docker + Python + AI) |
| **PDF 병합** | PyPDF2(Python) |
| | |

---

## [포트폴리오]

### [AI 카테고리 추천 서비스](https://embed.cunlim.dev/)
- **기간:** 2026.04.17 ~ 2026.06.07 (1~2개월)
- **역할:** 풀스택 개발자 (1명)
- **사용 기술 및 인프라:** Linux(WSL2 + CloudFlare Tunnel), Docker, GitHub Actions CI/CD, Laravel, Next.js, Shadcn, PostgreSQL(pgvector), Ollama
- **목적:** AI 개발 적극 도입, 모던 기술스택 적극 차용, 전 회사에서 미처 해결하지 못했던 기능 시도
- **주요 성과:**
  - AI 모델들의 차이와 비용 체감
  - AI 개발과정 컨트롤 능력 향상 (MCP, Skills, Harness)
  - 모던한 기술스택 도메인 지식 확장

---

## [주요 경력 및 프로젝트 경험]

### 1. Docsoft(한국 스타트업) - 풀스택 개발자
- **기간:** 2022.09 ~ 2025.08 (2년 10개월)
- **역할:** 풀스택 개발자 (직원 3~5명 스타트업)
- **사용 기술 및 인프라:** Docker, Nginx, Git, Certbot, PHP(Composer, Xdebug), Python, Express(Node.js), MySQL, jQuery, Vue(CDN), Chrome Extension, C# terminal app
- **협업 도구:** FTP, Git, Google Spreadsheet
- **주요 업무:**
  - 배대지, 드랍쉽핑, 쇼핑몰 개발
  - 그누보드5 기반 레거시 서비스 개발, 인프라 현대화
  - 기존 프로젝트 서버 이전, 신규 프로젝트 호스팅
- **주요 성과:**
  - **유지보수, 리뉴얼, 신규 기능 개발:** 배송대행 서비스, 3pl 드랍쉽핑 서비스, 쇼핑몰
  - **아키텍처 개편 및 인프라 구축:** Docker, Certbot, Composer, Xdebug 도입
  - **업무요청에 맞게 신규 기술 도입:** PyPDF2(Python), Express(Node.js), Vue(CDN) 도입
  - **협업 인프라 구축:** Git, [VSCode + Remote SSH + saveBackup extension + 저장로그 통계 서비스 개발], 신규 기술 문서화
  - **DB 백업 및 로그:** DB 매일 백업, DB 구조 변경 history 매시간 감지
  - **성능 개선:** slow query, 코드블록 별 실행시간 추적을 통하여 병목지점을 찾아내어 튜닝

### 2. HanKui (중국 스타트업) — 풀스택 개발자
- **기간:** 2019.11 ~ 2020.07 (9개월)
- **역할:** 풀스택 개발자 (직원 4명 스타트업)
- **사용 기술, 인프라:** Baota Panel, PHP, MySQL, jQuery, APICloud 하이브리드 앱개발
- **협업 도구:** FTP
- **프로젝트 1: "12377" — 당근마켓형 정보게시판**
  - **기여도:** 웹 프론트(80%), SQL(20%), PHP(20%), APICloud 하이브리드 앱(100%) 담당.
  - **트래픽:** 일평균 3,000~5,000회.
- **프로젝트 2: "cjmax" — 유튜브 유형의 1인 미디어 게시판**
  - **기여도:** 기획, 디자인, 사내 bootstraping 소스를 받아 100% 전담 개발.

### 3. 심플렉스 (Cafe24 중국 지사) — 퍼블리셔
- **기간:** 2019.05 ~ 2019.08 (3개월)
- **역할:** 퍼블리셔 (직원 약 200명)
- **사용 기술, 인프라:** WAMP, HTML, CSS
- **협업 도구:** SVN, 사내 Wiki, JIRA
- **주요 업무:**
  - 입사 교육 (HTML, CSS, 사내 guide 문서)
  - 쇼핑몰 홈페이지, 상품리스트 페이지 개발 (퍼블리셔 팀 16명).
  - 쇼핑몰 관리자 페이지 신규개발, 유지보수 (UI 팀 8명 + 한국 본사 직원).

---

## [학력 (Education)]
- **연변대학교 (Yanbian University)** — 211 중점 대학
  - 건축학 학사
  - 2012.08 ~ 2016.06 졸업
  - 모든 교육은 대학교까지 중국에서 마침
