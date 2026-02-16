import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';
import { colors } from '../utils/theme';

interface NoteHeadProps {
  /** Staff position relative to centre line (0). Even = on a line, odd = in a space. */
  staffPosition: number;
  /** Pixel distance per one staff position step */
  halfSpace: number;
  /** Y coordinate of the centre line (position 0) in the parent */
  staffCentreY: number;
  /** Animated X value controlling horizontal position */
  animX: Animated.Value;
  /** Feedback state */
  feedback: 'none' | 'correct' | 'incorrect';
}

const NOTE_W = 22;
const NOTE_H = 16;

const WholeNote: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={NOTE_W} height={NOTE_H} viewBox="0 0 22 16">
    {/* Outer ellipse */}
    <Ellipse cx="11" cy="8" rx="10" ry="7" fill={color} />
    {/* Inner cutout — tilted ellipse to create the hollow look */}
    <Ellipse
      cx="11"
      cy="8"
      rx="5.5"
      ry="4"
      fill={colors.background}
      rotation="-35"
      origin="11, 8"
    />
  </Svg>
);

const NoteHead: React.FC<NoteHeadProps> = ({
  staffPosition,
  halfSpace,
  staffCentreY,
  animX,
  feedback,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const fadeOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (feedback === 'correct') {
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.6,
          useNativeDriver: true,
          speed: 30,
          bounciness: 12,
        }),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0, duration: 250, useNativeDriver: true }),
          Animated.timing(fadeOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]),
      ]).start();
    } else if (feedback === 'incorrect') {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 80, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.9, duration: 80, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
    }
  }, [feedback, scale, fadeOpacity]);

  const noteColor =
    feedback === 'correct'
      ? colors.correctFlash
      : feedback === 'incorrect'
      ? colors.incorrectFlash
      : colors.noteHead;

  // Y position: higher staff position → higher on screen (lower Y value)
  const noteY = staffCentreY - staffPosition * halfSpace;

  // Determine ledger lines.
  // Staff lines live at even positions: -4, -2, 0, 2, 4.
  // Ledger lines are needed at even positions outside that range, up to the note.
  const ledgerLinePositions: number[] = [];
  if (staffPosition > 4) {
    for (let p = 6; p <= staffPosition; p += 2) {
      ledgerLinePositions.push(p);
    }
  } else if (staffPosition < -4) {
    for (let p = -6; p >= staffPosition; p -= 2) {
      ledgerLinePositions.push(p);
    }
  }

  return (
    <>
      {/* Ledger lines */}
      {ledgerLinePositions.map((lp) => {
        const ly = staffCentreY - lp * halfSpace;
        return (
          <Animated.View
            key={`l${lp}`}
            style={[
              styles.ledgerLine,
              {
                top: ly - 0.75,
                transform: [{ translateX: animX }],
                opacity: fadeOpacity,
              },
            ]}
          />
        );
      })}

      {/* Whole note */}
      <Animated.View
        style={[
          styles.noteHead,
          {
            top: noteY - NOTE_H / 2,
            transform: [{ translateX: animX }, { scale }],
            opacity: fadeOpacity,
          },
        ]}
      >
        <WholeNote color={noteColor} />
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  noteHead: {
    position: 'absolute',
    width: NOTE_W,
    height: NOTE_H,
    left: -NOTE_W / 2,
  },
  ledgerLine: {
    position: 'absolute',
    height: 1.5,
    width: 34,
    backgroundColor: colors.ledgerLine,
    left: -17,
  },
});

export default NoteHead;
