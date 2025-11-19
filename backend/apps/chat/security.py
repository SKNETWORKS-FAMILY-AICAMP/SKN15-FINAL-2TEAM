"""
Chat Security Module
프롬프트 인젝션 방어 및 콘텐츠 필터링

주요 기능:
1. 프롬프트 인젝션 탐지 및 차단
2. 유해 콘텐츠 필터링
3. 입력 검증 및 정제
4. 가드레일 에이전트 통합
"""

import re
import logging
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class SecurityCheckResult:
    """보안 검사 결과"""
    is_safe: bool
    risk_level: str  # 'safe', 'low', 'medium', 'high', 'critical'
    detected_patterns: List[str]
    sanitized_input: str
    reason: str


class PromptInjectionDetector:
    """프롬프트 인젝션 탐지기"""

    # 프롬프트 인젝션 패턴들
    INJECTION_PATTERNS = [
        # 시스템 프롬프트 무시/재정의 시도
        r'ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)',
        r'disregard\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)',
        r'forget\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)',
        r'override\s+(system|instructions?|prompts?|rules?)',

        # 역할 변경 시도
        r'you\s+are\s+now\s+(a|an)\s+\w+',
        r'act\s+as\s+(a|an)\s+\w+',
        r'pretend\s+to\s+be\s+(a|an)\s+\w+',
        r'roleplay\s+as\s+(a|an)\s+\w+',
        r'imagine\s+you\s+are\s+(a|an)\s+\w+',

        # 시스템 명령 주입 시도
        r'system\s*:\s*',
        r'assistant\s*:\s*',
        r'###\s*instruction',
        r'<\|im_start\|>',
        r'<\|im_end\|>',

        # 프롬프트 구조 파괴 시도
        r'```\s*system',
        r'```\s*assistant',
        r'---\s*system',
        r'===\s*system',

        # 정보 추출 시도
        r'show\s+me\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?)',
        r'what\s+(is|are)\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?)',
        r'reveal\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?)',
        r'print\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?)',

        # 한국어 패턴
        r'이전\s+(지시|명령|프롬프트|규칙)(을|를)\s+(무시|잊어|삭제)',
        r'시스템\s+(지시|명령|프롬프트|규칙)(을|를)\s+(무시|잊어|변경|재정의)',
        r'너는\s+이제\s+\w+\s*(이야|야|입니다)',
        r'(시스템|어시스턴트)\s*:\s*',
        r'(너의|당신의)\s+(시스템\s+)?(지시|명령|프롬프트|규칙)(을|를)\s+(보여|알려|출력)',
    ]

    # 유해 콘텐츠 패턴
    HARMFUL_PATTERNS = [
        # 개인정보 탈취 시도
        r'(password|비밀번호|패스워드)\s*(is|:|=)',
        r'(api[_\s]?key|access[_\s]?token)\s*(is|:|=)',
        r'(credit\s+card|신용카드)\s+\d',

        # SQL 인젝션 패턴
        r'(union\s+select|drop\s+table|delete\s+from)',
        r'--\s*$',
        r"'\s*(or|and)\s*'",

        # 시스템 명령 실행 시도
        r'(exec|eval|system|shell)\s*\(',
        r'__import__',
        r'subprocess',
    ]

    # 허용된 특수문자 (정상적인 사용)
    ALLOWED_SPECIAL_CHARS = set('.,!?\'"-()[]{}:;/\\@#$%^&*+=~`\n\r\t ')

    def __init__(self):
        """초기화"""
        self.injection_regex = [re.compile(pattern, re.IGNORECASE) for pattern in self.INJECTION_PATTERNS]
        self.harmful_regex = [re.compile(pattern, re.IGNORECASE) for pattern in self.HARMFUL_PATTERNS]

    def detect(self, user_input: str) -> SecurityCheckResult:
        """
        프롬프트 인젝션 탐지

        Args:
            user_input: 사용자 입력

        Returns:
            SecurityCheckResult: 보안 검사 결과
        """
        detected_patterns = []
        risk_level = 'safe'

        # 1. 프롬프트 인젝션 패턴 검사
        for pattern in self.injection_regex:
            matches = pattern.findall(user_input)
            if matches:
                detected_patterns.append(f"Injection pattern: {pattern.pattern[:50]}")
                risk_level = 'high'

        # 2. 유해 콘텐츠 패턴 검사
        for pattern in self.harmful_regex:
            matches = pattern.findall(user_input)
            if matches:
                detected_patterns.append(f"Harmful pattern: {pattern.pattern[:50]}")
                if risk_level != 'high':
                    risk_level = 'medium'

        # 3. 비정상적인 특수문자 검사
        suspicious_chars = self._detect_suspicious_chars(user_input)
        if suspicious_chars:
            detected_patterns.append(f"Suspicious chars: {suspicious_chars[:20]}")
            if risk_level == 'safe':
                risk_level = 'low'

        # 4. 입력 길이 검사 (너무 긴 입력은 의심)
        if len(user_input) > 5000:
            detected_patterns.append("Input too long (>5000 chars)")
            if risk_level == 'safe':
                risk_level = 'low'

        # 5. 결과 생성
        is_safe = risk_level in ['safe', 'low']
        sanitized_input = self._sanitize(user_input) if is_safe else ""

        reason = self._generate_reason(risk_level, detected_patterns)

        return SecurityCheckResult(
            is_safe=is_safe,
            risk_level=risk_level,
            detected_patterns=detected_patterns,
            sanitized_input=sanitized_input,
            reason=reason
        )

    def _detect_suspicious_chars(self, text: str) -> str:
        """비정상적인 특수문자 탐지"""
        suspicious = []
        for char in text:
            if not (char.isalnum() or char in self.ALLOWED_SPECIAL_CHARS or ord(char) >= 0xAC00):
                suspicious.append(char)
        return ''.join(set(suspicious))

    def _sanitize(self, text: str) -> str:
        """입력 정제 (안전한 경우에만)"""
        # 여러 공백을 하나로
        text = re.sub(r'\s+', ' ', text)
        # 양쪽 공백 제거
        text = text.strip()
        # 길이 제한
        if len(text) > 5000:
            text = text[:5000]
        return text

    def _generate_reason(self, risk_level: str, detected_patterns: List[str]) -> str:
        """위험 이유 생성"""
        if risk_level == 'safe':
            return "입력이 안전합니다."
        elif risk_level == 'low':
            return f"낮은 위험: {', '.join(detected_patterns[:2])}"
        elif risk_level == 'medium':
            return f"중간 위험: 유해 패턴 탐지 - {', '.join(detected_patterns[:2])}"
        elif risk_level == 'high':
            return f"높은 위험: 프롬프트 인젝션 시도 탐지 - {', '.join(detected_patterns[:2])}"
        else:
            return "위험 수준 미상"


class GuardrailAgent:
    """
    가드레일 에이전트

    사용자 입력과 AI 응답을 검증하여 안전성을 보장합니다.
    """

    def __init__(self):
        """초기화"""
        self.injection_detector = PromptInjectionDetector()

    def validate_input(self, user_input: str) -> SecurityCheckResult:
        """
        사용자 입력 검증

        Args:
            user_input: 사용자 입력 메시지

        Returns:
            SecurityCheckResult: 보안 검사 결과
        """
        logger.info(f"🛡️ Validating user input (length: {len(user_input)})")

        # 1. 빈 입력 체크
        if not user_input or not user_input.strip():
            return SecurityCheckResult(
                is_safe=False,
                risk_level='safe',
                detected_patterns=[],
                sanitized_input='',
                reason='빈 입력입니다.'
            )

        # 2. 프롬프트 인젝션 탐지
        result = self.injection_detector.detect(user_input)

        if not result.is_safe:
            logger.warning(f"⚠️ Unsafe input detected: {result.reason}")
            logger.warning(f"⚠️ Detected patterns: {result.detected_patterns}")
        else:
            logger.info(f"✅ Input validated: {result.risk_level}")

        return result

    def validate_response(self, response: str) -> Tuple[bool, str]:
        """
        AI 응답 검증 (정보 유출 방지)

        Args:
            response: AI 응답 메시지

        Returns:
            (is_safe, reason): 안전 여부와 이유
        """
        # 시스템 프롬프트 유출 방지 패턴
        leak_patterns = [
            r'my\s+(system\s+)?(instructions?|prompts?|rules?)\s+(are|is)',
            r'as\s+an\s+ai\s+assistant,?\s+my\s+(instructions?|prompts?)',
            r'(저의|나의)\s+(시스템\s+)?(지시|명령|프롬프트)\s*(는|은)',
        ]

        for pattern in leak_patterns:
            if re.search(pattern, response, re.IGNORECASE):
                logger.warning(f"⚠️ Response contains potential prompt leak: {pattern}")
                return False, f"응답에 시스템 정보가 포함되어 있습니다: {pattern}"

        return True, "응답이 안전합니다."

    def get_safe_error_message(self, risk_level: str) -> str:
        """
        안전한 오류 메시지 반환 (공격자에게 정보 노출 방지)

        Args:
            risk_level: 위험 수준

        Returns:
            사용자에게 보여줄 안전한 메시지
        """
        if risk_level == 'high':
            return "😅 죄송합니다. 요청을 처리할 수 없습니다. 여행 계획과 관련된 질문을 해주세요."
        elif risk_level == 'medium':
            return "🤔 입력에 문제가 있는 것 같습니다. 다시 시도해주세요."
        else:
            return "⚠️ 요청을 처리할 수 없습니다. 다른 방식으로 질문해주세요."


# 전역 가드레일 인스턴스
_guardrail = None


def get_guardrail() -> GuardrailAgent:
    """
    가드레일 에이전트 싱글톤 인스턴스 가져오기

    Returns:
        GuardrailAgent: 가드레일 에이전트
    """
    global _guardrail
    if _guardrail is None:
        _guardrail = GuardrailAgent()
    return _guardrail
