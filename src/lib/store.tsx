import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { FrontCameraScanResult } from '@/lib/face';
import { todayKey } from '@/lib/format';
import { DEFAULT_SETTINGS, type AppSettings, type DayRecord } from '@/lib/types';
import type { WorkoutSession } from '@/lib/workout';

// v2 intentionally starts clean. v1 contained generated demo history.
const RECORDS_KEY = 'brief.records.v2';
const SETTINGS_KEY = 'brief.settings.v1';
const WORKOUTS_KEY = 'brief.workouts.v1';
const FACE_KEY = 'brief.face.v1';

interface BriefStore {
  ready: boolean;
  /** All records, sorted ascending by date. */
  records: DayRecord[];
  /** Today's record, if the user has scanned today. */
  today: DayRecord | undefined;
  byDate: (date: string) => DayRecord | undefined;
  saveRecord: (record: DayRecord) => void;
  updateDay: (date: string, patch: Partial<DayRecord>) => void;
  workouts: WorkoutSession[];
  addWorkout: (workout: WorkoutSession) => void;
  updateWorkout: (id: string, patch: Partial<WorkoutSession>) => void;
  faceScans: FrontCameraScanResult[];
  addFaceScan: (scan: FrontCameraScanResult) => void;
  settings: AppSettings;
  setSettings: (patch: Partial<AppSettings>) => void;
  resetAll: () => void;
}

const Ctx = createContext<BriefStore | null>(null);

export function BriefProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [faceScans, setFaceScans] = useState<FrontCameraScanResult[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    (async () => {
      try {
        const [rawRecords, rawSettings, rawWorkouts, rawFace] = await Promise.all([
          AsyncStorage.getItem(RECORDS_KEY),
          AsyncStorage.getItem(SETTINGS_KEY),
          AsyncStorage.getItem(WORKOUTS_KEY),
          AsyncStorage.getItem(FACE_KEY),
        ]);
        if (rawRecords) {
          setRecords(JSON.parse(rawRecords));
        } else {
          setRecords([]);
        }
        if (rawSettings) setSettingsState({ ...DEFAULT_SETTINGS, ...JSON.parse(rawSettings) });
        if (rawWorkouts) setWorkouts(JSON.parse(rawWorkouts));
        if (rawFace) setFaceScans(JSON.parse(rawFace));
      } catch {
        setRecords([]);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback((next: DayRecord[]) => {
    setRecords(next);
    AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const saveRecord = useCallback(
    (record: DayRecord) => {
      setRecords((prev) => {
        const next = [...prev.filter((r) => r.date !== record.date), record].sort((a, b) =>
          a.date.localeCompare(b.date)
        );
        AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  const updateDay = useCallback((date: string, patch: Partial<DayRecord>) => {
    setRecords((prev) => {
      const next = prev.map((r) => (r.date === date ? { ...r, ...patch } : r));
      AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const addWorkout = useCallback((workout: WorkoutSession) => {
    setWorkouts((prev) => {
      const next = [...prev, workout];
      AsyncStorage.setItem(WORKOUTS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const updateWorkout = useCallback((id: string, patch: Partial<WorkoutSession>) => {
    setWorkouts((prev) => {
      const next = prev.map((w) => (w.id === id ? { ...w, ...patch } : w));
      AsyncStorage.setItem(WORKOUTS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const addFaceScan = useCallback((scan: FrontCameraScanResult) => {
    setFaceScans((prev) => {
      const next = [...prev.filter((s) => s.date !== scan.date), scan];
      AsyncStorage.setItem(FACE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    persist([]);
    setWorkouts([]);
    setFaceScans([]);
    setSettingsState(DEFAULT_SETTINGS);
    AsyncStorage.multiSet([
      [SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS)],
      [WORKOUTS_KEY, JSON.stringify([])],
      [FACE_KEY, JSON.stringify([])],
    ]).catch(() => {});
  }, [persist]);

  const value = useMemo<BriefStore>(() => {
    const tk = todayKey();
    return {
      ready,
      records,
      today: records.find((r) => r.date === tk),
      byDate: (date) => records.find((r) => r.date === date),
      saveRecord,
      updateDay,
      workouts,
      addWorkout,
      updateWorkout,
      faceScans,
      addFaceScan,
      settings,
      setSettings,
      resetAll,
    };
  }, [ready, records, workouts, faceScans, settings, saveRecord, updateDay, addWorkout, updateWorkout, addFaceScan, setSettings, resetAll]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBrief(): BriefStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBrief must be used inside BriefProvider');
  return ctx;
}
