import { AppHeader } from '@/components/ui/app-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';

export default function DriverActiveJobScreen() {
  return (
    <ScreenScaffold
      mode="scroll"
      header={<AppHeader title="Active Job" />}
    >
      <EmptyState
        title="No active job"
        message="Accept a job to view its progress here."
        variant="dashboard"
      />
    </ScreenScaffold>
  );
}
