import { AppHeader } from '@/components/ui/app-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';

export default function DriverJobsScreen() {
  return (
    <ScreenScaffold
      mode="scroll"
      header={<AppHeader title="Jobs" subtitle="Available and assigned pickups" />}
    >
      <EmptyState
        title="No jobs available"
        message="Available pickup jobs will appear here."
        variant="dashboard"
      />
    </ScreenScaffold>
  );
}
