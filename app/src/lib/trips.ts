import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Ymd } from './date';
import { sampleTripDates } from './policy';
import { SAMPLE_REGION, type Region } from './regions';

// 여행 정보 저장 (기기 내). 날씨 예보는 저장하지 않고 열 때마다 다시 조회한다.

export type StoredTrip = {
  id: string;
  name: string;
  region: Region; // 식별자·지역명·조회 좌표
  startDate: Ymd;
  endDate: Ymd;
  createdAt: string;
};

/** Sample 여행은 날짜를 저장하지 않고 실행 시점 기준(오늘부터 3일)으로 계산한다. */
type StoredSample = { id: typeof SAMPLE_ID; isSample: true; createdAt: string };

export type Trip = StoredTrip & { isSample?: boolean };

const KEY = 'weather-travel/trips/v1';
const SAMPLE_ID = 'sample';

type StoreShape = { trips: (StoredTrip | StoredSample)[] };

async function read(): Promise<StoreShape> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === null) {
    // 최초 실행: Sample 여행 1개 제공
    const initial: StoreShape = { trips: [{ id: SAMPLE_ID, isSample: true, createdAt: new Date().toISOString() }] };
    await AsyncStorage.setItem(KEY, JSON.stringify(initial));
    return initial;
  }
  const parsed = JSON.parse(raw) as StoreShape;
  return { trips: Array.isArray(parsed?.trips) ? parsed.trips : [] };
}

function resolve(t: StoredTrip | StoredSample, now: Date): Trip {
  if ('isSample' in t && t.isSample) {
    return { id: t.id, name: '강릉 여행', region: SAMPLE_REGION, ...sampleTripDates(now), createdAt: t.createdAt, isSample: true };
  }
  return t as StoredTrip;
}

export async function listTrips(now: Date = new Date()): Promise<Trip[]> {
  const { trips } = await read();
  return trips.map((t) => resolve(t, now));
}

export async function getTrip(id: string, now: Date = new Date()): Promise<Trip | undefined> {
  return (await listTrips(now)).find((t) => t.id === id);
}

/** 저장에 성공했을 때만 목록에 추가된다. 실패 시 예외를 던진다. */
export async function addTrip(input: Omit<StoredTrip, 'id' | 'createdAt'>): Promise<Trip> {
  const store = await read();
  const trip: StoredTrip = {
    ...input,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(KEY, JSON.stringify({ trips: [...store.trips, trip] }));
  return trip;
}
