import { AppHeader } from '@/components/ui/app-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';

export default function CustomersScreen() {
  return (
    <ScreenScaffold
      mode="scroll"
      header={<AppHeader title="Customers" subtitle="Customer Directory" />}
    >
      <EmptyState
        title="No customers found"
        message="Your client directory and customer details will appear here."
        variant="dashboard"
      />
    </ScreenScaffold>
  );
}
