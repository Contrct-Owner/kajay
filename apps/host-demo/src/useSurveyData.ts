import type { Survey } from '@kajay/core';
import { useEffect, useState } from 'react';

/**
 * Mirrors the model's answer map into React state.
 *
 * The host does this itself, through the public event surface, exactly as a real
 * consumer would — the demo must not reach past the published API to observe state.
 */
export function useSurveyData(model: Survey): Readonly<Record<string, unknown>> {
  const [data, setData] = useState<Readonly<Record<string, unknown>>>(() => model.data);
  useEffect(() => model.onValueChanged.add(() => {
    setData(model.data);
  }), [model]);
  return data;
}
