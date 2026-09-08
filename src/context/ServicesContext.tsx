import React, { createContext, useContext, ReactNode } from 'react';
import { useServices as useServicesHook, Service, getOwnerId } from '../hooks/useServices';

interface ServicesContextType {
  services: Service[];
  publicServices: Service[];
  loading: boolean;
  error: string | null;
  addService: (serviceData: Omit<Service, 'createdAt'>) => Promise<Service | undefined>;
  editService: (identifier: string | number, updatedData: Partial<Service>) => Promise<void>;
  applyServiceUpdate: (service: Service) => void;
  deleteService: (identifier: string | number) => Promise<void>;
  refreshServices: () => Promise<void>;
  fetchAllPendingServices: () => Promise<Service[]>;
  fetchAllRejectedServices: () => Promise<Service[]>;
}

const ServicesContext = createContext<ServicesContextType | undefined>(undefined);

export function ServicesProvider({ children }: { children: ReactNode }) {
  const servicesData = useServicesHook();

  return (
    <ServicesContext.Provider value={servicesData}>
      {children}
    </ServicesContext.Provider>
  );
}

export function useServices() {
  const context = useContext(ServicesContext);
  if (context === undefined) {
    throw new Error('useServices must be used within a ServicesProvider');
  }
  return context;
}

export { getOwnerId };
