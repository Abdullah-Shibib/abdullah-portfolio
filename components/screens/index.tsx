import type { ComponentType } from 'react';
import { MonitorId } from '@/lib/data';
import NetworkScreen from './NetworkScreen';
import AboutScreen from './AboutScreen';
import NoLifeScreen from './NoLifeScreen';
import ProjectsScreen from './ProjectsScreen';
import TimelineScreen from './TimelineScreen';
import SkillsScreen from './SkillsScreen';
import ContactScreen from './ContactScreen';
import AssistantScreen from './AssistantScreen';

export const SCREENS: Record<MonitorId, ComponentType<{ expanded?: boolean }>> = {
  network: NetworkScreen,
  about: AboutScreen,
  ml: NoLifeScreen,
  projects: ProjectsScreen,
  timeline: TimelineScreen,
  skills: SkillsScreen,
  contact: ContactScreen,
  assistant: AssistantScreen,
};
