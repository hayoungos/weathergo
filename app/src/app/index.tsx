// SCR-MAIN-01 홈: 저장된 여행 목록 + 여행 추가
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '@/components/theme';
import { formatMd } from '@/lib/date';
import { sidoShort } from '@/lib/regions';
import { listTrips, type Trip } from '@/lib/trips';

export default function Home() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listTrips()
        .then((t) => {
          setTrips(t);
          setError(false);
        })
        .catch(() => setError(true));
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={trips ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>내 여행</Text>
            <Text style={styles.subtitle}>여행 기간의 날씨를 한눈에 확인하세요</Text>
            {error && <Text style={styles.error}>저장된 여행을 불러오지 못했어요.</Text>}
          </View>
        }
        renderItem={({ item }) => <TripCard trip={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push('/add')}
            accessibilityRole="button"
          >
            <Text style={styles.addText}>+ 여행 추가</Text>
          </Pressable>
        }
      />
    </SafeAreaView>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.cardActive }]}
      onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
      accessibilityRole="button"
    >
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {trip.name}
          </Text>
          {trip.isSample && <Text style={styles.badge}>샘플</Text>}
        </View>
        <Text style={styles.region}>
          {sidoShort(trip.region.sido)} {trip.region.sigungu}
        </Text>
      </View>
      <Text style={styles.period}>
        {formatMd(trip.startDate)}~{formatMd(trip.endDate)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 20, paddingBottom: 48 },
  header: { marginTop: 12, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { marginTop: 4, fontSize: 14, color: colors.sub },
  error: { marginTop: 8, color: colors.danger },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, flexShrink: 1 },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  region: { marginTop: 4, fontSize: 14, color: colors.sub },
  period: { fontSize: 16, fontWeight: '600', color: colors.text, marginLeft: 12 },
  addBtn: {
    alignSelf: 'center',
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  addText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
