import React, { useEffect, useState } from 'react';
import './Hero.css';

export default function Hero() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className={`hero ${isVisible ? 'visible' : ''}`}>
      <div className="hero-background">
        <div className="gradient-blob blob-1"></div>
        <div className="gradient-blob blob-2"></div>
      </div>

      <div className="hero-content">
        <h1 className="hero-title">MCP Flow Agents</h1>
        <p className="hero-subtitle">Intelligent automation across all channels</p>
        
        <div className="cta-buttons">
          <button className="btn btn-primary">Get Started</button>
          <button className="btn btn-ghost">View Docs</button>
        </div>
      </div>

      <div className="scroll-indicator">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
    </section>
  );
}
