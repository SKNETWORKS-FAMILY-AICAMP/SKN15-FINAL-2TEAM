"""
Performance tracking models for chat bot
"""
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class BotPerformanceLog(models.Model):
    """봇 응답 시간 및 성능 로깅"""

    # 기본 정보
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    room_idx = models.IntegerField(null=True, blank=True)

    # 요청 정보
    user_message = models.TextField(help_text="사용자 입력")
    detected_intent = models.CharField(max_length=100, null=True, blank=True, help_text="감지된 의도")
    tool_used = models.CharField(max_length=100, null=True, blank=True, help_text="사용된 도구명")

    # 시간 측정 (초 단위)
    total_time = models.FloatField(help_text="전체 처리 시간 (초)")
    llm_time = models.FloatField(null=True, blank=True, help_text="LLM 응답 시간 (초)")
    tool_time = models.FloatField(null=True, blank=True, help_text="Tool 실행 시간 (초)")
    rag_time = models.FloatField(null=True, blank=True, help_text="RAG 검색 시간 (초)")
    db_time = models.FloatField(null=True, blank=True, help_text="DB 쿼리 시간 (초)")

    # 결과 정보
    success = models.BooleanField(default=True)
    error_message = models.TextField(null=True, blank=True)
    response_length = models.IntegerField(null=True, blank=True, help_text="응답 길이 (문자)")

    # 추가 메타데이터
    metadata = models.JSONField(null=True, blank=True, help_text="추가 성능 데이터")

    class Meta:
        db_table = 'bot_performance_log'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['tool_used']),
            models.Index(fields=['success']),
        ]

    def __str__(self):
        return f"[{self.created_at}] {self.tool_used or 'unknown'}: {self.total_time:.2f}s"


class RAGTestLog(models.Model):
    """RAG 시스템 테스트 로그"""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    # 테스트 입력
    query = models.TextField(help_text="검색 쿼리")
    country_code = models.CharField(max_length=10, null=True, blank=True)
    province_idx = models.IntegerField(null=True, blank=True)
    top_k = models.IntegerField(default=3)

    # RAG 성능
    search_time = models.FloatField(help_text="벡터 검색 시간 (초)")
    llm_refinement_time = models.FloatField(null=True, blank=True, help_text="LLM 정제 시간 (초)")
    total_time = models.FloatField(help_text="전체 시간 (초)")

    # 결과
    results_count = models.IntegerField(help_text="검색된 결과 수")
    rag_results = models.JSONField(null=True, blank=True, help_text="RAG 검색 결과")
    refined_plan = models.JSONField(null=True, blank=True, help_text="LLM 정제 결과")

    # 🆕 추가 성능 지표
    avg_similarity_score = models.FloatField(null=True, blank=True, help_text="평균 유사도 점수")
    min_similarity_score = models.FloatField(null=True, blank=True, help_text="최소 유사도 점수")
    max_similarity_score = models.FloatField(null=True, blank=True, help_text="최대 유사도 점수")
    similarity_std_dev = models.FloatField(null=True, blank=True, help_text="유사도 표준편차")

    # 성공 여부
    success = models.BooleanField(default=True)
    error_message = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'rag_test_log'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['success']),
        ]

    def __str__(self):
        return f"[{self.created_at}] RAG: {self.query[:50]} ({self.total_time:.2f}s)"
