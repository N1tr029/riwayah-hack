import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { buildSeedHistory } from '@/lib/seed';
import { todayKey } from '@/lib/format';
import { DEFAULT_SETTINGS, type AppSettings, type DayRecord } from '@/lib/types';

const RECORDS_KEY = 'brief.records.v1';
const SETTINGS_KEY = 'brief.settings.v1';

interface BriefStore {
  ready: boolean;
  /** All records, sorted ascending by date. */
  records: DayRecord[];
  /** Today's record, if the user has scanned today. */
  today: DayRecord | undefined;
  byDate: (date: string) => DayRecord | undefined;
  saveRecord: (record: DayRecord) => void;
  updateDay: (date: string, patch: Partial<DayRecord>) => void;
  settings: AppSettings;
  setSettings: (patch: Partial<AppSettings>) => void;
  resetAll: () => void;
}

const Ctx = createContext<BriefStore | null>(null);

export function BriefProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    (async () => {
      try {
        const [rawRecords, rawSettings] = await Promise.all([
          AsyncStorage.getItem(RECORDS_KEY),
          AsyncStorage.getItem(SETTINGS_KEY),
        ]);
        if (rawRecords) {
          setRecords(JSON.parse(rawRecords));
        } else {
          const seeded = buildSeedHistory();
          setRecords(seeded);
          AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(seeded));
        }
        if (rawSettings) setSettingsState({ ...DEFAULT_SETTINGS, ...JSON.parse(rawSettings) });
      } catch {
        setRecords(buildSeedHistory());
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

  const setSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    const seeded = buildSeedHistory();
    persist(seeded);
    setSettingsState(DEFAULT_SETTINGS);
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS)).catch(() => {});
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
      settings,
      setSettings,
      resetAll,
    };
  }, [ready, records, settings, saveRecord, updateDay, setSettings, resetAll]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBrief(): BriefStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBrief must be used inside BriefProvider');
  return ctx;
}
