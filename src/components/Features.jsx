import React from 'react';
import './Features.css';

export default function Features() {
  const features = [
    {
      icon: '⚡',
      title: 'Lightning Fast',
      description: 'Real-time response with optimized MCP protocols'
    },
    {
      icon: '🔗',
      title: 'Multi-Channel',
      description: 'Seamless integration across all platforms'
    },
    {
      icon: '🧠',
      title: 'Intelligent',
      description: 'Advanced AI-powered decision making'
    },
    {
      icon: '🛡️',
      title: 'Secure',
      description: 'Enterprise-grade encryption & protection'
    },
    {
      icon: '📈',
      title: 'Scalable',
      description: 'Built to handle any scale of operations'
    },
    {
      icon: '🎯',
      title: 'Customizable',
      description: 'Tailor agents to your exact needs'
    }
  ];

  return (
    <section className="features">
      <div className="features-container">
        <div className="section-header">
          <h2>Why Choose MCP Flow</h2>
          <p>Everything you need to automate with confidence</p>
        </div>
        
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
