import { AppHeader } from '@/components/ui/app-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';

export default function SalesRepHomeScreen() {
  return (
    <ScreenScaffold
      mode="scroll"
      header={<AppHeader title="Home" subtitle="Sales workspace" />}
    >
      <EmptyState
        title="No recent activity"
        message="Your sales metrics and recently submitted jobs will appear here."
        variant="dashboard"
      />
    </ScreenScaffold>
  );
}
