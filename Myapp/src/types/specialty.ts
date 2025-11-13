export interface Specialty {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  image?: string;
  background?: string;
  doctorCount?: number;
  serviceCount?: number;
  isActive?: boolean;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}