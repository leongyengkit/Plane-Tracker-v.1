import { useState } from 'react';
import { PlaneTakeoff } from 'lucide-react';
import { FlightSearch } from './components/FlightSearch';
import { FlightDetailsCard } from './components/FlightDetailsCard';
import { mockFlights } from './data/mockFlights';
import type { Flight } from './data/mockFlights';
import './App.css';

function App() {
  const [searchedFlight, setSearchedFlight] = useState<Flight | null>(mockFlights[0]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = (flightNumber: string) => {
    setError(null);
    const flight = mockFlights.find(
      (f) => f.flightNumber.toUpperCase() === flightNumber.toUpperCase()
    );

    if (flight) {
      setSearchedFlight(flight);
    } else {
      setSearchedFlight(null);
      setError(`Flight ${flightNumber} not found. Try AA123, DL456, or EK74.`);
    }
  };

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="logo">
          <PlaneTakeoff color="#00f2fe" size={28} />
          <span>KIT AEROQUEST</span>
        </div>
        <div className="nav-links">
          <a href="#" className="active">Explore</a>
          <a href="#">My Trips</a>
          <a href="#">Bookings</a>
          <a href="#">Account</a>
        </div>
      </nav>

      <main className="main-content">
        <FlightSearch onSearch={handleSearch} />
        
        {error && <div className="error-message">{error}</div>}
        
        {searchedFlight && (
          <div className="results-container">
            <FlightDetailsCard flight={searchedFlight} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
