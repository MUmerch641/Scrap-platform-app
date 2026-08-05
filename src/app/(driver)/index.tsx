import { AppHeader } from '@/components/ui/app-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';

export default function DriverHomeScreen() {
  return (
    <ScreenScaffold
      mode="scroll"
      header={<AppHeader title="Home" subtitle="Driver workspace" />}
    >
      <EmptyState
        title="No active jobs"
        message="New assignments will appear here."
        variant="dashboard"
      />
    </ScreenScaffold>
  );
}
