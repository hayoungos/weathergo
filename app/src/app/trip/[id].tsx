// SCR-MAIN-02 여행 기간별 날씨 (+ 날짜별 아코디언 상세)
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Pressable,
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fmtCondition, fmtPop, fmtTemp, NA } from '@/components/format';
import { colors, radius } from '@/components/theme';
import { WeatherIcon } from '@/components/WeatherIcon';
import { dateRange, formatDayLabel, formatHhmm, formatHourLabel, formatMd, formatYmdDots, kstNow, type Ymd } from '@/lib/date';
import { getTrip, type Trip } from '@/lib/trips';
import { loadTripWeather, WeatherApiError } from '@/lib/weather/api';
import { hourlySlots, isEmptyHour, pickHero } from '@/lib/weather/process';
import type { DayForecast, TripWeather } from '@/lib/weather/types';

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; weather: TripWeather }
  | { status: 'failed'; message: string };

export default function TripWeatherScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [openDate, setOpenDate] = useState<Ymd | null>(null);

  const load = useCallback(async (t: Trip) => {
    try {
      const weather = await loadTripWeather({ nx: t.region.nx, ny: t.region.ny, startDate: t.startDate, endDate: t.endDate });
      setState({ status: 'ok', weather });
    } catch (e) {
      const message = e instanceof WeatherApiError ? e.message : '알 수 없는 오류가 발생했어요.';
      setState({ status: 'failed', message });
    }
  }, []);

  // 화면을 열 때마다 다시 조회 (캐시 없음)
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getTrip(String(id))
        .then((t) => {
          if (!alive) return;
          setTrip(t ?? null);
          if (t) {
            setState({ status: 'loading' });
            load(t);
          }
        })
        .catch(() => alive && setTrip(null));
      return () => {
        alive = false;
      };
    }, [id, load]),
  );

  const onRefresh = useCallback(async () => {
    if (!trip) return;
    setRefreshing(true);
    await load(trip);
    setRefreshing(false);
  }, [trip, load]);

  if (trip === undefined) {
    return <Centered><ActivityIndicator /></Centered>;
  }
  if (trip === null) {
    return (
      <Centered>
        <Text style={styles.sub}>여행 정보를 찾을 수 없어요.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={styles.link}>돌아가기</Text>
        </Pressable>
      </Centered>
    );
  }

  const now = kstNow();
  const weather = state.status === 'ok' ? state.weather : null;
  const dates = dateRange(trip.startDate, trip.endDate);
  const dayMap = new Map(weather?.days.map((d) => [d.date, d]));
  const hero = pickHero(weather, trip.startDate, trip.endDate, now);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityLabel="뒤로">
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{trip.region.sigungu}</Text>
        <Text style={styles.headerSub}>
          {trip.name} · {formatMd(trip.startDate)} ~ {formatMd(trip.endDate)}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* 상단: 기본은 여행 첫날 낮 12시, 여행 중이면 오늘 기준 */}
        <View style={styles.hero}>
          {state.status === 'loading' ? (
            <ActivityIndicator style={{ height: 150 }} />
          ) : (
            <>
              <Text style={styles.heroTemp}>{state.status === 'failed' ? '—' : fmtTemp(hero.hour?.tmp ?? null)}</Text>
              <WeatherIcon condition={hero.hour?.condition ?? null} size={120} />
              <Text style={styles.heroDate}>{formatDayLabel(hero.date)}</Text>
              <Text style={styles.heroBasis}>
                {state.status === 'failed'
                  ? '조회 실패'
                  : hero.hour
                    ? `${fmtCondition(hero.hour.condition)} · ${hero.basis === 'now' ? `오늘 ${formatHourLabel(hero.hour.time)} 예보` : '낮 12시 기준'}`
                    : hero.basis === 'now'
                      ? '오늘 남은 시각 예보 미제공'
                      : '낮 12시 예보 미제공'}
              </Text>
            </>
          )}
        </View>

        {state.status === 'failed' && (
          <View style={styles.failBox}>
            <Text style={styles.failTitle}>날씨 조회에 실패했어요</Text>
            <Text style={styles.failMsg}>{state.message}</Text>
            <Pressable
              style={styles.retry}
              onPress={() => {
                setState({ status: 'loading' });
                load(trip);
              }}
            >
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.listHead}>
          <Text style={styles.listTitle}>날짜별 날씨</Text>
          <Text style={styles.listNote}>기온·강수확률은 낮 12시 기준</Text>
        </View>

        {dates.map((date) => (
          <DayRow
            key={date}
            date={date}
            day={dayMap.get(date)}
            state={state.status}
            isToday={date === now.ymd}
            nowHour={now.hour}
            open={openDate === date}
            onToggle={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setOpenDate((cur) => (cur === date ? null : date));
            }}
          />
        ))}

        {weather && (
          <Text style={styles.meta}>
            예보 발표 {formatYmdDots(weather.baseDate)} {formatHhmm(weather.baseTime)} · 조회{' '}
            {formatHhmm(kstHhmm(new Date(weather.fetchedAt)))}
          </Text>
        )}
        {weather && weather.days.some((d) => !d.hasForecast) && (
          <Text style={styles.meta}>단기예보는 오늘부터 약 4일 뒤까지만 제공돼요.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function kstHhmm(d: Date) {
  const { hour, minute } = kstNow(d);
  return `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
}

function DayRow({
  date,
  day,
  state,
  isToday,
  nowHour,
  open,
  onToggle,
}: {
  date: Ymd;
  day: DayForecast | undefined;
  state: LoadState['status'];
  isToday: boolean;
  nowHour: number;
  open: boolean;
  onToggle: () => void;
}) {
  const noon = day?.noon ?? null;
  let right: React.ReactNode;
  if (state === 'loading') right = <ActivityIndicator />;
  else if (state === 'failed') right = <Text style={styles.naText}>조회 실패</Text>;
  else if (!day?.hasForecast) right = <Text style={styles.naText}>{NA}</Text>;
  else if (!noon)
    // 낮 12시 값만 없는 경우 (예: 오늘 12시가 지난 뒤 발표분). 시간대별 상세는 열 수 있다.
    right = (
      <View style={styles.rowRight}>
        <WeatherIcon condition={null} size={36} />
        <View style={styles.rowNums}>
          <Text style={styles.naText}>낮 12시</Text>
          <Text style={styles.naText}>{NA}</Text>
        </View>
      </View>
    );
  else
    right = (
      <View style={styles.rowRight}>
        <WeatherIcon condition={noon?.condition ?? null} size={36} />
        <View style={styles.rowNums}>
          <Text style={[styles.rowTemp, noon?.tmp == null && styles.naSmall]}>{fmtTemp(noon?.tmp ?? null)}</Text>
          <Text style={styles.rowPop}>강수 {fmtPop(noon?.pop ?? null)}</Text>
        </View>
      </View>
    );

  const expandable = state === 'ok';
  return (
    <View style={[styles.row, open && styles.rowOpen]}>
      <Pressable
        onPress={expandable ? onToggle : undefined}
        style={styles.rowMain}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View>
          <Text style={styles.rowDate}>{formatDayLabel(date)}</Text>
          {isToday && <Text style={styles.today}>오늘</Text>}
        </View>
        {right}
      </Pressable>
      {open && day && <DayDetail day={day} isToday={isToday} nowHour={nowHour} />}
    </View>
  );
}

function DayDetail({ day, isToday, nowHour }: { day: DayForecast; isToday: boolean; nowHour: number }) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const slots = hourlySlots(day);
  const SLOT_W = 60;

  // 오늘이면 현재 시각, 아니면 첫 예보 시각 근처로 스크롤
  useEffect(() => {
    const firstIdx = slots.findIndex((s) => !isEmptyHour(s));
    const target = isToday ? nowHour : Math.max(firstIdx, 0);
    const t = setTimeout(() => scrollRef.current?.scrollTo({ x: Math.max(target - 1, 0) * SLOT_W, animated: false }), 0);
    return () => clearTimeout(t);
  }, [day.date]);

  const noon = day.noon;
  return (
    <View style={styles.detail}>
      <Text style={styles.detailSummary}>
        낮 12시 {noon?.condition ? fmtCondition(noon.condition) : '미제공'}
        {'  ·  '}최저 {day.tmn === null ? '미제공' : fmtTemp(day.tmn)} / 최고 {day.tmx === null ? '미제공' : fmtTemp(day.tmx)}
      </Text>
      <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slots}>
        {slots.map((h, i) => {
          const empty = isEmptyHour(h);
          const past = isToday && i < nowHour;
          return (
            <View key={h.time} style={[styles.slot, { width: SLOT_W }, past && { opacity: 0.45 }, isToday && i === nowHour && styles.slotNow]}>
              <Text style={styles.slotHour}>{formatHourLabel(h.time)}</Text>
              {empty ? (
                <Text style={styles.slotNa}>예보{'\n'}미제공</Text>
              ) : (
                <>
                  <WeatherIcon condition={h.condition} size={32} />
                  <Text style={styles.slotTemp}>{h.tmp === null ? '-' : `${Math.round(h.tmp)}℃`}</Text>
                  <Text style={styles.slotPop}>{h.pop === null ? '-' : `${h.pop}%`}</Text>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
      <Text style={styles.detailNote}>시간대별 기온 · 강수확률 ( - : 해당 항목 예보 미제공)</Text>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>{children}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  sub: { color: colors.sub },
  link: { color: colors.primary, fontWeight: '700' },
  header: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  back: { position: 'absolute', left: 16, top: 2, padding: 4 },
  backText: { fontSize: 36, lineHeight: 38, color: colors.text },
  headerTitle: { fontSize: 26, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 13, color: colors.sub, marginTop: 2 },
  content: { padding: 20, paddingBottom: 48 },
  hero: { alignItems: 'center', paddingVertical: 12 },
  heroTemp: { fontSize: 30, fontWeight: '700', color: colors.text, marginBottom: 4 },
  heroDate: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 6 },
  heroBasis: { fontSize: 13, color: colors.sub, marginTop: 4 },
  failBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: 16, marginTop: 8, alignItems: 'center' },
  failTitle: { fontWeight: '700', color: colors.danger },
  failMsg: { marginTop: 4, fontSize: 13, color: colors.sub, textAlign: 'center' },
  retry: { marginTop: 10, backgroundColor: colors.danger, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { color: '#fff', fontWeight: '700' },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 20, marginBottom: 10 },
  listTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  listNote: { fontSize: 12, color: colors.sub },
  row: { backgroundColor: colors.card, borderRadius: radius.md, marginBottom: 10, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  rowOpen: { borderColor: colors.primary },
  rowMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, minHeight: 68 },
  rowDate: { fontSize: 18, fontWeight: '800', color: colors.text },
  today: { fontSize: 11, color: colors.primary, fontWeight: '700', marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowNums: { alignItems: 'flex-end', minWidth: 74 },
  rowTemp: { fontSize: 20, fontWeight: '700', color: colors.text },
  rowPop: { fontSize: 12, color: colors.rain, marginTop: 2 },
  naText: { fontSize: 14, color: colors.muted },
  naSmall: { fontSize: 13, color: colors.muted, fontWeight: '400' },
  detail: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 14 },
  detailSummary: { textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.text },
  slots: { paddingHorizontal: 10, paddingTop: 12 },
  slot: { alignItems: 'center', paddingVertical: 6, borderRadius: radius.sm },
  slotNow: { backgroundColor: colors.primarySoft },
  slotHour: { fontSize: 12, color: colors.sub, marginBottom: 4 },
  slotTemp: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 4 },
  slotPop: { fontSize: 11, color: colors.rain, marginTop: 2 },
  slotNa: { fontSize: 10, color: colors.muted, textAlign: 'center', marginTop: 10, lineHeight: 14 },
  detailNote: { marginTop: 8, fontSize: 11, color: colors.muted, textAlign: 'center' },
  meta: { marginTop: 10, fontSize: 12, color: colors.muted, textAlign: 'center' },
});
