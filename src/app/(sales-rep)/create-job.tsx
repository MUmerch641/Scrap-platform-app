import { AppHeader } from '@/components/ui/app-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';

export default function CreateJobScreen() {
  return (
    <ScreenScaffold
      mode="scroll"
      header={<AppHeader title="Create Job" />}
    >
      <EmptyState
        title="Job creation"
        message="A form to create new jobs will be implemented here."
        variant="dashboard"
      />
    </ScreenScaffold>
  );
}
