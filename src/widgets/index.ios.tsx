/**
 * Home screen, Lock Screen and Live Activity layouts. Functions marked 'widget' are
 * turned into strings at build time and run inside the widget extension, so they
 * can only use their arguments and @expo/ui's SwiftUI components and modifiers:
 * no theme imports, no helpers from this file.
 */
import { Gauge, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  monospacedDigit,
  padding,
  tint,
  widgetURL,
  activityBackgroundTint,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, createWidget, type LiveActivity } from 'expo-widgets';
import type { WeekWidgetProps } from '../domain/glance';
import type { WorkoutActivityProps } from './types';

const WeekWidget = createWidget<WeekWidgetProps>('RematchWeek', (props, env) => {
  'widget';
  const lime = '#D6F45B';
  const text = '#F4F4F1';
  const muted = '#A1A1A8';
  const goal = props.goal || 1;
  const count = props.count || 0;
  const met = count >= goal;
  const family = env.widgetFamily;
  const url = widgetURL('rematch:///today');

  if (family === 'accessoryInline') {
    return <Text modifiers={[url]}>{met ? `Week done · ${count}/${goal}` : `${count}/${goal} this week`}</Text>;
  }

  if (family === 'accessoryCircular') {
    return (
      <Gauge value={Math.min(count, goal)} min={0} max={goal} currentValueLabel={<Text>{`${count}`}</Text>} modifiers={[gaugeStyle('circularCapacity'), url]}>
        <Text>{`of ${goal}`}</Text>
      </Gauge>
    );
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[frame({ maxWidth: 10000, alignment: 'leading' }), url]}>
        <Text modifiers={[font({ size: 13, weight: 'bold' })]}>REMATCH</Text>
        <Text modifiers={[font({ size: 13 })]}>{met ? `Week done · ${count} of ${goal}` : `${count} of ${goal} this week`}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
          {props.lastName ? `${props.lastName} · ${props.lastScore}` : 'Race your past self'}
        </Text>
      </VStack>
    );
  }

  const week = (
    <VStack alignment="leading" spacing={6}>
      <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(lime)]}>REMATCH</Text>
      <Spacer />
      <HStack alignment="lastTextBaseline" spacing={2}>
        <Text modifiers={[font({ size: 40, weight: 'bold', design: 'rounded' }), monospacedDigit(), foregroundStyle(text)]}>{`${count}`}</Text>
        <Text modifiers={[font({ size: 17, weight: 'semibold', design: 'rounded' }), foregroundStyle(muted)]}>{`/${goal}`}</Text>
      </HStack>
      <Gauge value={Math.min(count, goal)} min={0} max={goal} modifiers={[gaugeStyle('linearCapacity'), tint(lime)]} />
      <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(muted)]}>
        {met ? 'Weekly goal met' : props.weekStreak > 0 ? `this week · ${props.weekStreak}w streak` : 'this week'}
      </Text>
    </VStack>
  );

  if (family === 'systemSmall') {
    return <VStack modifiers={[frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'leading' }), containerBackground('#09090B', 'widget'), url]}>{week}</VStack>;
  }

  return (
    <HStack spacing={16} modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 }), containerBackground('#09090B', 'widget'), url]}>
      {week}
      <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
        <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(muted)]}>LAST RACE</Text>
        <Spacer />
        {props.lastName ? (
          <VStack alignment="leading" spacing={4}>
            <Text modifiers={[font({ size: 17, weight: 'bold' }), foregroundStyle(props.lastColor || lime)]}>{props.lastName}</Text>
            <HStack spacing={6}>
              <Text modifiers={[font({ size: 22, weight: 'semibold', design: 'rounded' }), monospacedDigit(), foregroundStyle(text)]}>{props.lastScore}</Text>
              {props.lastPb ? <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle('#F3C766')]}>PB</Text> : null}
            </HStack>
            <Text modifiers={[font({ size: 12 }), foregroundStyle(muted)]}>{props.lastWhen}</Text>
          </VStack>
        ) : (
          <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(text)]}>Set your first mark. Your next attempt races it.</Text>
        )}
      </VStack>
    </HStack>
  );
});

const WorkoutActivity = createLiveActivity<WorkoutActivityProps>('RematchWorkout', (props) => {
  'widget';
  const lime = '#D6F45B';
  const text = '#F4F4F1';
  const muted = '#A1A1A8';
  const tone = props.deltaTone === 'ahead' ? lime : props.deltaTone === 'behind' ? '#FF7A59' : muted;
  const clock = (size: number) =>
    props.paused ? (
      <Text modifiers={[font({ size, weight: 'bold', design: 'rounded' }), monospacedDigit(), foregroundStyle(muted)]}>{props.elapsedLabel}</Text>
    ) : (
      <Text date={new Date(props.anchor)} dateStyle="timer" modifiers={[font({ size, weight: 'bold', design: 'rounded' }), monospacedDigit(), foregroundStyle(text)]} />
    );

  return {
    banner: (
      <HStack spacing={12} modifiers={[padding({ all: 16 }), activityBackgroundTint('#09090B')]}>
        <VStack alignment="leading" spacing={3}>
          <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(props.color || lime)]}>{props.name}</Text>
          <Text modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle(text)]}>{props.paused ? 'Paused' : props.step}</Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle(muted)]}>{props.detail}</Text>
        </VStack>
        <Spacer />
        <VStack alignment="trailing" spacing={3}>
          {clock(30)}
          {props.delta ? <Text modifiers={[font({ size: 13, weight: 'semibold' }), monospacedDigit(), foregroundStyle(tone)]}>{props.delta}</Text> : null}
        </VStack>
      </HStack>
    ),
    compactLeading: <Image systemName="figure.highintensity.intervaltraining" color={lime} />,
    compactTrailing: <VStack modifiers={[frame({ maxWidth: 56 })]}>{clock(14)}</VStack>,
    minimal: <Image systemName="figure.highintensity.intervaltraining" color={lime} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 4 })]}>
        <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(props.color || lime)]}>{props.name}</Text>
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(text)]}>{props.paused ? 'Paused' : props.step}</Text>
      </VStack>
    ),
    expandedTrailing: <VStack alignment="trailing" modifiers={[padding({ trailing: 4 })]}>{clock(24)}</VStack>,
    expandedBottom: (
      <HStack modifiers={[padding({ horizontal: 4 })]}>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(muted)]}>{props.detail}</Text>
        <Spacer />
        {props.delta ? <Text modifiers={[font({ size: 13, weight: 'semibold' }), monospacedDigit(), foregroundStyle(tone)]}>{props.delta}</Text> : null}
      </HStack>
    ),
  };
});

export function updateWeekWidget(entries: { date: Date; props: WeekWidgetProps }[]) {
  try {
    WeekWidget.updateTimeline(entries);
  } catch (error) {
    console.warn('[rematch] widget update failed', error);
  }
}

let activity: LiveActivity<WorkoutActivityProps> | null = null;

/** Starts, updates or (with null) ends the workout's Live Activity. */
export async function syncWorkoutActivity(props: WorkoutActivityProps | null) {
  try {
    if (!props) {
      const ending = activity ? [activity] : WorkoutActivity.getInstances();
      activity = null;
      await Promise.all(ending.map((a) => a.end('immediate')));
      return;
    }
    if (activity) {
      await activity.update(props);
      return;
    }
    // A Live Activity left over from a session the app lost track of.
    await Promise.all(WorkoutActivity.getInstances().map((a) => a.end('immediate')));
    activity = WorkoutActivity.start(props, 'rematch:///workout/active');
  } catch (error) {
    // Live Activities switched off in Settings, or unsupported: the workout carries on.
    activity = null;
    console.warn('[rematch] live activity failed', error);
  }
}
