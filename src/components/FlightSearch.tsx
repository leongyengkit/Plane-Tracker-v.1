import React, { useState } from 'react';
import { Search } from 'lucide-react';
import './FlightSearch.css';

interface FlightSearchProps {
  onSearch: (flightNumber: string) => void;
}

export const FlightSearch: React.FC<FlightSearchProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim().toUpperCase());
    }
  };

  return (
    <div className="search-container">
      <h1 className="search-title">Look up a specific flight</h1>
      <form className="search-form" onSubmit={handleSubmit}>
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Enter Flight Number (e.g., AA123)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="search-icon-container">
            {query && <span style={{ marginRight: '10px' }}>{query.toUpperCase()}</span>}
            <Search size={20} />
          </div>
        </div>
        <button type="submit" className="search-button">Search</button>
      </form>
    </div>
  );
};
