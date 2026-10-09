import React from 'react';
import { ExerciseAnimation } from './ExerciseAnimation';

interface ExerciseVisualProps {
  exerciseId: string;
  category?: string;
  size?: number;
  playing?: boolean;
  color?: string;
}

/** Exercise demonstration. Kept for older imports; renders the animated figure. */
export function ExerciseVisual({ exerciseId, category, size = 160, playing = true, color }: ExerciseVisualProps) {
  return <ExerciseAnimation exerciseId={exerciseId} category={category} size={size} playing={playing} color={color} />;
}
