import React from 'react';
import './Promo.css';

export default function Promo() {
  return (
    <section className="promo">
      <div className="promo-container">
        <div className="promo-content">
          <h2>See It In Action</h2>
          <p>Watch MCP Flow Agents in action</p>
        </div>

        <div className="video-wrapper">
          <video
            className="promo-video"
            autoPlay
            muted
            loop
            playsInline
            controls
          >
            <source src="/promo.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    </section>
  );
}
