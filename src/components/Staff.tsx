import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { colors } from '../utils/theme';
import { ClefType } from '../data/notes';

/**
 * Renders 5 staff lines with a clef symbol on the left.
 *
 * `halfSpace` = pixel distance per staff position (1 step = line to space).
 * Staff lines are at positions -4, -2, 0, 2, 4 (every other position).
 * Total staff height (top line to bottom line) = 8 * halfSpace.
 *
 * The container has extra vertical padding so notes on ledger lines are visible.
 */

interface StaffProps {
  clef: ClefType;
  /** Pixel distance per one staff position */
  halfSpace: number;
  /** Total height of the rendering area */
  containerHeight: number;
  children?: React.ReactNode;
}

export const STAFF_LEFT_MARGIN = 56;

/** Staff line positions (bottom to top in musical terms, but since Y goes down,
 *  position -4 is the bottom line rendered lower on screen) */
const LINE_POSITIONS = [4, 2, 0, -2, -4]; // top line to bottom line on screen

const Staff: React.FC<StaffProps> = ({ clef, halfSpace, containerHeight, children }) => {
  const centreY = containerHeight / 2;

  return (
    <View style={[styles.container, { height: containerHeight }]}>
      {/* Staff lines */}
      {LINE_POSITIONS.map((pos) => (
        <View
          key={pos}
          style={[
            styles.staffLine,
            {
              top: centreY - pos * halfSpace - 0.75,
            },
          ]}
        />
      ))}

      {/* Clef symbol — overlaid on top of the staff lines */}
      <View style={[styles.clefContainer, { height: containerHeight }]}>
        <Text
          style={[
            styles.clefText,
            clef === 'treble' ? styles.trebleClef : styles.bassClef,
          ]}
        >
          {clef === 'treble' ? '𝄞' : '𝄢'}
        </Text>
      </View>

      {/* Notes layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'visible',
  },
  staffLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: colors.staffLine,
  },
  clefContainer: {
    position: 'absolute',
    left: 6,
    top: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  clefText: {
    color: colors.clef,
  },
  trebleClef: {
    fontSize: 88,
    marginTop: -4,
  },
  bassClef: {
    fontSize: 72,
    marginTop: -6,
  },
});

export default Staff;
