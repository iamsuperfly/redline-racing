import { useEffect, useState } from "react";
import { loadSave } from "@/game/save";
import { useGame } from "@/lib/game-store";
import { CarsScreen, GarageScreen, MainMenu, RaceSelect, ResultsScreen, SettingsScreen } from "./menus";
import { PlayView } from "./play";

export function RedlineApp() {
  const screen = useGame((s) => s.screen);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    useGame.setState({ save: loadSave() });
    setHydrated(true);
  }, []);
  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-fg">
        <p className="font-display text-5xl tracking-wide">REDLINE</p>
      </div>
    );
  }
  switch (screen) {
    case "race":
      return <RaceSelect />;
    case "garage":
      return <GarageScreen />;
    case "cars":
      return <CarsScreen />;
    case "settings":
      return <SettingsScreen />;
    case "playing":
      return <PlayView />;
    case "results":
      return <ResultsScreen />;
    default:
      return <MainMenu />;
  }
}
