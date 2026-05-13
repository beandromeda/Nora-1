import { PlannerProvider } from './state/PlannerContext';
import { usePlanner } from './state/usePlanner';
import { Header } from './components/layout/Header';
import { AssistantPanel } from './components/assistant/AssistantPanel';
import { DailyView } from './components/views/DailyView';
import { WeeklyView } from './components/views/WeeklyView';
import { MonthlyView } from './components/views/MonthlyView';
import { QuarterlyView } from './components/views/QuarterlyView';
import { SettingsPage } from './components/views/SettingsPage';
import { RecurringPage } from './components/views/RecurringPage';
import { EventsPage } from './components/views/EventsPage';
import { HabitsPage } from './components/views/HabitsPage';
import { AnalyticsPage } from './components/views/AnalyticsPage';
import { VisionBoardPage } from './components/views/VisionBoardPage';
import { NotesPage } from './components/views/NotesPage';

function ViewSwitcher() {
  const { viewMode } = usePlanner();
  if (viewMode === 'daily') return <DailyView />;
  if (viewMode === 'weekly') return <WeeklyView />;
  if (viewMode === 'monthly') return <MonthlyView />;
  return <QuarterlyView />;
}

function MainContent() {
  const { topTab } = usePlanner();
  if (topTab === 'planner') return <ViewSwitcher />;
  if (topTab === 'recurring') return <RecurringPage />;
  if (topTab === 'events') return <EventsPage />;
  if (topTab === 'habits') return <HabitsPage />;
  if (topTab === 'analytics') return <AnalyticsPage />;
  if (topTab === 'notes') return <NotesPage />;
  if (topTab === 'vision') return <VisionBoardPage />;
  return <SettingsPage />;
}

function Shell() {
  const { topTab } = usePlanner();
  return (
    <div className="h-screen flex flex-col bg-sand-50">
      <Header />
      <div className="flex-1 flex min-h-0">
        <main className="flex-1 overflow-y-auto">
          <MainContent />
        </main>
        {topTab === 'planner' && <AssistantPanel />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <PlannerProvider>
      <Shell />
    </PlannerProvider>
  );
}
