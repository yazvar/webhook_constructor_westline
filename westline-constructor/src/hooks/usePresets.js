import { useCallback, useEffect, useState } from 'react';
import {
  getAllPresets,
  savePreset as dbSave,
  deletePreset as dbDelete,
  reorderPresets as dbReorder,
} from '../utils/db';
import { buildSamplePresets } from '../utils/samplePresets';
import { uid, createMessage } from '../utils/discord';

const SEED_FLAG = 'westline:seeded';

/**
 * Loads presets from IndexedDB, seeds samples on first run and
 * exposes CRUD helpers. Everything is persisted immediately.
 */
export function usePresets() {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      let list = await getAllPresets();
      const seeded = window.localStorage.getItem(SEED_FLAG) === '1';
      if (list.length === 0 && !seeded) {
        const samples = buildSamplePresets();
        for (const p of samples) await dbSave(p);
        window.localStorage.setItem(SEED_FLAG, '1');
        list = samples;
      }
      if (alive) {
        setPresets(list);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setPresets(await getAllPresets());
  }, []);

  /** Create a preset from a message draft. */
  const create = useCallback(
    async (name, message) => {
      const now = Date.now();
      const preset = {
        id: uid('preset'),
        name: name.trim() || 'Новый пресет',
        order: presets.length,
        createdAt: now,
        updatedAt: now,
        message: { ...createMessage(), ...message },
      };
      await dbSave(preset);
      setPresets((prev) => [...prev, preset]);
      return preset;
    },
    [presets.length]
  );

  /** Overwrite an existing preset's stored message (or rename). */
  const update = useCallback((id, patch) => {
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const merged = { ...p, ...patch, updatedAt: Date.now() };
        dbSave(merged); // fire-and-forget persistence
        return merged;
      })
    );
  }, []);

  const remove = useCallback(async (id) => {
    await dbDelete(id);
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const reorder = useCallback(async (orderedList) => {
    setPresets(orderedList);
    await dbReorder(orderedList);
  }, []);

  return { presets, loading, create, update, remove, reorder, refresh };
}
