/**
 * RAG System Tester - RAG 시스템 직접 테스트
 */
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  Paper,
  FormControlLabel,
  Switch,
} from '@mui/material';
import api from '../../services/api';

export default function RAGSystemTester() {
  const [query, setQuery] = useState('');
  const [useLLM, setUseLLM] = useState(true);
  const [topK, setTopK] = useState(3);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    if (!query.trim()) {
      setError('검색 쿼리를 입력하세요');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await api.post('/api/chat/admin/rag-test/test_rag/', {
        query: query.trim(),
        top_k: topK,
        use_llm: useLLM,
      });

      setResult(response.data);
    } catch (err: any) {
      console.error('RAG test failed:', err);
      setError(err.response?.data?.error || 'RAG 테스트 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        🧪 RAG 시스템 테스트
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        RAG 시스템을 직접 테스트하고 결과를 확인할 수 있습니다.
      </Typography>

      {/* 입력 폼 */}
      <Card elevation={2} sx={{ mb: 4 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="검색 쿼리"
                placeholder="예: 곡성 일정 추천해줘"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleTest()}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="검색 결과 수 (top_k)"
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                inputProps={{ min: 1, max: 10 }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch checked={useLLM} onChange={(e) => setUseLLM(e.target.checked)} />
                }
                label="LLM 정제 사용"
              />
            </Grid>

            <Grid item xs={12}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleTest}
                disabled={loading}
                fullWidth
                size="large"
              >
                {loading ? <CircularProgress size={24} /> : '🚀 테스트 실행'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 에러 표시 */}
      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {/* 결과 표시 */}
      {result && (
        <Box>
          {/* 성능 통계 */}
          <Card elevation={2} sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                ⏱️ 성능 통계
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="textSecondary">
                    검색 시간
                  </Typography>
                  <Typography variant="h6">{result.search_time?.toFixed(2)}s</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="textSecondary">
                    LLM 정제 시간
                  </Typography>
                  <Typography variant="h6">
                    {result.llm_refinement_time ? `${result.llm_refinement_time.toFixed(2)}s` : 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="textSecondary">
                    전체 시간
                  </Typography>
                  <Typography variant="h6">{result.total_time?.toFixed(2)}s</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="textSecondary">
                    검색 결과 수
                  </Typography>
                  <Typography variant="h6">{result.results_count}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* 🆕 유사도 통계 */}
          {result.avg_similarity_score && (
            <Card elevation={2} sx={{ mb: 4 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📊 유사도 통계
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="body2" color="textSecondary">
                      평균 유사도
                    </Typography>
                    <Typography variant="h6">
                      {(result.avg_similarity_score * 100).toFixed(1)}%
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="body2" color="textSecondary">
                      최소 유사도
                    </Typography>
                    <Typography variant="h6">
                      {result.min_similarity_score ? `${(result.min_similarity_score * 100).toFixed(1)}%` : 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="body2" color="textSecondary">
                      최대 유사도
                    </Typography>
                    <Typography variant="h6">
                      {result.max_similarity_score ? `${(result.max_similarity_score * 100).toFixed(1)}%` : 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="body2" color="textSecondary">
                      표준편차
                    </Typography>
                    <Typography variant="h6">
                      {result.similarity_std_dev ? result.similarity_std_dev.toFixed(3) : 'N/A'}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* RAG 검색 결과 */}
          {result.rag_results && result.rag_results.length > 0 && (
            <Card elevation={2} sx={{ mb: 4 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  🔍 RAG 검색 결과
                </Typography>
                {result.rag_results.map((item: any, index: number) => (
                  <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: '#f5f5f5' }}>
                    <Typography variant="subtitle1" gutterBottom>
                      {item.title}
                      <Chip
                        label={`유사도: ${(item.similarity_score * 100).toFixed(1)}%`}
                        size="small"
                        color="primary"
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                    {item.schedules && (
                      <Box mt={1}>
                        {item.schedules.map((schedule: any[], dayIdx: number) => (
                          <Typography key={dayIdx} variant="body2">
                            <strong>Day {dayIdx + 1}:</strong> {schedule.join(' → ')}
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Paper>
                ))}
              </CardContent>
            </Card>
          )}

          {/* LLM 정제 결과 */}
          {result.refined_plan && (
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  ✨ LLM 정제 결과
                </Typography>
                {Object.entries(result.refined_plan).map(([day, places]: [string, any]) => (
                  <Box key={day} mb={2}>
                    <Typography variant="subtitle1" color="primary" gutterBottom>
                      {day.replace('_', ' ').toUpperCase()}
                    </Typography>
                    {places.map((place: any, idx: number) => (
                      <Paper key={idx} sx={{ p: 1.5, mb: 1, bgcolor: '#fafafa' }}>
                        <Typography variant="body2">
                          <strong>{place.time}</strong> - {place.place}
                        </Typography>
                        {place.reason && (
                          <Typography variant="caption" color="textSecondary">
                            💡 {place.reason}
                          </Typography>
                        )}
                      </Paper>
                    ))}
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}
        </Box>
      )}
    </Box>
  );
}
