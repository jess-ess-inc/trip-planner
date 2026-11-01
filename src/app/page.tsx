import type { Metadata } from "next";
import TripPage from "@/components/TripPage";
import { charlestonTrip } from "@/data/charleston";

export const metadata: Metadata = {
  title: `${charlestonTrip.destination} · Trip Planner`,
};

// Milestone 1 renders the Charleston fixture. Trip setup and shared trips replace this later.
export default function Home() {
  return <TripPage trip={charlestonTrip} />;
}
