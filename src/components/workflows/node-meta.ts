import {
  Bell,
  Building2,
  CalendarCheck,
  Clock,
  FileText,
  Gauge,
  GitBranch,
  MessageSquare,
  Play,
  Repeat,
  Sparkles,
  UserCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { NodeKind } from "@/lib/workflow";

// Icon and colour for each kind of node (full class names so Tailwind finds them)
export const KIND_META: Record<NodeKind, { icon: LucideIcon; tone: string }> = {
  trigger: { icon: Zap, tone: "bg-violet/10 text-violet" },
  manual: { icon: Play, tone: "bg-violet/10 text-violet" },
  ai: { icon: Sparkles, tone: "bg-primary text-primary-foreground" },
  score: { icon: Gauge, tone: "bg-info/10 text-info" },
  branch: { icon: GitBranch, tone: "bg-orange/10 text-orange" },
  alert: { icon: Bell, tone: "bg-danger/10 text-danger" },
  assign: { icon: UserCheck, tone: "bg-success/10 text-success" },
  visit: { icon: CalendarCheck, tone: "bg-success/10 text-success" },
  matches: { icon: Building2, tone: "bg-info/10 text-info" },
  followup: { icon: MessageSquare, tone: "bg-warning/10 text-warning" },
  nurture: { icon: Repeat, tone: "bg-warning/10 text-warning" },
  delay: { icon: Clock, tone: "bg-secondary text-foreground" },
  logger: { icon: FileText, tone: "bg-secondary text-foreground" },
};