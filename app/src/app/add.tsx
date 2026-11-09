// MOD-MAIN-01 여행 추가
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius } from '@/components/theme';
import { formatDayLabel, kstNow, weekday, type Ymd } from '@/lib/date';
import { selectableDates, validateTripDraft, type TripDraftErrors } from '@/lib/policy';
import { searchRegions, sidoShort, type Region } from '@/lib/regions';
import { addTrip } from '@/lib/trips';

export default function AddTrip() {
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<Region | null>(null);
  const [startDate, setStartDate] = useState<Ymd | null>(null);
  const [endDate, setEndDate] = useState<Ymd | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const dates = useMemo(() => selectableDates(), []);
  const results = useMemo(() => (region ? [] : searchRegions(query)), [query, region]);
  const errors: TripDraftErrors = submitted
    ? validateTripDraft({ name, regionId: region?.id ?? null, startDate, endDate })
    : {};

  function pickDate(d: Ymd) {
    if (!startDate || endDate || d <= startDate) {
      setStartDate(d);
      setEndDate(null);
    } else {
      setEndDate(d);
    }
  }

  async function save() {
    setSubmitted(true);
    setSaveError(false);
    const errs = validateTripDraft({ name, regionId: region?.id ?? null, startDate, endDate });
    if (Object.keys(errs).length > 0 || !region || !startDate || !endDate) return;
    setSaving(true);
    try {
      await addTrip({ name: name.trim(), region, startDate, endDate });
      router.back();
    } catch {
      // 저장 실패: 입력 내용을 유지하고 재시도 안내
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} accessibilityLabel="닫기" />
      <View style={styles.sheet}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>여행 추가</Text>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close} accessibilityLabel="저장하지 않고 닫기">
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
          <Section label="어떤 여행인가요?" error={errors.name}>
            <TextInput
              style={styles.input}
              placeholder="여행 이름을 입력하세요."
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              maxLength={30}
              returnKeyType="next"
            />
          </Section>

          <Section label="어디로 떠나시나요?" error={errors.region}>
            {region ? (
              <View style={[styles.input, styles.selected]}>
                <Text style={styles.selectedText}>
                  {region.sigungu}
                  <Text style={styles.selectedSub}>  {region.sido}</Text>
                </Text>
                <Pressable
                  hitSlop={10}
                  onPress={() => {
                    setRegion(null);
                    setQuery('');
                  }}
                  accessibilityLabel="여행지 다시 선택"
                >
                  <Text style={styles.change}>변경</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="여행지를 검색하세요. (시·군·구)"
                  placeholderTextColor={colors.muted}
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                />
                {query.trim() !== '' && (
                  <View style={styles.results}>
                    {results.length === 0 ? (
                      <Text style={styles.noResult}>검색 결과가 없어요.</Text>
                    ) : (
                      results.map((r) => (
                        <Pressable
                          key={r.id}
                          style={({ pressed }) => [styles.resultRow, pressed && { backgroundColor: colors.primarySoft }]}
                          onPress={() => setRegion(r)}
                        >
                          <Text style={styles.resultName}>{r.sigungu}</Text>
                          <Text style={styles.resultSido}>{sidoShort(r.sido)} · {r.sido}</Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                )}
              </>
            )}
          </Section>

          <Section label="언제 가나요?" error={errors.startDate ?? errors.endDate}>
            <View style={styles.dateBoxes}>
              <DateBox label="가는 날" value={startDate} active={!startDate || !!endDate} />
              <DateBox label="오는 날" value={endDate} active={!!startDate && !endDate} />
            </View>
            <View style={styles.days}>
              {dates.map((d) => (
                <DayCell key={d} date={d} start={startDate} end={endDate} onPress={() => pickDate(d)} />
              ))}
            </View>
            <Text style={styles.hint}>예보 제공 범위에 맞춰 오늘부터 4일 뒤까지, 2일 이상 선택할 수 있어요.</Text>
          </Section>
        </ScrollView>

        {saveError && <Text style={styles.saveError}>저장에 실패했어요. 다시 시도해 주세요.</Text>}
        <Pressable
          style={({ pressed }) => [styles.save, (pressed || saving) && { opacity: 0.8 }]}
          onPress={save}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>저장</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Section({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

function DateBox({ label, value, active }: { label: string; value: Ymd | null; active: boolean }) {
  return (
    <View style={[styles.dateBox, active && styles.dateBoxActive]}>
      <Text style={styles.dateBoxLabel}>{label}</Text>
      <Text style={[styles.dateBoxValue, !value && { color: colors.muted }]}>{value ? formatDayLabel(value) : '선택'}</Text>
    </View>
  );
}

function DayCell({ date, start, end, onPress }: { date: Ymd; start: Ymd | null; end: Ymd | null; onPress: () => void }) {
  const isEdge = date === start || date === end;
  const inRange = !!start && !!end && date > start && date < end;
  const isToday = date === kstNow().ymd;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.day, inRange && styles.dayInRange, isEdge && styles.dayEdge]}
      accessibilityRole="button"
      accessibilityState={{ selected: isEdge || inRange }}
    >
      <Text style={[styles.dayWeek, isEdge && { color: '#fff' }]}>{isToday ? '오늘' : weekday(date)}</Text>
      <Text style={[styles.dayNum, isEdge && { color: '#fff' }]}>{Number(date.slice(6, 8))}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 20 },
  sheet: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    padding: 20,
    maxHeight: '92%',
  },
  titleRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  close: { position: 'absolute', right: 0, padding: 4 },
  closeText: { fontSize: 20, color: colors.text },
  section: { backgroundColor: colors.card, borderRadius: radius.md, padding: 16, marginTop: 12 },
  label: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  selected: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primarySoft },
  selectedText: { fontSize: 15, fontWeight: '700', color: colors.text },
  selectedSub: { fontSize: 13, fontWeight: '400', color: colors.sub },
  change: { color: colors.primary, fontWeight: '700' },
  results: { marginTop: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  resultRow: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultName: { fontSize: 15, fontWeight: '600', color: colors.text },
  resultSido: { fontSize: 12, color: colors.sub, marginTop: 2 },
  noResult: { padding: 12, color: colors.sub },
  dateBoxes: { flexDirection: 'row', gap: 8 },
  dateBox: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.sm, padding: 10, borderWidth: 1.5, borderColor: 'transparent' },
  dateBoxActive: { borderColor: colors.primary },
  dateBoxLabel: { fontSize: 12, color: colors.sub },
  dateBoxValue: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 },
  days: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  day: { width: 50, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm, backgroundColor: colors.bg },
  dayInRange: { backgroundColor: colors.primarySoft },
  dayEdge: { backgroundColor: colors.primary },
  dayWeek: { fontSize: 12, color: colors.sub },
  dayNum: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 2 },
  hint: { marginTop: 10, fontSize: 12, color: colors.sub, lineHeight: 17 },
  fieldError: { marginTop: 8, fontSize: 13, color: colors.danger },
  saveError: { marginTop: 12, textAlign: 'center', color: colors.danger },
  save: {
    marginTop: 16,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 40,
    minWidth: 120,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
