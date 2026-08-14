export const DRIVER_EXECUTION_STATUSES = [
  'assigned',
  'en_route',
  'arrived',
  'material_collected',
  'delivered_to_yard',
] as const;

export type DriverExecutionStatus = (typeof DRIVER_EXECUTION_STATUSES)[number];

export type DriverJobPhotoType = 'collection' | 'delivery';

export interface DriverJobPhoto {
  id: string;
  photoType: DriverJobPhotoType;
  storagePath: string;
  mimeType: 'image/jpeg' | 'image/png';
  fileSize: number;
  createdAt: string;
  signedUrl: string | null;
}

export interface PendingDriverJobPhoto {
  id: string;
  photoType: DriverJobPhotoType;
  uri: string;
  mimeType: 'image/jpeg' | 'image/png';
  fileSize?: number;
  status: 'preparing' | 'uploading' | 'failed';
  error?: string;
}

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

export interface DriverCoordinate {
  latitude: number;
  longitude: number;
}

export interface DriverJob {
  id: string;
  executionStatus: DriverExecutionStatus;
  scheduledAt: string | null;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  pickupCoordinate: DriverCoordinate | null;
  materialType: string;
  estimatedWeight: number | null;
  pickupNotes: string | null;
  assignment: DriverAssignment;
  actualCollectedWeight: number | null;
  driverNotes: string | null;
  enRouteAt: string | null;
  arrivedAt: string | null;
  materialCollectedAt: string | null;
  deliveredToYardAt: string | null;
}
