#!/bin/bash

# 메트릭 경고 메시지 숨기기 위해 로그 레벨을 error로 설정
export K6_LOG_LEVEL=error

# k6 테스트 실행
k6 run chat-full-flow-test.js "$@"
