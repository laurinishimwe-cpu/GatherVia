export type DemoGuestStatus = "Pending" | "Approved" | "Arrived" | "Declined";
export type DemoGuestCategory = "VIP" | "Family" | "Friends" | "General";

export interface DemoGuest {
  id: string;
  name: string;
  email: string;
  category: DemoGuestCategory;
  status: DemoGuestStatus;
  partySize: number;
  checkedInAt?: string;
}

export const demoGuests: DemoGuest[] = [
  { id: "g-01", name: "Amara Niyonkuru", email: "amara@example.com", category: "VIP", status: "Arrived", partySize: 2, checkedInAt: "6:14 PM" },
  { id: "g-02", name: "Kofi Mensah", email: "kofi@example.com", category: "Friends", status: "Approved", partySize: 1 },
  { id: "g-03", name: "Lina Moreau", email: "lina@example.com", category: "Family", status: "Arrived", partySize: 3, checkedInAt: "6:22 PM" },
  { id: "g-04", name: "Omar Chen", email: "omar@example.com", category: "General", status: "Pending", partySize: 1 },
  { id: "g-05", name: "Priya Kapoor", email: "priya@example.com", category: "VIP", status: "Approved", partySize: 2 },
  { id: "g-06", name: "Noah Williams", email: "noah@example.com", category: "Friends", status: "Arrived", partySize: 1, checkedInAt: "6:31 PM" },
  { id: "g-07", name: "Amina Diallo", email: "amina@example.com", category: "Family", status: "Approved", partySize: 4 },
  { id: "g-08", name: "Lucas Martin", email: "lucas@example.com", category: "General", status: "Declined", partySize: 1 },
  { id: "g-09", name: "Meera Shah", email: "meera@example.com", category: "Friends", status: "Pending", partySize: 2 },
  { id: "g-10", name: "Daniel Okafor", email: "daniel@example.com", category: "General", status: "Approved", partySize: 1 },
];

export interface DemoTimelinePoint {
  hour: string;
  checkedIn: number;
}

export interface DemoCategoryPoint {
  category: DemoGuestCategory;
  count: number;
}

export interface DemoAnalyticsEvent {
  id: string;
  label: string;
  eventName: string;
  total: number;
  rejected: number;
  timeline: DemoTimelinePoint[];
  categories: DemoCategoryPoint[];
}

export const demoAnalyticsEvents: DemoAnalyticsEvent[] = [
  {
    id: "wedding",
    label: "Wedding",
    eventName: "Amara & Kofi",
    total: 320,
    rejected: 6,
    timeline: [
      { hour: "5:00", checkedIn: 12 },
      { hour: "5:30", checkedIn: 28 },
      { hour: "6:00", checkedIn: 49 },
      { hour: "6:30", checkedIn: 63 },
      { hour: "7:00", checkedIn: 47 },
      { hour: "7:30", checkedIn: 39 },
    ],
    categories: [
      { category: "Family", count: 104 },
      { category: "Friends", count: 96 },
      { category: "VIP", count: 28 },
      { category: "General", count: 92 },
    ],
  },
  {
    id: "conference",
    label: "Conference",
    eventName: "GatherVia Summit",
    total: 500,
    rejected: 9,
    timeline: [
      { hour: "8:00", checkedIn: 34 },
      { hour: "8:30", checkedIn: 79 },
      { hour: "9:00", checkedIn: 126 },
      { hour: "9:30", checkedIn: 94 },
      { hour: "10:00", checkedIn: 61 },
      { hour: "10:30", checkedIn: 38 },
    ],
    categories: [
      { category: "VIP", count: 52 },
      { category: "General", count: 310 },
      { category: "Friends", count: 78 },
      { category: "Family", count: 60 },
    ],
  },
  {
    id: "birthday",
    label: "Birthday",
    eventName: "Nia turns 21",
    total: 140,
    rejected: 3,
    timeline: [
      { hour: "6:00", checkedIn: 8 },
      { hour: "6:30", checkedIn: 17 },
      { hour: "7:00", checkedIn: 26 },
      { hour: "7:30", checkedIn: 31 },
      { hour: "8:00", checkedIn: 22 },
      { hour: "8:30", checkedIn: 14 },
    ],
    categories: [
      { category: "Family", count: 38 },
      { category: "Friends", count: 64 },
      { category: "VIP", count: 12 },
      { category: "General", count: 26 },
    ],
  },
];
