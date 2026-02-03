# Dream AI Studio - k6 부하 테스트

전체 동화책 생성 플로우에 대한 k6 부하 테스트 스크립트입니다.

## 📁 프로젝트 구조

```
k6test/
├── config.js                    # 설정 및 상수
├── modules/                     # API 모듈
│   ├── auth.js                  # 로그인
│   ├── chat.js                  # 채팅 시작, 장르/주제, 메시지
│   ├── summary.js               # Summary 생성 + 폴링
│   ├── persona.js               # Persona 생성 + 폴링
│   ├── page.js                  # Page 생성 + 폴링
│   └── image.js                 # Image 생성 + 폴링
├── chat-basic-test.js           # 기본 채팅 테스트 (기존)
└── chat-full-flow-test.js       # 전체 플로우 테스트 (신규)
```

## 🎯 테스트 플로우

`chat-full-flow-test.js`는 다음 순서로 테스트를 진행합니다:

1. **로그인** - JWT 토큰 획득
2. **채팅 시작** - 스토리 ID 생성
3. **장르 설정** - 랜덤 장르 선택
4. **주제 설정** - 랜덤 주제 선택
5. **메시지 6회 전송** - AI와 대화
6. **Summary 생성 + 폴링** - 이야기 요약 생성 대기
7. **Persona 생성 + 폴링** - 등장인물 생성 대기
8. **Page 생성 + 폴링** - 페이지 생성 대기
9. **Image 생성 + 폴링** - 첫 번째 페이지 이미지 생성 대기

## 🚀 사용 방법

### 1. 서버 실행 (Fake 이미지 모드)

비용 절감을 위해 Fake 이미지 생성기를 사용합니다:

```bash
# dev 프로필로 실행 (application-dev.yml에 fake 설정됨)
./gradlew bootRun --args='--spring.profiles.active=dev'
```

### 2. k6 테스트 실행

```bash
cd k6test
k6 run chat-full-flow-test.js
```

### 3. 실제 DALL-E API로 테스트 (선택사항)

```bash
# Real 모드로 서버 재시작
./gradlew bootRun --args='--spring.profiles.active=dev --image.generator.mode=real'

# k6 테스트 실행
cd k6test
k6 run chat-full-flow-test.js
```

## ⚙️ 설정 변경

### 부하 테스트 설정 변경

`config.js` 파일에서 수정:

```javascript
export const LOAD_TEST_OPTIONS = {
  stages: [
    { duration: '1m', target: 10 },    // 워밍업
    { duration: '2m', target: 20 },    // 1단계
    { duration: '2m', target: 30 },    // 2단계 (최대)
    { duration: '1m', target: 10 },    // 점진적 감소
    { duration: '1m', target: 0 },     // 완전 종료
  ],
  // ...
};
```

### 이미지 생성 개수 변경 ⭐

`config.js` 파일에서 수정:

```javascript
export const IMAGE_GENERATION_CONFIG = {
  imagesPerStory: 3  // 각 스토리당 생성할 이미지 개수
};
```

**설정 값:**
- `0`: 이미지 생성 건너뛰기 (Summary, Persona, Page만 테스트)
- `1`: 첫 번째 페이지만 (가장 빠른 테스트)
- `3`: 첫 3개 페이지 (기본값, 균형잡힌 테스트)
- `5`: 첫 5개 페이지
- `-1` 또는 `999`: 모든 페이지 (가장 현실적인 시나리오)

**예시:**
```javascript
// 빠른 테스트 (이미지 생성 건너뛰기)
imagesPerStory: 0

// 기본 테스트 (3개)
imagesPerStory: 3

// 전체 플로우 테스트 (모든 페이지)
imagesPerStory: -1
```

### 폴링 타임아웃 변경

`config.js` 파일에서 수정:

```javascript
export const POLLING_CONFIG = {
  summary: {
    maxAttempts: 60,      // 최대 시도 횟수
    intervalMs: 2000,     // 2초 간격
    timeoutMs: 120000     // 2분 타임아웃
  },
  // ...
};
```

### 서버 URL 변경

`config.js` 파일에서 수정:

```javascript
export const SERVER_URL = 'https://dev-api.dreamai.studio';
```

## 📊 메트릭

테스트 실행 시 다음 메트릭이 수집됩니다:

### 개별 단계 메트릭
- `login_duration` - 로그인 소요 시간
- `chat_start_duration` - 채팅 시작 소요 시간
- `genre_set_duration` - 장르 설정 소요 시간
- `theme_set_duration` - 주제 설정 소요 시간
- `message_send_duration` - 메시지 전송 소요 시간
- `summary_generation_duration` - Summary 생성 소요 시간 (폴링 포함)
- `persona_generation_duration` - Persona 생성 소요 시간 (폴링 포함)
- `page_generation_duration` - Page 생성 소요 시간 (폴링 포함)
- `image_generation_duration` - Image 생성 소요 시간 (폴링 포함)

### 전체 플로우 메트릭
- `full_flow_duration` - 전체 플로우 완료까지 소요 시간

### 기본 HTTP 메트릭
- `http_req_duration` - HTTP 요청 응답 시간
- `http_req_failed` - HTTP 요청 실패율

## 🔧 개발자 가이드

### 새로운 API 추가하기

1. `modules/` 디렉토리에 새로운 모듈 파일 생성
2. 함수 export
3. `chat-full-flow-test.js`에서 import 및 사용

예시:

```javascript
// modules/order.js
import http from 'k6/http';
import { check } from 'k6';
import { SERVER_URL } from '../config.js';

export function createOrder(token, storyId) {
  const response = http.post(
    `${SERVER_URL}/api/v1/orders`,
    JSON.stringify({ storyId }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }
  );

  return check(response, {
    '✅ 주문 생성 성공': (r) => r.status === 200,
  });
}
```

```javascript
// chat-full-flow-test.js
import { createOrder } from './modules/order.js';

// ... 테스트 플로우에 추가
createOrder(userToken, currentStoryId);
```

## 🎨 Fake vs Real 이미지 생성

### Fake 모드 (기본값)
- **비용**: 무료
- **속도**: 20-35초
- **용도**: 부하 테스트, 개발 환경
- **설정**: `application-dev.yml`에 `image.generator.mode: fake`

### Real 모드
- **비용**: DALL-E API 과금
- **속도**: 3-10초 (실제 이미지 생성)
- **용도**: 실제 API 테스트, QA
- **설정**: `--image.generator.mode=real` 옵션 또는 yml 수정

## 📈 예상 결과

30명 동시 사용자 기준:
- **Summary 생성**: ~5-20초
- **Persona 생성**: ~5-20초
- **Page 생성**: ~10-30초
- **Image 생성** (Fake, 1개당): ~20-35초

### 전체 플로우 소요 시간 (설정별)

| 이미지 생성 개수 | 예상 소요 시간 | 용도 |
|----------------|--------------|------|
| `0` (건너뛰기) | 약 1-2분 | Summary/Persona/Page만 테스트 |
| `1` (1개) | 약 2-3분 | 빠른 전체 플로우 검증 |
| `3` (3개) | 약 3-5분 | **기본 설정, 균형잡힌 테스트** |
| `5` (5개) | 약 4-6분 | 더 많은 이미지 생성 테스트 |
| `-1` (모든 페이지) | 약 5-10분 | 가장 현실적인 시나리오 |

**참고:** 이미지 생성은 순차적으로 진행되며, 각 이미지마다 1초의 간격이 있습니다.

## 🐛 에러 추적 및 리포트

### 자동 에러 수집

테스트 실행 중 발생한 모든 에러가 자동으로 수집됩니다:
- API 호출 실패 (4xx, 5xx 에러)
- 폴링 타임아웃
- 이미지 생성 실패

### 에러 리포트 파일

테스트 완료 후 `error-report.json` 파일이 생성됩니다:

```json
{
  "summary": {
    "totalErrors": 5,
    "testDuration": 3245.67,
    "totalRequests": 1234,
    "failedRequests": 5,
    "timestamp": "2025-01-17T10:30:00.000Z"
  },
  "errorsByStage": {
    "summary_generate": {
      "count": 2,
      "storyIds": [123, 456],
      "pageIds": [],
      "statusCodes": { "500": 2 }
    },
    "image_polling": {
      "count": 3,
      "storyIds": [],
      "pageIds": [1001, 1002, 1003],
      "statusCodes": {}
    }
  },
  "detailedErrors": [
    {
      "timestamp": "2025-01-17T10:25:30.123Z",
      "vuId": 5,
      "iteration": 2,
      "stage": "summary_generate",
      "storyId": 123,
      "statusCode": 500,
      "errorMessage": "Summary 생성 요청 실패 (status: 500)"
    }
  ]
}
```

### 에러 정보에 포함되는 데이터

각 에러에 대해 다음 정보가 수집됩니다:
- **timestamp**: 에러 발생 시각
- **vuId**: Virtual User ID (어떤 가상 사용자에서 발생했는지)
- **iteration**: Iteration 번호 (몇 번째 반복에서 발생했는지)
- **stage**: 에러 발생 단계 (summary_generate, persona_polling, image_generate 등)
- **storyId**: 스토리 ID (있는 경우)
- **pageId**: 페이지 ID (있는 경우)
- **requestId**: 요청 ID (이미지 생성의 경우)
- **statusCode**: HTTP 상태 코드 (있는 경우)
- **errorMessage**: 에러 메시지

### 콘솔 출력

테스트 종료 시 콘솔에도 에러 통계가 출력됩니다:

```
🏁 전체 플로우 테스트 완료!
📊 결과를 확인하세요:
   - 전체 플로우 소요 시간
   - 각 단계별 응답 시간
   - 실패율 및 타임아웃 발생 여부

⚠️ 에러 발생 통계:
   총 에러: 5건
   - summary_generate: 2건
     └─ storyIds: 123, 456
   - image_polling: 3건
     └─ pageIds: 1001, 1002, 1003

💾 에러 상세 정보는 error-report.json 파일을 확인하세요
```

## ⚠️ 주의사항

1. **Real 모드 비용**: Real 모드로 부하 테스트 시 DALL-E API 과금이 발생합니다.
2. **서버 리소스**: 최대 70명 동시 접속은 서버 사양에 따라 조정이 필요할 수 있습니다.
3. **타임아웃**: 폴링 타임아웃은 서버 응답 속도에 따라 조정하세요.
4. **테스트 계정**: `config.js`의 `TEST_USERS`를 실제 존재하는 계정으로 변경하세요.
5. **에러 리포트**: 테스트 후 `error-report.json` 파일을 확인하여 실패한 storyId/pageId를 파악할 수 있습니다.
