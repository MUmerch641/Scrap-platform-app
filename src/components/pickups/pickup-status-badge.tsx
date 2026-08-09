import { StatusBadge, StatusVariant } from '@/components/ui/status-badge';
import { PickupRequestStatus, PickupStatusFilter } from '@/services/pickup-service';

export const PICKUP_STATUS_FILTERS: readonly {
  value: PickupStatusFilter;
  label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
];

export function getPickupStatusPresentation(
  status: PickupRequestStatus,
): { label: string; variant: StatusVariant } {
  switch (status) {
    case 'pending_review':
      return { label: 'Pending Review', variant: 'warning' };
    case 'approved':
      return { label: 'Approved', variant: 'success' };
    case 'scheduled':
      return { label: 'Scheduled', variant: 'neutral' };
    case 'completed':
      return { label: 'Completed', variant: 'success' };
    case 'rejected':
      return { label: 'Rejected', variant: 'danger' };
  }
}

interface PickupStatusBadgeProps {
  status: PickupRequestStatus;
}

export function PickupStatusBadge({ status }: PickupStatusBadgeProps) {
  const presentation = getPickupStatusPresentation(status);
  return (
    <StatusBadge
      label={presentation.label}
      variant={presentation.variant}
    />
  );
}
