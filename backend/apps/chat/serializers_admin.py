"""
Serializers for admin chat performance and RAG testing
"""
from rest_framework import serializers
from .models_performance import BotPerformanceLog, RAGTestLog


class BotPerformanceLogSerializer(serializers.ModelSerializer):
    """Bot Performance Log serializer"""
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = BotPerformanceLog
        fields = [
            'id', 'created_at', 'user', 'user_email', 'room_idx',
            'user_message', 'detected_intent', 'tool_used',
            'total_time', 'llm_time', 'tool_time', 'rag_time', 'db_time',
            'success', 'error_message', 'response_length', 'metadata'
        ]


class RAGTestLogSerializer(serializers.ModelSerializer):
    """RAG Test Log serializer"""
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = RAGTestLog
        fields = [
            'id', 'created_at', 'user', 'user_email',
            'query', 'country_code', 'province_idx', 'top_k',
            'search_time', 'llm_refinement_time', 'total_time',
            'results_count', 'rag_results', 'refined_plan',
            'success', 'error_message'
        ]


class PerformanceStatsSerializer(serializers.Serializer):
    """Performance statistics serializer"""
    period = serializers.CharField()
    total_stats = serializers.DictField()
    tool_stats = serializers.ListField()
    hourly_stats = serializers.ListField()
    slow_requests = serializers.ListField()


class RAGTestRequestSerializer(serializers.Serializer):
    """RAG test request serializer"""
    query = serializers.CharField(required=True, help_text="검색 쿼리")
    country_code = serializers.CharField(required=False, allow_null=True, help_text="국가 코드")
    province_idx = serializers.IntegerField(required=False, allow_null=True, help_text="지역 인덱스")
    top_k = serializers.IntegerField(default=3, help_text="검색 결과 수")
    use_llm = serializers.BooleanField(default=True, help_text="LLM 정제 사용 여부")
