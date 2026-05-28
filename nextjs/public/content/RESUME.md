# 이력서 (Resume)

## [인적 사항]
- **직무:** 백엔드 / 풀스택 소프트웨어 엔지니어 (Legacy Modernization Specialist)
- **경력:** 실무 3년 차
- **보유 외국어:** 한국어 (모국어), 중국어 (기초 일상 소통), 영어 (기초 기술 문서 독해)

---

## [소개]
**"실무 3년 차의 끈기와 문제 해결 능력을 바탕으로 레거시 시스템을 현대화하는 개발자입니다."**
비전공자로 시작하여 그누보드5 기반 레거시 환경에서 3년간 실무 경험을 쌓았으며, 서비스의 안정성을 유지하면서 대규모 마이그레이션과 인프라 현대화를 이끄는 데 강점이 있습니다. Docker를 활용한 개발 환경 표준화, Puppeteer/Python을 이용한 업무 자동화, GitHub Actions를 통한 CI/CD 파이프라인 구축 등 개발 생산성을 극대화하는 도구와 기술을 적극적으로 도입하고 활용합니다. 최근에는 안정적인 아키텍처 설계(Laravel, Next.js)와 로컬 AI 생태계(MCP, Ollama)를 접목하여 개발 효율성을 고도화하는 데 집중하고 있습니다.

---

## [기술 스택 (Technical Skills)]

### Backend & Core
- **PHP:** Laravel, GNUBOARD5, PHP-FPM
- **Node.js:** Puppeteer (크롤링 자동화 스크립트 작성)
- **Python:** 스크립트 작성 및 데이터 처리 (DeepFace 활용 이미지 분석)

### Frontend
- **Frameworks/Libraries:** Next.js, React, Vue.js (CDN 방식), jQuery
- **Web Basics:** HTML5, CSS3, JavaScript (ES6+)

### Database & Infrastructure
- **Database:** MySQL
- **DevOps/Environment:** Docker, Nginx, WSL2 (Windows Subsystem for Linux)
- **CI/CD:** GitHub Actions (Self-Hosted Runner 환경 구축)
- **Version Control:** Git, GitHub

### AI Tools & Workflows
- **Local AI & Ecosystem:** Ollama (로컬 대형 언어 모델 운용), MCP (Model Context Protocol) 기반 개발 툴킷 구성 및 활용 (Claude Code, Gemini CLI, OpenCode 등)

---

## [주요 경력 및 프로젝트 경험 (Experience & Projects)]

### 1. 레거시 서비스 현대화 및 인프라 표준화 (실무 경험)
- **기간:** 3년 실무 경력 내 진행
- **역할 및 주요 내용:** 그누보드5 기반의 기존 서비스(게시판, 1대1 문의, 쇼핑몰 등)의 핵심 비즈니스 로직과 기능을 안정적으로 유지하면서, 유지보수 효율성과 확장성을 높이기 위한 아키텍처 개편 및 인프라 구축
- **주요 성과:**
  - Docker를 활용하여 사내 및 로컬 개발 환경을 컨테이너화 (`Nginx + PHP-FPM + MySQL`) 하여 개발 인프라 표준화 달성.
  - WSL2 환경 내에 PHP 소스 코드를 배치하고 볼륨(Volume) 설정을 연동하여, 파일 동기화 속도 최적화 및 쾌적한 로컬 호스팅 개발 환경 구축.
  - 안정적이고 독립적인 컨테이너 환경 구축을 통해 레거시 코드 개편 과정에서의 환경 의존성 문제 전면 해결.

### 2. AI 기반 카테고리 추천 서비스 (포트폴리오 프로젝트)
- **기간:** 2026.04 ~ 현재 (진행 중)
- **역할 및 주요 내용:** 다양한 이커머스 마켓의 방대한 카테고리 데이터를 효율적으로 처리하고, AI 모델을 연동하여 최적의 카테고리를 추천하는 웹 서비스 개발
- **사용 기술:** Next.js, Laravel, Docker, MySQL
- **주요 업무 및 해결 과제:**
  - 프론트엔드(Next.js)와 백엔드(Laravel) 아키텍처 설계 및 분리된 컨테이너 환경 초기화 및 연동.
  - 마켓별로 수천 개에서 수만 개에 이르는 방대한 카테고리 테이블 데이터를 유실 없이 효율적으로 대량 인입(Bulk Insert) 및 관리할 수 있는 데이터베이스 구조 및 정적 로직 설계.

### 3. GitHub Actions Self-Hosted Runner 기반 CI/CD 구축
- **기간:** 2026.04
- **역할 및 주요 내용:** 프로젝트의 배포 자동화 및 사내 인프라 자원 효율화를 위한 파이프라인 설계 및 구현
- **사용 기술:** GitHub Actions, Git
- **주요 성과:**
  - 외부 클라우드 자원에 의존하지 않고, 인프라 비용 절감 및 보안 강화를 위해 사내 환경에 **GitHub Actions Self-Hosted Runner**를 직접 구현 및 연동 완료.
  - 코드 푸시부터 빌드, 테스트, 배포까지의 과정을 자동화하여 수동 배포 프로세스 제거 및 배포 오류율 0% 달성.

### 4. 데이터 크롤링 및 이미지 자동 분류 시스템 개발
- **기간:** 2024.03 ~ 2026.04 (지속 고도화)
- **역할 및 주요 내용:** 수작업으로 진행되던 데이터 수집 및 미디어 자원 관리 업무를 전면 자동화하기 위한 스크립트 및 시스템 개발
- **사용 기술:** Node.js, Puppeteer, Python, DeepFace
- **주요 성과:**
  - **크롤링 자동화:** Node.js와 Puppeteer를 활용하여 반복적인 대량 웹 데이터 수집을 자동화하고 사내 DB에 동기화하는 시스템 구축.
  - **얼굴 클러스터링 시스템:** Python과 안면 인식 라이브러리인 DeepFace를 활용하여 대량의 이미지 파일 속 인물을 자동 감지하고 분류하는 시스템 개발.
  - 소스 폴더를 주기적으로 비우고 새로운 이미지를 채워 넣더라도, 기존에 분류된 인물별 폴더 구조를 추적하여 매칭되는 인물 폴더에 정확히 증분 투입되는 안정적인 유기적 파이프라인 구축.

---

## [학력 (Education)]
- **연변대학교 (Yanbian University)**
  - 전공: 건축학 학사 (4년제)
  - 기간: 2012년 입학 — 졸업

---

## [자기계발 및 업무 생산성 혁신]
- **AI 에이전트 생태계 최적화:** 로컬 환경에서 Ollama를 활용해 효율적으로 AI 모델을 실행하며, MCP(Model Context Protocol) 서버를 다각도로 구축(Git, GitHub, Filesystem, Playwright, Web Search 등)하여 개발 환경(OpenCode, Claude Code 등)과 유기적으로 연동해 생산성을 일반 개발자 대비 극대화하고 있습니다.
- **지속적인 역량 확장:** 새로운 아키텍처(Laravel/Next.js SPA)와 고도화된 자동화 도구 학습에 주저함이 없으며, 논리적이고 체계적인 구조 설계(건축학 전공 배경 기반) 능력을 소프트웨어 아키텍처 설계에 투영하여 견고한 코드를 작성합니다.