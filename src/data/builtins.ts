import type { Card } from "@/lib/types";

/** "No booking needed" cards every trip gets (curation rule 7). They need no source link. */
export function builtinCards(checkIn: string, checkOut: string): Card[] {
  return [
    { id: "arrive", kind: "do", title: "Arrive & check in", when: "Hotel check-in is usually mid-afternoon", dates: [checkIn], slots: ["morning", "afternoon"], misc: true },
    { id: "depart", kind: "do", title: "Check out & head home", when: "Last day of the trip", dates: [checkOut], slots: ["morning", "afternoon"], misc: true },
    { id: "rest", kind: "do", title: "Down time at the hotel", when: "Nap, read, or nothing at all", slots: ["early", "morning", "afternoon", "evening", "late"], misc: true },
    { id: "hotelbf", kind: "eat", title: "Hotel breakfast", when: "Easy start, no reservation", slots: ["breakfast"], guide: "dining", cats: ["hotel"], area: "Your hotel", cuisine: "Breakfast", stars: ["Zero planning, unhurried start"], misc: true },
    { id: "roomservice", kind: "eat", title: "Room service", when: "If your hotel offers it", slots: ["breakfast", "lunch", "dinner", "late"], guide: "dining", cats: ["hotel"], area: "Your room", cuisine: "Anything, anytime", stars: ["Perfect after a late night out"], con: "Not every hotel offers it, and hours vary", misc: true },
    { id: "wing", kind: "eat", title: "Decide that day", when: "Leave room to wander into somewhere", slots: ["breakfast", "lunch", "dinner"], misc: true },
  ];
}
