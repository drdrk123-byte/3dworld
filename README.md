# 그림 산책 — Vercel 배포용 프로젝트

학생 그림을 참고해 3D 월드를 편집하고 탐험하는 웹앱입니다. Google 로그인·온라인 프로젝트 저장·학생 공유 링크는 아직 포함되지 않았습니다. 월드는 사용하는 브라우저에 저장되므로 파일로 백업하세요.

## 로컬 실행

Node.js 22 설치 후 `실행하기.cmd`를 실행하거나 프로젝트 폴더에서 `npm start`를 실행합니다. 주소는 http://127.0.0.1:4174 입니다. 별도 패키지를 설치하지 않아도 실행됩니다. 첫 접속이 안 되면 잠시 후 새로고침하세요.

## Vercel에 나중에 배포하기

1. 이 폴더 전체를 본인의 Git 저장소에 올립니다. `public` 폴더만 올리지 마세요. 비밀 키나 `.env` 파일은 올리지 않습니다.
2. Vercel에서 저장소를 Import합니다. Root Directory는 이 프로젝트 폴더를 선택합니다.
3. Framework Preset은 **Other**, Build Command는 **npm run build**, Output Directory는 **public**, Node.js는 **22.x**를 사용합니다. `vercel.json`에 설정이 포함되어 있습니다.
4. 결제나 요금제 전환 화면이 나타나면 진행하지 말고 비용을 확인하세요. 이 작업에서 Vercel 가입·배포·결제는 하지 않았습니다.
5. 처음에는 AI 설정 없이 배포하고 편집·탐험을 확인할 수 있습니다.

## 기존 Gemini 키 연결

Vercel은 실행마다 서버가 바뀔 수 있어, 로컬 서버 메모리에 API 키를 보관하는 방식 대신 **서버 환경변수**를 사용합니다. API 키는 브라우저 입력창에 넣지 않습니다.

Vercel 프로젝트의 Settings → Environment Variables에 다음 값을 등록합니다. 실제 키를 소스 코드에 붙여 넣지 마세요.

| 이름 | 값 |
|---|---|
| `GEMINI_API_KEY` | 기존 Gemini API 키 |
| `GEMINI_MODEL` | 본인 프로젝트에서 사용할 수 있고 요금을 확인한 이미지 입력·JSON 출력 지원 모델 ID |
| `APP_ACCESS_TOKEN` | 직접 만든 별도 교사용 비밀 암호, 무작위 32자 이상. Gemini 키와 다른 값 |
| `AI_ENABLED` | 처음에는 `false`. 요금·사용 한도를 확인하고 API 사용을 승인한 뒤에만 `true` |

환경변수 변경을 반영하려면 재배포가 필요합니다. 로컬에서는 `.env.example`을 `.env`로 복사해 설정할 수 있습니다. `.env`는 공유하지 마세요.

앱의 **AI 연결 설정**에는 `APP_ACCESS_TOKEN`만 입력합니다. 이 암호는 현재 탭 메모리에만 보관하고 새로고침하면 지웁니다. Gemini 키는 Google API 요청을 처리하는 서버에서만 사용합니다. 서버와 브라우저는 키를 응답·월드 파일·로그에 기록하지 않도록 구현했습니다.

그림 업로드 → AI 초안 만들기 → **그림 전송·이번 호출 승인** → 분석 결과 확인 → 초안 적용 순서입니다. 적용 전에는 기존 월드를 유지하며, 적용 후에는 실행 취소할 수 있습니다.

## 학생용 월드 목록 저장소 (Firebase Firestore + Google 로그인)

교사용 탭의 **학생용 게시 목록**에서 월드를 게시하면 학생 탭에 바로 나타나게 하려면 아래를 한 번 설정합니다. 설정하지 않으면 `public/worlds.json` 파일 방식으로 동작합니다.

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트를 만들고 **Firestore Database**를 생성합니다. 규칙은 기본(모두 거부)을 그대로 두세요. 서버가 서비스 계정으로만 접근합니다.
2. 프로젝트 설정 → **서비스 계정** → **새 비공개 키 생성**으로 JSON을 받습니다. 이 파일은 비밀입니다. GitHub에 올리지 마세요.
3. [Google Cloud 콘솔](https://console.cloud.google.com) → API 및 서비스 → 사용자 인증 정보 → **OAuth 클라이언트 ID(웹 애플리케이션)**를 만들고 승인된 JavaScript 원본에 배포 주소(예: `https://3dworld-theta.vercel.app`)를 추가합니다. OAuth 동의 화면이 테스트 상태면 교사 이메일을 테스트 사용자로 추가하세요.
4. Vercel 환경변수에 등록하고 재배포합니다.

| 이름 | 값 |
|---|---|
| `FIREBASE_PROJECT_ID` | JSON의 `project_id` |
| `FIREBASE_DATABASE_ID` | Firestore 데이터베이스 이름(기본 데이터베이스면 비워 둠) |
| `FIREBASE_CLIENT_EMAIL` | JSON의 `client_email` |
| `FIREBASE_PRIVATE_KEY` | JSON의 `private_key` 전체 |
| `GOOGLE_CLIENT_ID` | 3단계의 클라이언트 ID |
| `TEACHER_EMAILS` | 게시를 허용할 교사 Google 이메일(쉼표로 여러 개 가능) |

목록 조회는 누구나, 게시·삭제는 `TEACHER_EMAILS`의 Google 계정으로 로그인했을 때만 가능합니다(서버가 Google 토큰을 검증). 월드는 최대 30개입니다. AI 초안 만들기는 계속 `APP_ACCESS_TOKEN`을 사용합니다.

## 과금과 현재 한계

- 기본 상태에서 AI 호출은 차단됩니다. 실제 API 호출·유료 서비스 가입·결제는 이 제작 과정에서 하지 않았습니다.
- 앱은 Google 계정의 무료 여부나 잔여 한도를 자동 확인하지 않습니다. `AI_ENABLED=true` 전에 사용자가 반드시 확인해야 합니다.
- 자동 재시도·자동 모델 변경·유료 전환은 없습니다. 실패나 시간 초과여도 Google이 이미 처리했을 수 있으니 사용량을 확인한 뒤 재시도하세요.
- 현재는 교사 개인용 연결 암호 방식입니다. 사용자별 인증·서버의 영구 호출 횟수 제한·동시 요청 차단은 아직 없으므로 암호를 학생과 공유하지 마세요. API 제공자 측 제한도 직접 설정해야 합니다. 대규모 공개 서비스 운영 전 인증·할당량 제어가 추가로 필요합니다.
- 분석은 최대 240초(4분) 동안 대기합니다. Vercel 함수는 최대 300초로 구성했습니다(Hobby 최대값, Fluid compute 사용 시). 실제 플랜 제한을 확인하세요. 백그라운드 작업 복구는 지원하지 않으므로 요청 중 탭을 유지하세요.
- 실제 키를 사용한 생성 품질과 Vercel 실제 배포는 아직 검증하지 않았습니다. 테스트는 외부 API를 호출하지 않는 모의 응답으로 수행했습니다.
- 3D 충돌은 단순 영역이며 정밀한 지붕·경사면 물리는 지원하지 않습니다.

## 파일 구성

- `public/`: 화면·3D 엔진·브라우저 편집기
- `api/`: Vercel 서버 함수
- `lib/ai.cjs`: Gemini 호출·장면 검증
- `server.cjs`: 로컬 실행
- `tests/`: 비용 없이 실행하는 검증 (`npm test`)
- `vercel.json`: 배포 설정

Three.js의 MIT 라이선스는 `public/vendor/LICENSE`에 포함되어 있습니다.

구현 참고: [Google Gemini GenerateContent](https://ai.google.dev/api/generate-content), [Vercel Functions](https://vercel.com/docs/functions), [Vercel 프로젝트 설정](https://vercel.com/docs/project-configuration).
