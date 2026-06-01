export interface AirportDetails {
  city: string;
  code: string;
  airport: string;
  time: string; // ISO string
  timezone: string; // e.g. 'EST'
  terminal: string;
  gate: string;
  coordinates: { lat: number; lng: number }; // Geographic coordinates (Lat/Lng)
}

export interface Flight {
  flightNumber: string;
  airline: string;
  status: 'DEPARTED' | 'ON TIME' | 'DELAYED' | 'ARRIVED';
  statusColor: string;
  icao24: string; // OpenSky ICAO 24-bit address for ADS-B tracking
  
  departure: AirportDetails;
  arrival: AirportDetails;
  
  flightDuration: string;
  flightStatusMessage: string;
  progress: number; // Flight progress from 0 (scheduled) to 1 (landed)
}

export const mockFlights: Flight[] = [
  {
    flightNumber: 'AA123',
    airline: 'AMERICAN AIRLINES',
    status: 'DEPARTED',
    statusColor: '#00f2fe',
    icao24: 'a0e250', // Active American Airlines flight
    departure: {
      city: 'NEW YORK',
      code: 'JFK',
      airport: "John F. Kennedy Int'l",
      time: '2026-05-13T09:30:00-05:00',
      timezone: 'EST',
      terminal: '8',
      gate: '34',
      coordinates: { lat: 40.6413, lng: -73.7781 }
    },
    arrival: {
      city: 'LONDON',
      code: 'LHR',
      airport: 'Heathrow Airport',
      time: '2026-05-13T21:45:00+01:00',
      timezone: 'BST',
      terminal: '5',
      gate: 'B42',
      coordinates: { lat: 51.4700, lng: -0.4543 }
    },
    flightDuration: '7h 15m',
    flightStatusMessage: 'En Route (3h 15m remaining)',
    progress: 0.55
  },
  {
    flightNumber: 'DL456',
    airline: 'DELTA AIR LINES',
    status: 'ON TIME',
    statusColor: '#00ff87',
    icao24: 'a3689e', // Active Delta flight
    departure: {
      city: 'LOS ANGELES',
      code: 'LAX',
      airport: "Los Angeles Int'l",
      time: '2026-05-14T14:00:00-08:00',
      timezone: 'PST',
      terminal: '2',
      gate: '12',
      coordinates: { lat: 33.9416, lng: -118.4085 }
    },
    arrival: {
      city: 'TOKYO',
      code: 'NRT',
      airport: 'Narita Int\'l',
      time: '2026-05-15T18:00:00+09:00',
      timezone: 'JST',
      terminal: '1',
      gate: '45',
      coordinates: { lat: 35.7720, lng: 140.3929 }
    },
    flightDuration: '12h 00m',
    flightStatusMessage: 'Boarding starts in 2h',
    progress: 0
  },
  {
    flightNumber: 'EK74',
    airline: 'EMIRATES',
    status: 'ON TIME',
    statusColor: '#00ff87',
    icao24: 'accd69', // Another active flight transponder (Delta) mapped for testing live tracking
    departure: {
      city: 'PARIS',
      code: 'CDG',
      airport: "Charles de Gaulle",
      time: '2026-05-14T15:35:00+02:00',
      timezone: 'CET',
      terminal: '2C',
      gate: 'C82',
      coordinates: { lat: 49.0097, lng: 2.5479 }
    },
    arrival: {
      city: 'DUBAI',
      code: 'DXB',
      airport: "Dubai Int'l",
      time: '2026-05-15T00:20:00+04:00',
      timezone: 'GST',
      terminal: '3',
      gate: 'A12',
      coordinates: { lat: 25.2532, lng: 55.3657 }
    },
    flightDuration: '6h 45m',
    flightStatusMessage: 'Scheduled',
    progress: 0
  }
];
