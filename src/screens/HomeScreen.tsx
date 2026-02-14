import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { ClefType } from '../data/notes';
import { colors, spacing, fontSizes, borderRadius } from '../utils/theme';

interface HomeScreenProps {
  onSelectClef: (clef: ClefType | 'grand') => void;
}

const CLEF_OPTIONS: { key: ClefType | 'grand'; label: string; symbol: string; desc: string }[] = [
  { key: 'treble', label: 'Treble Clef', symbol: '𝄞', desc: 'Right hand / higher notes' },
  { key: 'bass', label: 'Bass Clef', symbol: '𝄢', desc: 'Left hand / lower notes' },
  { key: 'grand', label: 'Grand Staff', symbol: '𝄞𝄢', desc: 'Both clefs together' },
];

const HomeScreen: React.FC<HomeScreenProps> = ({ onSelectClef }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Title */}
        <View style={styles.titleArea}>
          <Text style={styles.title}>StaffCat</Text>
          <Text style={styles.subtitle}>Learn to read music notation</Text>
        </View>

        {/* Clef selection */}
        <Text style={styles.sectionTitle}>Choose your clef</Text>

        <View style={styles.cardsContainer}>
          {CLEF_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={styles.card}
              onPress={() => onSelectClef(opt.key)}
              activeOpacity={0.8}
            >
              <Text style={styles.cardSymbol}>{opt.symbol}</Text>
              <View style={styles.cardText}>
                <Text style={styles.cardLabel}>{opt.label}</Text>
                <Text style={styles.cardDesc}>{opt.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  titleArea: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: fontSizes.title,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: fontSizes.md,
    color: colors.textLight,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  cardsContainer: {
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardSymbol: {
    fontSize: 40,
    width: 60,
    textAlign: 'center',
    color: colors.clef,
  },
  cardText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  cardLabel: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  cardDesc: {
    fontSize: fontSizes.sm,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
});

export default HomeScreen;
