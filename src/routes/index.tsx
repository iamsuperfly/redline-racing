import { createFileRoute } from "@tanstack/react-router";
import { RedlineApp } from "@/components/game/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <RedlineApp />;
}
