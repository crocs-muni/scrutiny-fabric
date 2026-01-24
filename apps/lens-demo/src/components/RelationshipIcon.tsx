import {
  TestTube,
  AlertTriangle,
  Wrench,
  Award,
  BarChart3,
  Search,
  FileText,
  BookOpen,
  Link,
} from 'lucide-react';
import type { RelationshipIconName } from '@/lib/scrutiny';

const ICON_MAP = {
  TestTube,
  AlertTriangle,
  Wrench,
  Award,
  BarChart3,
  Search,
  FileText,
  BookOpen,
  Link,
} as const;

interface RelationshipIconProps {
  iconName: RelationshipIconName;
  className?: string;
}

export function RelationshipIcon({ iconName, className = 'h-3 w-3' }: RelationshipIconProps) {
  const Icon = ICON_MAP[iconName];
  return <Icon className={className} />;
}
