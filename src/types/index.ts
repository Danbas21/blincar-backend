 
// Tipos de usuario
export interface User {
    id: string;
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    role: 'passenger' | 'driver' | 'admin';
    status: 'active' | 'inactive' | 'suspended';
    profileImage?: string;
    createdAt: Date;
    updatedAt: Date;
  }
  
  // Tipos de viaje
  export interface Trip {
    id: string;
    passengerId: string;
    driverId?: string;
    status: 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
    originAddress: string;
    destinationAddress: string;
    originCoordinates: {
      latitude: number;
      longitude: number;
    };
    destinationCoordinates: {
      latitude: number;
      longitude: number;
    };
    estimatedDistance: number;
    estimatedDuration: number;
    estimatedPrice: number;
    actualPrice?: number;
    requestedAt: Date;
    acceptedAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    cancelledAt?: Date;
    cancelReason?: string;
  }
  
  // Tipos de conductor
  export interface Driver {
    id: string;
    userId: string;
    licenseNumber: string;
    vehicleId: string;
    status: 'available' | 'busy' | 'offline';
    currentLocation?: {
      latitude: number;
      longitude: number;
    };
    rating: number;
    totalTrips: number;
    isVerified: boolean;
  }
  
  // Tipos de vehículo
  export interface Vehicle {
    id: string;
    driverId: string;
    make: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
    capacity: number;
    type: 'sedan' | 'suv' | 'van' | 'motorcycle';
    isVerified: boolean;
  }
  
  // Tipos de API Response
  export interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    error?: string;
    timestamp: string;
  }
  
  // Tipos de Socket.io
  export interface SocketEvents {
    // Usuario conecta/desconecta
    connect: () => void;
    disconnect: () => void;
    
    // Localización
    location_update: (data: {
      userId: string;
      coordinates: { latitude: number; longitude: number };
    }) => void;
    
    // Viajes
    trip_request: (tripData: Partial<Trip>) => void;
    trip_accepted: (data: { tripId: string; driverId: string }) => void;
    trip_cancelled: (data: { tripId: string; reason: string }) => void;
    
    // Chat
    message_send: (data: {
      tripId: string;
      senderId: string;
      message: string;
    }) => void;
    
    message_receive: (data: {
      tripId: string;
      senderId: string;
      message: string;
      timestamp: Date;
    }) => void;
  }