import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import api from '../../services/api';

interface RAGResult {
  title: string;
  similarity_score: number;
  schedules: string[][];
  video_id?: string;
  channel?: string;
  location?: string;
  places?: Array<{
    name: string;
    type: string;
    description: string;
    order: number;
  }>;
  summary?: string;
}

interface LLMRefinedPlan {
  [key: string]: {
    place: string;
    time: string;
    reason: string;
  }[];
}

const RAGTester: React.FC = () => {
  const [query, setQuery] = useState('서울 맛집');
  const [topK, setTopK] = useState(3);
  const [loading, setLoading] = useState(false);
  const [ragResults, setRagResults] = useState<RAGResult[]>([]);
  const [llmRefined, setLlmRefined] = useState<LLMRefinedPlan | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0); // 0: 초기, 1: RAG 검색 완료, 2: LLM 정제 완료

  const handleRAGSearch = async () => {
    setLoading(true);
    setError('');
    setStep(0);
    setRagResults([]);
    setLlmRefined(null);

    try {
      // RAG 검색 API 호출
      const response = await api.post('/api/chat/test/', {
        query: query,
        top_k: topK,
      });

      // 실제 RAG 결과 사용
      const results = response.data.results || [];

      if (results.length === 0) {
        setError('검색 결과가 없습니다');
        return;
      }

      // 결과 포맷 변환 - 모든 데이터 포함
      const formattedResults = results.map((r: any) => ({
        title: r.title,
        similarity_score: r.similarity_score || 0,
        schedules: r.schedules || [],
        channel: r.channel || 'Unknown',
        location: r.location || r.city || 'Unknown',
        url: r.url || '',
        views: r.views || 0,
        summary: r.summary || '',  // 요약 추가
        places: r.places || [],  // 장소 목록 추가
        parsed_itinerary: r.parsed_itinerary || {},  // 전체 파싱 데이터 추가
        raw_content_preview: r.raw_content_preview || '',  // 원문 미리보기 추가
      }));

      setRagResults(formattedResults);
      setStep(1);
    } catch (err: any) {
      setError(err.response?.data?.error || '검색 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleLLMRefine = async () => {
    setLoading(true);
    setError('');

    try {
      // RAG 검색 결과에서 실제 장소 데이터 추출
      const allPlaces: any[] = [];

      ragResults.forEach((result: any) => {
        if (result.places && Array.isArray(result.places)) {
          result.places.forEach((place: any) => {
            allPlaces.push({
              name: place.name,
              type: place.type,
              description: place.description || '',
              source: result.title.substring(0, 30) + '...'
            });
          });
        }
      });

      // 장소 타입별로 분류
      const meals = allPlaces.filter(p => p.type === 'meal');
      const activities = allPlaces.filter(p => p.type === 'activity' || p.type === 'place');
      const accommodations = allPlaces.filter(p => p.type === 'accommodation');

      // 3일 일정으로 합리적으로 분배
      const totalDays = 3;
      const refinedPlan: any = {};

      for (let day = 1; day <= totalDays; day++) {
        const daySchedule: any[] = [];

        // 아침 식사 (09:00)
        if (meals.length > 0) {
          const breakfast = meals.shift();
          daySchedule.push({
            place: breakfast!.name,
            time: '09:00',
            reason: `아침 식사`,
            type: breakfast!.type,
            description: breakfast!.description,
            source: breakfast!.source
          });
        }

        // 오전 활동 (11:00)
        if (activities.length > 0) {
          const morning = activities.shift();
          daySchedule.push({
            place: morning!.name,
            time: '11:00',
            reason: `오전 관광`,
            type: morning!.type,
            description: morning!.description,
            source: morning!.source
          });
        }

        // 점심 식사 (13:00)
        if (meals.length > 0) {
          const lunch = meals.shift();
          daySchedule.push({
            place: lunch!.name,
            time: '13:00',
            reason: `점심 식사`,
            type: lunch!.type,
            description: lunch!.description,
            source: lunch!.source
          });
        }

        // 오후 활동 (15:00)
        if (activities.length > 0) {
          const afternoon = activities.shift();
          daySchedule.push({
            place: afternoon!.name,
            time: '15:00',
            reason: `오후 관광`,
            type: afternoon!.type,
            description: afternoon!.description,
            source: afternoon!.source
          });
        }

        // 저녁 식사 (18:00)
        if (meals.length > 0) {
          const dinner = meals.shift();
          daySchedule.push({
            place: dinner!.name,
            time: '18:00',
            reason: `저녁 식사`,
            type: dinner!.type,
            description: dinner!.description,
            source: dinner!.source
          });
        }

        // 마지막 날에만 숙박 추가
        if (day < totalDays && accommodations.length > 0) {
          const hotel = accommodations.shift();
          daySchedule.push({
            place: hotel!.name,
            time: '20:00',
            reason: `숙박`,
            type: hotel!.type,
            description: hotel!.description,
            source: hotel!.source
          });
        }

        refinedPlan[`day_${day}`] = daySchedule;
      }

      if (Object.keys(refinedPlan).length === 0) {
        setError('추출된 장소 데이터가 없습니다');
        return;
      }

      setLlmRefined(refinedPlan);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.error || '정제 실패');
    } finally {
      setLoading(false);
    }
  };


  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        🚀 RAG Auto-Add 테스트 대시보드
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        RAG 검색 → LLM 정제 프로세스를 단계별로 확인할 수 있습니다. 각 장소의 출처와 근거를 분석적으로 검토하세요.
      </Alert>

      {/* 검색 입력 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            1️⃣ 검색 쿼리 입력
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="검색 쿼리"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="예: 서울 맛집, 제주도 자연, 부산 핫플"
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="number"
                label="검색 결과 수"
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                inputProps={{ min: 1, max: 10 }}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={handleRAGSearch}
                disabled={loading || !query}
                startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
                sx={{ height: '56px' }}
              >
                RAG 검색
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* RAG 검색 결과 */}
      {step >= 1 && ragResults.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon color="success" />
              2️⃣ RAG 검색 결과 ({ragResults.length}개)
            </Typography>
            <Divider sx={{ my: 2 }} />

            {ragResults.map((result, idx) => (
              <Accordion key={idx}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                    <Chip label={`#${idx + 1}`} color="primary" size="small" />
                    <Typography sx={{ flexGrow: 1 }}>{result.title}</Typography>
                    <Chip
                      label={`유사도: ${(result.similarity_score * 100).toFixed(0)}%`}
                      color={result.similarity_score > 0.8 ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {/* 요약 */}
                  {(result as any).summary && (
                    <Box sx={{ mb: 2, p: 1.5, bgcolor: 'info.lighter', borderRadius: 1 }}>
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                        📝 여행 요약
                      </Typography>
                      <Typography variant="body2">
                        {(result as any).summary}
                      </Typography>
                    </Box>
                  )}

                  {/* 장소 목록 */}
                  {(result as any).places && (result as any).places.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                        📍 방문 장소 ({(result as any).places.length}개)
                      </Typography>
                      {(result as any).places.slice(0, 8).map((place: any, placeIdx: number) => (
                        <Box key={placeIdx} sx={{ ml: 2, mb: 0.5 }}>
                          <Typography variant="body2">
                            <strong>{placeIdx + 1}. {place.name}</strong>
                            <Chip label={place.type} size="small" sx={{ ml: 1, height: 20 }} />
                            {place.description && (
                              <Typography variant="caption" display="block" sx={{ ml: 2, color: 'text.secondary' }}>
                                {place.description}
                              </Typography>
                            )}
                          </Typography>
                        </Box>
                      ))}
                      {(result as any).places.length > 8 && (
                        <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
                          ... 외 {(result as any).places.length - 8}개 장소
                        </Typography>
                      )}
                    </Box>
                  )}

                  {/* 메타데이터 */}
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {result.channel && (
                      <Typography variant="body2">
                        📺 {result.channel}
                      </Typography>
                    )}
                    {result.location && (
                      <Typography variant="body2">
                        📍 {result.location}
                      </Typography>
                    )}
                    {(result as any).views && (
                      <Typography variant="body2">
                        👁️ {(result as any).views.toLocaleString()} views
                      </Typography>
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleLLMRefine}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <PlayArrowIcon />}
              >
                다음: LLM 정제
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* LLM 정제 결과 */}
      {step >= 2 && llmRefined && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon color="success" />
              3️⃣ LLM 정제 결과
            </Typography>
            <Divider sx={{ my: 2 }} />

            <Alert severity="success" sx={{ mb: 2 }}>
              ✅ RAG 검색 결과를 3일 일정에 맞게 최적화했습니다. 각 장소의 출처와 근거를 확인할 수 있습니다.
            </Alert>

            {Object.entries(llmRefined).map(([dayKey, places]) => (
              <Paper key={dayKey} sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary">
                  {dayKey.replace('_', ' ').toUpperCase()}
                </Typography>
                {places.map((place: any, idx: number) => (
                  <Box key={idx} sx={{ ml: 2, mb: 2, pb: 2, borderBottom: idx < places.length - 1 ? '1px solid #e0e0e0' : 'none' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {place.time}
                      </Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {place.place}
                      </Typography>
                      <Chip label={place.type || 'unknown'} size="small" color="primary" variant="outlined" />
                    </Box>

                    <Typography variant="caption" color="text.secondary" sx={{ ml: 6, display: 'block', mb: 0.5 }}>
                      🎯 {place.reason}
                    </Typography>

                    {place.description && (
                      <Typography variant="caption" sx={{ ml: 6, display: 'block', mb: 0.5, color: 'success.main' }}>
                        📝 {place.description}
                      </Typography>
                    )}

                    {place.source && (
                      <Typography variant="caption" sx={{ ml: 6, display: 'block', fontStyle: 'italic', color: 'text.disabled' }}>
                        📺 출처: {place.source}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Paper>
            ))}

            <Alert severity="info" sx={{ mt: 2 }}>
              💡 실제 사용자가 챗봇에서 "{query}"를 요청하면, 위 일정이 자동으로 플래너에 추가됩니다.
            </Alert>
          </CardContent>
        </Card>
      )}


      {/* 에러 메시지 */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default RAGTester;
