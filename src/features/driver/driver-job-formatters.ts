import { DriverExecutionStatus, VehicleSummary } from './types';

const STATUS_LABELS: Record<DriverExecutionStatus, string> = {
  assigned: 'Assigned',
  en_route: 'En Route',
  arrived: 'Arrived',
  material_collected: 'Material Collected',
  delivered_to_yard: 'Delivered to Yard',
};

export function formatDriverStatus(status: DriverExecutionStatus): string {
  return STATUS_LABELS[status];
}

export function formatDriverSchedule(value: string | null): { date: string; time: string } {
  if (!value) return { date: 'To be confirmed', time: 'To be confirmed' };
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date),
    time: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date),
  };
}

export function formatDriverScheduleSummary(value: string | null): string {
  if (!value) return 'Schedule to be confirmed';
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

export function formatDriverWeight(value: number | null): string {
  return value == null ? 'Not provided' : `${value.toLocaleString()} kg`;
}

export function formatDriverVehicle(vehicle: VehicleSummary): string {
  return vehicle.registrationNumber ? `${vehicle.label} (${vehicle.registrationNumber})` : vehicle.label || 'Vehicle information unavailable';
}
