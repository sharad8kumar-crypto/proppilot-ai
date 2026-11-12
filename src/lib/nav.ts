import {
  BarChart3,
  Building2,
  CalendarDays,
  Columns3,
  Inbox,
  LayoutDashboard,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string; // full name (command palette)
  shortLabel: string; // compact name (top pill navigation)
  href: string;
  icon: LucideIcon;
  description: string;
};

// Single source of truth: top navigation, mobile menu and command palette read this.
export const navItems: NavItem[] = [
  {
    label: "Command Center",
    shortLabel: "Overview",
    href: "/",
    icon: LayoutDashboard,
    description: "Live KPIs, activity feed and revenue at risk",
  },
  {
    label: "Inbox",
    shortLabel: "Inbox",
    href: "/inbox",
    icon: Inbox,
    description: "AI conversations with every lead",
  },
  {
    label: "Pipeline",
    shortLabel: "Pipeline",
    href: "/pipeline",
    icon: Columns3,
    description: "Kanban board from New to Booked",
  },
  {
    label: "Properties",
    shortLabel: "Properties",
    href: "/properties",
    icon: Building2,
    description: "Inventory, map view and matched leads",
  },
  {
    label: "Calendar",
    shortLabel: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
    description: "Site visits booked by AI and agents",
  },
  {
    label: "Analytics",
    shortLabel: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    description: "Source ROI, agent leaderboard, revenue impact",
  },
  {
    label: "Workflows",
    shortLabel: "Workflows",
    href: "/workflows",
    icon: Workflow,
    description: "Visual automation canvas with test runs",
  },
];