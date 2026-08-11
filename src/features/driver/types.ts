export const DRIVER_EXECUTION_STATUSES = [
  'assigned',
  'en_route',
  'arrived',
  'material_collected',
  'delivered_to_yard',
] as const;

export type DriverExecutionStatus = (typeof DRIVER_EXECUTION_STATUSES)[number];

export interface VehicleSummary {
  id: string;
  label: string;
  registrationNumber: string | null;
}

export interface DriverAssignment {
  id: string;
  driverId: string;
  vehicle: VehicleSummary;
  assignedAt: string;
}

export interface DriverJob {
  id: string;
  executionStatus: DriverExecutionStatus;
  scheduledAt: string | null;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  materialType: string;
  estimatedWeight: number | null;
  pickupNotes: string | null;
  assignment: DriverAssignment;
  actualCollectedWeight: number | null;
  enRouteAt: string | null;
  arrivedAt: string | null;
  materialCollectedAt: string | null;
  deliveredToYardAt: string | null;
}
