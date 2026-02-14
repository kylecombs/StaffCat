import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ClefType, LevelDef } from './src/data/notes';
import HomeScreen from './src/screens/HomeScreen';
import LevelSelectScreen from './src/screens/LevelSelectScreen';
import GameScreen from './src/screens/GameScreen';
import GrandStaffGameScreen from './src/screens/GrandStaffGameScreen';

type Screen =
  | { name: 'home' }
  | { name: 'levelSelect'; clef: ClefType | 'grand' }
  | { name: 'game'; clef: ClefType; level: LevelDef }
  | { name: 'grandGame'; level: LevelDef };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  const renderScreen = () => {
    switch (screen.name) {
      case 'home':
        return (
          <HomeScreen
            onSelectClef={(clef) => setScreen({ name: 'levelSelect', clef })}
          />
        );

      case 'levelSelect':
        return (
          <LevelSelectScreen
            clef={screen.clef}
            onSelectLevel={(level) => {
              if (screen.clef === 'grand') {
                setScreen({ name: 'grandGame', level });
              } else {
                setScreen({ name: 'game', clef: screen.clef, level });
              }
            }}
            onBack={() => setScreen({ name: 'home' })}
          />
        );

      case 'game':
        return (
          <GameScreen
            clef={screen.clef}
            level={screen.level}
            onBack={() =>
              setScreen({ name: 'levelSelect', clef: screen.clef })
            }
          />
        );

      case 'grandGame':
        return (
          <GrandStaffGameScreen
            level={screen.level}
            onBack={() =>
              setScreen({ name: 'levelSelect', clef: 'grand' })
            }
          />
        );
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      {renderScreen()}
    </>
  );
}
