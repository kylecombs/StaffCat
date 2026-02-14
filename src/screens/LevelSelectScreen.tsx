import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { ClefType, LevelDef, LEVELS } from '../data/notes';
import { colors, spacing, fontSizes, borderRadius } from '../utils/theme';

interface LevelSelectScreenProps {
  clef: ClefType | 'grand';
  onSelectLevel: (level: LevelDef) => void;
  onBack: () => void;
}

const clefLabel = (c: ClefType | 'grand') =>
  c === 'treble' ? 'Treble Clef' : c === 'bass' ? 'Bass Clef' : 'Grand Staff';

const LevelSelectScreen: React.FC<LevelSelectScreenProps> = ({
  clef,
  onSelectLevel,
  onBack,
}) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{clefLabel(clef)}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.sectionTitle}>Select a level</Text>

        {LEVELS.map((level) => {
          const speedLabel =
            level.scrollDurationMs >= 9000
              ? 'Slow'
              : level.scrollDurationMs >= 6000
              ? 'Moderate'
              : 'Fast';

          return (
            <TouchableOpacity
              key={level.id}
              style={styles.levelCard}
              onPress={() => onSelectLevel(level)}
              activeOpacity={0.8}
            >
              <View style={styles.levelNumber}>
                <Text style={styles.levelNumberText}>{level.id}</Text>
              </View>
              <View style={styles.levelInfo}>
                <Text style={styles.levelLabel}>{level.label}</Text>
                <Text style={styles.levelDesc}>{level.description}</Text>
              </View>
              <View style={styles.speedBadge}>
                <Text style={styles.speedText}>{speedLabel}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  backButton: {
    padding: spacing.sm,
    width: 60,
  },
  backText: {
    fontSize: fontSizes.md,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: colors.text,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: colors.textLight,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  levelNumber: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelNumberText: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.buttonText,
  },
  levelInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  levelLabel: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  levelDesc: {
    fontSize: fontSizes.sm,
    color: colors.textLight,
    marginTop: 2,
  },
  speedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent + '22',
  },
  speedText: {
    fontSize: fontSizes.sm,
    color: colors.accent,
    fontWeight: '600',
  },
});

export default LevelSelectScreen;
